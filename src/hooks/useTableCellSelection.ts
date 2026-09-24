import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { clearCells, rangeOf, type CellRange } from '../lib/table'
import type { TableData } from '../types'
import type { CellPos } from '../components/editor/block/table/TableContextProvider'

type Selection = { anchor: CellPos; focus: CellPos }

/** 선택 범위의 화면 위치. outline 은 표 틀(frame) 기준, bar 는 화면(fixed) 기준이다. */
export type SelectionBox = {
  outline: { left: number; top: number; width: number; height: number }
  bar: { left: number; top: number }
}

const samePos = (a: CellPos, b: CellPos) => a.row === b.row && a.column === b.column

/** 범위 안에 그려진 셀들의 사각형을 합쳐 테두리와 동작 바 위치를 잰다. */
function measureBox(frame: HTMLElement | null, bar: HTMLElement | null, range: CellRange | null): SelectionBox | null {
  if (!range || !frame) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  frame.querySelectorAll<HTMLElement>('[data-cell-pos]').forEach((cell) => {
    const pos = posOf(cell)!
    if (pos.row < range.top || pos.row > range.bottom || pos.column < range.left || pos.column > range.right) return
    const rect = cell.getBoundingClientRect()
    left = Math.min(left, rect.left)
    top = Math.min(top, rect.top)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  })
  if (!Number.isFinite(left)) return null
  const origin = frame.getBoundingClientRect()
  const barHeight = bar?.offsetHeight ?? 36
  return {
    outline: { left: left - origin.left - 1, top: top - origin.top - 1, width: right - left + 1, height: bottom - top + 1 },
    bar: { left, top: top - barHeight - 8 < 8 ? bottom + 8 : top - barHeight - 8 },
  }
}

function posOf(element: Element | null): CellPos | null {
  const value = (element?.closest('[data-cell-pos]') as HTMLElement | null)?.dataset.cellPos
  if (!value) return null
  const [row, column] = value.split(':').map(Number)
  return { row, column }
}

/**
 * 표에서 여러 셀을 고르는 동작.
 * - 한 셀에서 누른 채 다른 셀로 끌면 사각형으로 선택된다. (글자 선택은 취소)
 * - Shift+클릭은 편집 중이던 셀(또는 이전 선택의 시작 셀)부터 넓힌다.
 * - 선택 중 Delete/Backspace 는 내용 지우기, Esc 는 선택 해제, Ctrl+C 는 탭으로 구분해 복사.
 */
export function useTableCellSelection({
  frameRef,
  table,
  focusCell,
  onChange,
  layoutKey,
}: {
  frameRef: RefObject<HTMLDivElement | null>
  table: TableData
  focusCell: CellPos | null
  onChange: (table: TableData) => void
  /** 셀 크기가 바뀌는 상태(열 너비 조절 등). 바뀌면 테두리를 다시 잰다. */
  layoutKey?: unknown
}) {
  const [selection, setSelection] = useState<Selection | null>(null)
  const [box, setBox] = useState<SelectionBox | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanupRef.current?.(), [])

  const range: CellRange | null = useMemo(
    () => (selection ? rangeOf(table, selection.anchor, selection.focus) : null),
    [selection, table],
  )

  // 표 구조가 바뀌어 범위가 표 밖으로 나가면 선택을 푼다.
  const outOfTable = !!range && (range.bottom >= table.rows.length || range.right >= table.columns.length)
  const current = outOfTable ? null : range

  const clear = useCallback(() => setSelection(null), [])

  const select = useCallback((anchor: CellPos, focus: CellPos = anchor) => {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    window.getSelection()?.removeAllRanges()
    setSelection({ anchor, focus })
  }, [])

  /** 셀 안에서 누르기 시작. 다른 셀로 넘어가는 순간부터 셀 선택으로 바뀐다. */
  const pressCell = useCallback(
    (event: ReactPointerEvent, pos: CellPos) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (event.shiftKey) return // mousedown 에서 처리
      setSelection(null)

      let selecting = false
      const onMove = (moveEvent: PointerEvent) => {
        const over = posOf(document.elementFromPoint(moveEvent.clientX, moveEvent.clientY))
        if (!over || !frameRef.current?.querySelector(`[data-cell-pos="${over.row}:${over.column}"]`)) return
        if (!selecting) {
          if (samePos(over, pos)) return
          selecting = true
          document.body.classList.add('is-table-selecting')
          ;(document.activeElement as HTMLElement | null)?.blur?.()
        }
        window.getSelection()?.removeAllRanges()
        setSelection((prev) => (prev && samePos(prev.focus, over) ? prev : { anchor: pos, focus: over }))
      }
      const finish = () => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', finish)
        document.removeEventListener('pointercancel', finish)
        document.body.classList.remove('is-table-selecting')
        cleanupRef.current = null
      }
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', finish)
      document.addEventListener('pointercancel', finish)
      cleanupRef.current = finish
    },
    [frameRef],
  )

  /** Shift+클릭: 포커스·글자 선택이 생기기 전에 mousedown 단계에서 막고 범위를 넓힌다. */
  const shiftClickCell = useCallback(
    (event: ReactMouseEvent, pos: CellPos) => {
      if (!event.shiftKey) return
      const anchor = selection?.anchor ?? focusCell
      if (!anchor) return
      event.preventDefault()
      select(anchor, pos)
    },
    [focusCell, select, selection],
  )

  // 표 밖을 누르면 선택 해제
  useEffect(() => {
    if (!selection) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (barRef.current?.contains(target)) return
      if (frameRef.current?.contains(target) && posOf(target as Element)) return
      setSelection(null)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [frameRef, selection])

  // 선택 중 키보드
  useEffect(() => {
    if (!current) return
    const handleKeyDown = (event: KeyboardEvent) => {
      // 셀을 고른 바로 그 키(편집 중 Esc)가 document 까지 올라와 선택을 곧바로 풀지 않도록, 입력칸에서 온 키는 무시한다.
      const origin = event.target as HTMLElement | null
      if (origin && (origin.isContentEditable || origin.tagName === 'TEXTAREA' || origin.tagName === 'INPUT')) return
      const active = document.activeElement
      if (active && active !== document.body && !barRef.current?.contains(active)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        setSelection(null)
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        onChange(clearCells(table, current))
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        const text = table.rows
          .slice(current.top, current.bottom + 1)
          .map((row) => row.cells.slice(current.left, current.right + 1).join('\t'))
          .join('\n')
        void navigator.clipboard?.writeText(text)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [current, onChange, table])

  const measure = useCallback(
    () => setBox(measureBox(frameRef.current, barRef.current, current)),
    [current, frameRef],
  )

  useLayoutEffect(() => {
    setBox(measureBox(frameRef.current, barRef.current, current))
  }, [current, frameRef, table, layoutKey])

  useEffect(() => {
    if (!current) return
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [current, measure])

  const isSelected = useCallback(
    (row: number, column: number) =>
      !!current && row >= current.top && row <= current.bottom && column >= current.left && column <= current.right,
    [current],
  )

  return { range: current, box, barRef, select, clear, pressCell, shiftClickCell, isSelected }
}
