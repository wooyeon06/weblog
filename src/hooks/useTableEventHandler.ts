import type { KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { TableContext, type Axis, type CellPos, type MenuTarget } from '../components/editor/table/TableContextProvider';
import { insertRow, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, moveColumn, moveRow, resizeColumn } from '../lib/table';
import type { TableData } from '../types';

/** 이 거리(px)를 넘겨야 드래그로 인정한다. (손잡이 클릭으로 메뉴를 열 수 있게) */
export const DRAG_THRESHOLD = 4

type DragState = { axis: Axis; from: number; to: number }
type GhostState = {
  axis: Axis
  from: number
  width: number
  height: number
  x: number
  y: number
}

export function useTableEventHandler() {
  const { tableRef, onChangeRef, frameRef, pendingCellRef, menu, setMenu, table, onChange } = useContext(TableContext)
  const { columns, rows } = table

  /** 손잡이를 누른 지점. 클릭인지 드래그인지 가르는 데 쓴다. */
  const pressRef = useRef<{ x: number; y: number; wasOpen: boolean } | null>(null)

  /** 진행 중인 포인터 인터랙션(리사이즈/드래그)의 뒷정리 함수. 언마운트 시 리스너 leak을 막는다. */
  const cleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanupRef.current?.(), [])

  
  /** 리사이즈 중에는 store 에 쓰지 않고 화면에만 반영한다. (매 프레임 localStorage 쓰기 방지) */
  //========================== mark [S] startResize ==========================
  const [resizing, setResizing] = useState<{ index: number; width: number } | null>(null)
  const startResize = useCallback((event: ReactPointerEvent, index: number) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = tableRef.current.columns[index].width
    let width = startWidth

    const onMove = (moveEvent: PointerEvent) => {
      width = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX))
      setResizing({ index, width })
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.body.classList.remove('is-table-resizing')
      cleanupRef.current = null
      setResizing(null)
      if (width !== startWidth) onChangeRef.current(resizeColumn(tableRef.current, index, width))
    }

    document.body.classList.add('is-table-resizing')
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp, { once: true })

    cleanupRef.current = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.classList.remove('is-table-resizing')
      setResizing(null)
    }
    //린트 규칙은 클로저 안에서 참조하는 외부 값을 전부 의존성 배열에 넣으라고 요구
    //빈 배열과 같음
  }, [tableRef, onChangeRef])
  //========================== mark [E] startResize ==========================


  //========================== mark [S] drag ==========================
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ghost, setGhost] = useState<GhostState | null>(null)
  const startDrag = useCallback((event: ReactPointerEvent, axis: Axis, from: number) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const startX = event.clientX
    const startY = event.clientY
    let activated = false
    let to = from

    const update = (x: number, y: number) => {
      const selector = axis === 'col' ? '[data-col-index]' : '[data-row-index]'
      const nodes = frameRef?.current?.querySelectorAll<HTMLElement>(selector) ?? []
      const rects = Array.from(nodes, (node) => node.getBoundingClientRect())

      let next = rects.length
      for (let i = 0; i < rects.length; i += 1) {
        const rect = rects[i]
        const middle = axis === 'col' ? rect.left + rect.width / 2 : rect.top + rect.height / 2
        if ((axis === 'col' ? x : y) < middle) {
          next = i
          break
        }
      }

      if (next === to) return
      to = next
      setDrag({ axis, from, to })
    }

    const onMove = (moveEvent: PointerEvent) => {
      if (!activated) {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD) return

        const selector = axis === 'col' ? `[data-col-index="${from}"]` : `[data-row-index="${from}"]`
        const target = frameRef.current?.querySelector<HTMLElement>(selector)
        const rect = target?.getBoundingClientRect()

        activated = true
        setMenu(null)
        setDrag({ axis, from, to })
        setGhost({
          axis,
          from,
          width: axis === 'col' ? Math.max(rect?.width ?? 120, 120) : Math.max(frameRef.current?.clientWidth ?? 320, 120),
          height: axis === 'row' ? Math.max(rect?.height ?? 40, 32) : Math.max(frameRef.current?.clientHeight ?? 60, 40),
          x: moveEvent.clientX,
          y: moveEvent.clientY,
        })
        document.body.classList.add('is-table-dragging')
      }

      update(moveEvent.clientX, moveEvent.clientY)
      setGhost((previous) => (previous ? { ...previous, x: moveEvent.clientX, y: moveEvent.clientY } : previous))
    }

    const finish = (commit: boolean) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
      document.body.classList.remove('is-table-dragging')
      cleanupRef.current = null
      setDrag(null)
      setGhost(null)
      if (activated) pressRef.current = null
      if (!commit || !activated) return

      const target = to > from ? to - 1 : to
      if (target === from) return
      const current = tableRef.current
      onChangeRef.current(axis === 'col' ? moveColumn(current, from, to) : moveRow(current, from, to))
    }

    const onUp = () => finish(true)
    const onCancel = () => finish(false)

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    // 언마운트 중 인터랙션이 남아 있으면 커밋하지 않고 취소만 한다.
    cleanupRef.current = () => finish(false)
  }, [frameRef, tableRef, onChangeRef, setMenu])
  //=============================== Drag [E] =================================

  /**
   * @mark 손잡이는 "끌면 순서 변경, 클릭하면 메뉴" 다.
   */
  const pressHandle = useCallback((event: ReactPointerEvent, target: MenuTarget, index: number) => {
    pressRef.current = {
      x: event.clientX,
      y: event.clientY,
      wasOpen: menu?.target === target && menu.index === index,
    }
  }, [menu])
  
  /**
   * @mark 드래그 중일 경우는 무시
   */
  const clickHandle = useCallback((event: ReactMouseEvent, target: MenuTarget, index: number) => {
    const press = pressRef.current
    pressRef.current = null
    if (!press) return
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) >= DRAG_THRESHOLD) return
    if (press.wasOpen) {
      setMenu(null)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    setMenu({ target, index, x: rect.left, y: rect.bottom + 4 })
  }, [setMenu])

  const findCell = useCallback(
    (row: number, column: number) =>
      frameRef.current?.querySelector<HTMLTextAreaElement>(`[data-cell="${row}:${column}"]`) ?? null,
    [frameRef],
  )

  /** 갱신된 테이블을 반영하고, 필요하면 다음 포커스 대상 셀도 함께 예약한다. */
  const apply = useCallback((next: TableData, focus?: CellPos) => {
    if (focus) pendingCellRef.current = focus
    setMenu(null)
    onChange(next)
  }, [pendingCellRef, setMenu, onChange])

  const handleCellKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>, row: number, column: number) => {
    const target = event.currentTarget
    const lastRow = rows.length - 1
    const lastColumn = columns.length - 1

    if (event.key === 'Escape') {
      target.blur()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      if (event.shiftKey) {
        if (column > 0) findCell(row, column - 1)?.focus()
        else if (row > 0) findCell(row - 1, lastColumn)?.focus()
        return
      }
      if (column < lastColumn) {
        findCell(row, column + 1)?.focus()
        return
      }
      if (row < lastRow) {
        findCell(row + 1, 0)?.focus()
        return
      }
      apply(insertRow(table, rows.length), { row: rows.length, column: 0 })
      return
    }
  }, [rows, columns, table, findCell, apply])

  return {
    resizing,
    setResizing,
    startResize,
    startDrag,
    drag,
    ghost,
    pressHandle,
    clickHandle,
    handleCellKeyDown,
    findCell,
    apply,
  }
}
