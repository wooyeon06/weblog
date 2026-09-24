import './TableBlock.scss'

import { Fragment, useContext, useEffect, useRef, useState } from 'react'
import { useTableCellSelection } from '../../../../hooks/useTableCellSelection'
import { useTableEventHandler } from '../../../../hooks/useTableEventHandler'
import {
  clearCells,
  colorValueOf,
  insertColumn,
  insertRow,
  isCoveredCell,
  mergeCells,
  mergeOfRange,
  setCell,
  spanOf,
  unmergeCells
} from '../../../../lib/table'
import ColMenu from './ColMenu'
import RowMenu from './RowMenu'
import TableCellInput from './TableCellInput'
import { TableContext, type Axis, type CellPos } from './TableContextProvider'

export function TableBlock() {
  const {
    table,
    onChange, registerFirstCell, onFocus,
    menu, setMenu,
    frameRef,
    pendingCellRef,
  } = useContext(TableContext);
  const { resizing, startResize, drag, startDrag, clickHandle, pressHandle, ghost, findCell, handleCellKeyDown, apply } = useTableEventHandler();
  const menuRef = useRef<HTMLDivElement>(null)

  /** 커서가 가리키는 행·열. 그 손잡이만 보여준다. */
  const [hoverRow, setHoverRow] = useState<number | null>(null)
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  /** 커서가 표를 벗어나도 편집 중인 셀의 손잡이는 남겨둔다. */
  const [focusCell, setFocusCell] = useState<CellPos | null>(null)
  
  const { columns, rows, headerRow, headerColumn } = table

  /** 여러 셀 선택 (드래그 · Shift+클릭 · 셀에서 Esc) */
  const {
    range: selRange,
    box: selBox,
    barRef: selBarRef,
    select: selectCells,
    pressCell,
    shiftClickCell,
    isSelected,
  } = useTableCellSelection({ frameRef, table, focusCell, onChange: apply, layoutKey: resizing })
  const selMerge = selRange ? mergeOfRange(table, selRange) : undefined
  const selIsSingle = !!selRange && (selMerge ? true : selRange.top === selRange.bottom && selRange.left === selRange.right)
  const selHasMerge = !!selRange && (table.merges ?? []).some(
    (m) => m.row <= selRange.bottom && m.row + m.rowSpan - 1 >= selRange.top && m.col <= selRange.right && m.col + m.colSpan - 1 >= selRange.left,
  )
  const widthOf = (index: number) => (resizing?.index === index ? resizing.width : columns[index].width)
  const totalWidth = columns.reduce((sum, _column, index) => sum + widthOf(index), 0)

  /** 첫 셀을 에디터 포커스 맵에 등록한다. 행이 바뀌어도 매 렌더마다 다시 맞춘다. */
  useEffect(() => {
    registerFirstCell?.(findCell(0, 0))
  })
  useEffect(() => () => registerFirstCell?.(null), [registerFirstCell])

  /** 행/열을 추가한 직후 새 셀로 커서를 옮긴다. */
  useEffect(() => {
    const pending = pendingCellRef.current
    if (!pending) return
    pendingCellRef.current = null
    const element = findCell(pending.row, pending.column)
    if (!element) return
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
  })

  useEffect(() => {
    if (!menu) return
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])


  const beginDrag = (event: React.PointerEvent, axis: Axis, index: number) => {
    setHoverRow(null)
    setHoverCol(null)
    startDrag(event, axis, index)
  }


  // ---------------------------------------------------------------------- 렌더
  /** 좌표 계산에 쓰는 열 왼쪽 오프셋 */
  const leftOf = (index: number) => columns.slice(0, index).reduce((sum, _column, i) => sum + widthOf(i), 0)

  const dropColumnLeft = drag?.axis === 'col' ? leftOf(drag.to) : 0
  const showColumnDrop = drag?.axis === 'col' && drag.to !== drag.from && drag.to !== drag.from + 1

  /**
   * 파란 테두리는 메뉴를 열었을 때만 그린다.
   * 드래그 중에는 고스트와 삽입선이 상태를 다 보여주므로 테두리를 건드리지 않는다.
   */
  const selectedCol = menu?.target === 'col' ? menu.index : null
  const selectedRow = menu?.target === 'row' ? menu.index : null

  /** 손잡이를 보여줄 행·열. 선택 > 커서 > 편집 중인 셀 순으로 우선한다. */
  const activeCol = selectedCol ?? hoverCol ?? focusCell?.column ?? null
  const activeRow = selectedRow ?? hoverRow ?? focusCell?.row ?? null

  /**
   * 표 바깥 테두리 중 파란 선택·포커스 테두리가 지나가는 구간.
   * 여기 손잡이는 막대가 파란 선을 덮지 않도록 모양을 바꾼다. (.table-block__handle--flush)
   */
  const blueEdge = selRange
    ?? (focusCell && (() => {
      const { rowSpan, colSpan } = spanOf(table, focusCell.row, focusCell.column)
      return {
        top: focusCell.row,
        bottom: focusCell.row + rowSpan - 1,
        left: focusCell.column,
        right: focusCell.column + colSpan - 1,
      }
    })())
  const isOnBlueEdge = (axis: Axis, index: number) =>
    !!blueEdge && (axis === 'col'
      ? blueEdge.top === 0 && index >= blueEdge.left && index <= blueEdge.right
      : blueEdge.left === 0 && index >= blueEdge.top && index <= blueEdge.bottom)

  const handleClassOf = (axis: Axis, index: number, extra = '') => {
    const active = axis === 'col' ? activeCol : activeRow
    const selected = axis === 'col' ? selectedCol : selectedRow
    return [
      'table-block__handle',
      extra,
      active === index ? 'table-block__handle--show' : '',
      selected === index ? 'table-block__handle--on' : '',
      isOnBlueEdge(axis, index) ? 'table-block__handle--flush' : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  const rowClassOf = (index: number) => {
    const classes = ['table-block__row']
    if (selectedRow === index) classes.push('table-block__row--selected')
    if (drag?.axis === 'row') {
      if (drag.from === index) classes.push('table-block__row--dragging')
      if (drag.to === index && drag.from !== index && drag.from + 1 !== index) {
        classes.push('table-block__row--drop-before')
      }
      if (drag.to === rows.length && index === rows.length - 1 && drag.from !== index) {
        classes.push('table-block__row--drop-after')
      }
    }
    return classes.join(' ')
  }

  const isHeaderCell = (r: number, c: number) => (headerRow && r === 0) || (headerColumn && c === 0)

  /** 끌고 있는 행·열을 실제 셀 내용까지 그대로 띄운다. (라벨만 있으면 뭘 잡았는지 안 보인다) */
  const ghostCells = !ghost
    ? []
    : ghost.axis === 'row'
      ? (rows[ghost.from]?.cells ?? []).map((text, c) => ({
        key: columns[c].id,
        text,
        width: widthOf(c),
        isHeader: isHeaderCell(ghost.from, c),
      }))
      : rows.map((row, r) => ({
        key: row.id,
        text: row.cells[ghost.from] ?? '',
        width: widthOf(ghost.from),
        isHeader: isHeaderCell(r, ghost.from),
      }))

  return (
    <div
      className="table-block"
      onPointerLeave={() => {
        setHoverRow(null)
        setHoverCol(null)
      }}
    >
      <div className="table-block__scroll">
        <div className="table-block__stack">
          <div className="table-block__main">
            <div className="table-block__frame" ref={frameRef}>
              {/* 열 손잡이 */}
              <div className="table-block__cols">
                {columns.map((column, c) => (
                  <div
                    key={column.id}
                    className="table-block__col"
                    data-col-index={c}
                    style={{ width: widthOf(c) }}
                    onPointerEnter={() => {
                      if (!drag) setHoverCol(c)
                    }}
                  >
                    <button
                      type="button"
                      className={handleClassOf('col', c)}
                      title="끌어서 열 이동 · 클릭해서 옵션"
                      aria-label={`${c + 1}번째 열 옵션`}
                      onPointerDown={(event) => {
                        pressHandle(event, 'col', c)
                        beginDrag(event, 'col', c)
                      }}
                      onClick={(event) => clickHandle(event, 'col', c)}
                    >
                      <span className="table-block__grip table-block__grip--col" />
                    </button>
                    <span
                      className="table-block__resizer"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`${c + 1}번째 열 너비 조절`}
                      onPointerDown={(event) => startResize(event, c)}
                    />
                  </div>
                ))}
              </div>

              {/*
                본문. 병합 셀이 여러 행·열을 차지할 수 있도록 grid 로 깐다.
                행마다 행 전체를 덮는 띠(__row)를 셀 아래에 깔아 손잡이·선택 테두리·삽입선을 그린다.
              */}
              <div
                className="table-block__rows"
                style={{ gridTemplateColumns: columns.map((_column, c) => `${widthOf(c)}px`).join(' ') }}
              >
                {rows.map((row, r) => (
                  <Fragment key={row.id}>
                    <div
                      className={rowClassOf(r)}
                      data-row-index={r}
                      style={{ gridRow: r + 1, gridColumn: '1 / -1' }}
                    >
                      <div
                        className="table-block__row-handle-wrap"
                        onPointerEnter={() => {
                          if (!drag) setHoverRow(r)
                        }}
                      >
                        <button
                          type="button"
                          className={handleClassOf('row', r, 'table-block__handle--row')}
                          title="끌어서 행 이동 · 클릭해서 옵션"
                          aria-label={`${r + 1}번째 행 옵션`}
                          onPointerDown={(event) => {
                            pressHandle(event, 'row', r)
                            beginDrag(event, 'row', r)
                          }}
                          onClick={(event) => {
                            clickHandle(event, 'row', r)
                          }}
                        >
                          <span className="table-block__grip table-block__grip--row" />
                        </button>
                      </div>
                    </div>

                    {row.cells.map((cell, c) => {
                      // 병합으로 가려진 셀은 그리지 않는다. (왼쪽 위 셀이 그 자리까지 차지한다)
                      if (isCoveredCell(table, r, c)) return null
                      const { rowSpan, colSpan } = spanOf(table, r, c)
                      const isHeader = (headerRow && r === 0) || (headerColumn && c === 0)
                      const cellBackground = colorValueOf(row.color) ?? colorValueOf(columns[c].color)
                      const dragging =
                        (drag?.axis === 'col' && drag.from === c) || (drag?.axis === 'row' && drag.from === r)
                      const classes = [
                        'table-block__cell',
                        isHeader ? 'table-block__cell--header' : '',
                        dragging ? 'table-block__cell--dragging' : '',
                        isSelected(r, c) ? 'table-block__cell--selected' : '',
                      ]
                      return (
                        <div
                          key={columns[c].id}
                          className={classes.filter(Boolean).join(' ')}
                          data-cell-pos={`${r}:${c}`}
                          style={{
                            gridRow: `${r + 1} / span ${rowSpan}`,
                            gridColumn: `${c + 1} / span ${colSpan}`,
                            ...(cellBackground ? { background: cellBackground } : {}),
                          }}
                          onPointerEnter={() => {
                            if (drag) return
                            setHoverCol(c)
                            setHoverRow(r)
                          }}
                          onPointerDown={(event) => {
                            pressCell(event, { row: r, column: c })
                            // 셀 여백을 눌러도 입력이 시작되도록 한다.
                            if (event.target === event.currentTarget && !event.shiftKey) findCell(r, c)?.focus()
                          }}
                          onMouseDown={(event) => shiftClickCell(event, { row: r, column: c })}
                        >
                          {/*
                            열 경계 너비 조절. 셀마다 오른쪽 가장자리에 둔다.
                            (표 전체 높이로 깔면 여러 열을 합친 셀 한가운데를 눌러도 너비 조절이 잡힌다)
                          */}
                          {c + colSpan - 1 < columns.length - 1 && (
                            <span
                              className="table-block__resizer-zone table-block__resizer-zone--cell"
                              role="separator"
                              aria-orientation="vertical"
                              aria-label={`${c + colSpan + 1}번째 열 경계 너비 조절`}
                              onPointerDown={(event) => startResize(event, c + colSpan - 1)}
                            />
                          )}
                          <TableCellInput
                            value={cell}
                            cellKey={`${r}:${c}`}
                            isHeader={isHeader}
                            placeholder={headerRow && r === 0 ? '제목' : ''}
                            onChange={(text) => onChange(setCell(table, r, c, text))}
                            onKeyDown={(event) => {
                              // 편집 중 Esc 는 이 셀을 선택 상태로 바꾼다. (노션과 같이 이어서 병합·지우기를 할 수 있게)
                              if (event.key === 'Escape') {
                                event.preventDefault()
                                selectCells({ row: r, column: c })
                                return
                              }
                              handleCellKeyDown(event, r, c)
                            }}
                            onFocus={() => {
                              setFocusCell({ row: r, column: c })
                              onFocus?.()
                            }}
                            onBlur={() => setFocusCell(null)}
                          />
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>

              {/* 선택한 셀 범위 테두리 */}
              {selBox && (
                <div className="table-block__selection" style={selBox.outline} aria-hidden />
              )}

              {/* 선택된 열 테두리 — 행은 .table-block__row--selected 가 그린다 */}
              {selectedCol !== null && (
                <div
                  className="table-block__col-outline"
                  style={{ left: leftOf(selectedCol), width: widthOf(selectedCol) }}
                />
              )}

              {/* 열 삽입 표시선 */}
              {showColumnDrop && <div className="table-block__drop-col" style={{ left: dropColumnLeft }} />}
            </div>

            <button
              type="button"
              className="table-block__add table-block__add--col"
              title="열 추가"
              aria-label="열 추가"
              onClick={() => apply(insertColumn(table, columns.length), { row: 0, column: columns.length })}
            >
              +
            </button>
          </div>

          <button
            type="button"
            className="table-block__add table-block__add--row"
            style={{ width: totalWidth }}
            title="행 추가"
            aria-label="행 추가"
            onClick={() => apply(insertRow(table, rows.length), { row: rows.length, column: 0 })}
          >
            +
          </button>
        </div>
      </div>

      {ghost && (
        <div
          className={`table-block__ghost table-block__ghost--${ghost.axis}`}
          style={{ left: ghost.x, top: ghost.y }}
          aria-hidden
        >
          {ghostCells.map((cell) => (
            <div
              key={cell.key}
              className={`table-block__ghost-cell${cell.isHeader ? ' table-block__ghost-cell--header' : ''
                }`}
              style={{ width: cell.width }}
            >
              {cell.text}
            </div>
          ))}
        </div>
      )}

      {selRange && (
        <div
          ref={selBarRef}
          className="table-block__cell-bar"
          style={selBox ? selBox.bar : { visibility: 'hidden' }}
          role="toolbar"
          aria-label="선택한 셀"
          onMouseDown={(event) => event.preventDefault()}
        >
          <span className="table-block__cell-bar-count">
            {selRange.bottom - selRange.top + 1} × {selRange.right - selRange.left + 1}
          </span>
          <button
            type="button"
            disabled={selIsSingle}
            title="선택한 셀을 하나로 합치기"
            onClick={() => {
              const next = mergeCells(table, selRange)
              apply(next)
              selectCells({ row: selRange.top, column: selRange.left })
            }}
          >
            셀 병합
          </button>
          <button
            type="button"
            disabled={!selHasMerge}
            title="병합한 셀을 다시 나누기"
            onClick={() => apply(unmergeCells(table, selRange))}
          >
            병합 해제
          </button>
          <button type="button" title="선택한 셀의 내용 지우기 (Delete)" onClick={() => apply(clearCells(table, selRange))}>
            내용 지우기
          </button>
        </div>
      )}

      {menu && (
        <div
          className="table-block__menu"
          role="menu"
          ref={menuRef}
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.target === 'col' && (
            <ColMenu/>
          )}

          {menu.target === 'row' && (
            <RowMenu/>
          )}
        </div>
      )}
    </div>
  )
}
