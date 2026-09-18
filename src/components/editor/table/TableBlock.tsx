import './TableBlock.scss'

import { useContext, useEffect, useRef, useState } from 'react'
import { useTableEventHandler } from '../../../hooks/useTableEventHandler'
import {
  clearColumn,
  clearRow,
  colorValueOf,
  COLUMN_ROW_COLORS,
  duplicateColumn,
  duplicateRow,
  insertColumn,
  insertRow,
  removeColumn,
  removeRow,
  setCell,
  setColumnColor,
  setRowColor,
} from '../../../lib/table'
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconChevronRight,
  IconColor,
  IconCopy,
  IconEraser,
  IconHeader,
  IconTrash,
} from './TableMenuIcons'
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
  /** 메뉴 안에서 펼쳐진 색상 선택 아코디언. 메뉴가 바뀌면(닫히거나 다른 행/열로) 접는다. */
  const [colorMenuFor, setColorMenuFor] = useState<Axis | null>(null)
  useEffect(() => setColorMenuFor(null), [menu])

  const { columns, rows, headerRow, headerColumn } = table
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

  const handleClassOf = (axis: Axis, index: number, extra = '') => {
    const active = axis === 'col' ? activeCol : activeRow
    const selected = axis === 'col' ? selectedCol : selectedRow
    return [
      'table-block__handle',
      extra,
      active === index ? 'table-block__handle--show' : '',
      selected === index ? 'table-block__handle--on' : '',
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
              {/* 왼쪽 위 모서리 — 머리글 설정 */}
              <div className="table-block__corner-wrap">
                <button
                  type="button"
                  className={`table-block__handle table-block__handle--corner${
                    menu?.target === 'corner' ? ' table-block__handle--on' : ''
                  }`}
                  title="표 옵션"
                  aria-label="표 옵션"
                  onPointerDown={(event) => pressHandle(event, 'corner', 0)}
                  onClick={(event) => clickHandle(event, 'corner', 0)}
                >
                  <span className="table-block__grip table-block__grip--corner" />
                </button>
              </div>

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

              {columns.slice(0, -1).map((column, c) => (
                <span
                  key={`resize-zone-${column.id}`}
                  className="table-block__resizer-zone"
                  style={{ left: leftOf(c) + widthOf(c) - 4 }}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`${c + 2}번째 열 경계 너비 조절`}
                  onPointerDown={(event) => startResize(event, c)}
                />
              ))}

              {/* 본문 */}
              <div className="table-block__rows">
                {rows.map((row, r) => (
                  <div
                    key={row.id}
                    className={rowClassOf(r)}
                    data-row-index={r}
                    onPointerEnter={() => {
                      if (!drag) setHoverRow(r)
                    }}
                  >
                    <div className="table-block__row-handle-wrap">
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

                    {row.cells.map((cell, c) => {
                      const isHeader = (headerRow && r === 0) || (headerColumn && c === 0)
                      const cellBackground = colorValueOf(row.color) ?? colorValueOf(columns[c].color)
                      return (
                        <div
                          key={columns[c].id}
                          className={`table-block__cell${isHeader ? ' table-block__cell--header' : ''}${
                            drag?.axis === 'col' && drag.from === c ? ' table-block__cell--dragging' : ''
                          }`}
                          style={{ width: widthOf(c), ...(cellBackground ? { background: cellBackground } : {}) }}
                          onPointerEnter={() => {
                            if (!drag) setHoverCol(c)
                          }}
                          // 셀 여백을 눌러도 입력이 시작되도록 한다.
                          onPointerDown={(event) => {
                            if (event.target === event.currentTarget) findCell(r, c)?.focus()
                          }}
                        >
                          <TableCellInput
                            value={cell}
                            cellKey={`${r}:${c}`}
                            isHeader={isHeader}
                            placeholder={headerRow && r === 0 ? '제목' : ''}
                            width={widthOf(c)}
                            onChange={(text) => onChange(setCell(table, r, c, text))}
                            onKeyDown={(event) => handleCellKeyDown(event, r, c)}
                            onFocus={() => {
                              setFocusCell({ row: r, column: c })
                              onFocus?.()
                            }}
                            onBlur={() => setFocusCell(null)}
                          />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

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
              className={`table-block__ghost-cell${
                cell.isHeader ? ' table-block__ghost-cell--header' : ''
              }`}
              style={{ width: cell.width }}
            >
              {cell.text}
            </div>
          ))}
        </div>
      )}

      {menu && (
        <div
          className="table-block__menu"
          role="menu"
          ref={menuRef}
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.target === 'corner' && (
            <>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={headerRow}
                onClick={() => apply({ ...table, headerRow: !headerRow })}
              >
                <span className="table-block__check">{headerRow ? '✓' : ''}</span>
                머리글 행
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={headerColumn}
                onClick={() => apply({ ...table, headerColumn: !headerColumn })}
              >
                <span className="table-block__check">{headerColumn ? '✓' : ''}</span>
                머리글 열
              </button>
            </>
          )}

          {menu.target === 'col' && (
            <>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={headerColumn}
                onClick={() => apply({ ...table, headerColumn: !headerColumn })}
              >
                <span className="table-block__menu-icon"><IconHeader /></span>
                머리글 열
                <span className={`table-block__switch${headerColumn ? ' table-block__switch--on' : ''}`}>
                  <span className="table-block__switch-thumb" />
                </span>
              </button>

              <button
                type="button"
                aria-expanded={colorMenuFor === 'col'}
                onClick={() => setColorMenuFor((prev) => (prev === 'col' ? null : 'col'))}
              >
                <span className="table-block__menu-icon"><IconColor /></span>
                색
                <span className="table-block__menu-chevron"><IconChevronRight /></span>
              </button>
              {colorMenuFor === 'col' && (
                <div className="table-block__menu-colors">
                  {COLUMN_ROW_COLORS.map((c) => {
                    const active = (columns[menu.index].color ?? 'default') === c.key
                    return (
                      <button
                        key={c.key}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        title={c.label}
                        className={`table-block__color-swatch${active ? ' table-block__color-swatch--on' : ''}`}
                        style={{ background: c.value ?? 'var(--surface)' }}
                        onClick={() => apply(setColumnColor(table, menu.index, c.key === 'default' ? undefined : c.key))}
                      />
                    )
                  })}
                </div>
              )}

              <div className="table-block__menu-sep" />

              <button type="button" role="menuitem" onClick={() => apply(insertColumn(table, menu.index), { row: 0, column: menu.index })}>
                <span className="table-block__menu-icon"><IconArrowLeft /></span>
                왼쪽에 삽입
              </button>
              <button type="button" role="menuitem" onClick={() => apply(insertColumn(table, menu.index + 1), { row: 0, column: menu.index + 1 })}>
                <span className="table-block__menu-icon"><IconArrowRight /></span>
                오른쪽에 삽입
              </button>
              <button type="button" role="menuitem" onClick={() => apply(duplicateColumn(table, menu.index))}>
                <span className="table-block__menu-icon"><IconCopy /></span>
                복제
                <span className="table-block__menu-shortcut">Ctrl+D</span>
              </button>
              <button type="button" role="menuitem" onClick={() => apply(clearColumn(table, menu.index))}>
                <span className="table-block__menu-icon"><IconEraser /></span>
                콘텐츠 삭제
              </button>
              <button
                type="button"
                role="menuitem"
                className="table-block__menu-danger"
                disabled={columns.length <= 1}
                onClick={() => apply(removeColumn(table, menu.index))}
              >
                <span className="table-block__menu-icon"><IconTrash /></span>
                삭제
              </button>
            </>
          )}

          {menu.target === 'row' && (
            <>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={headerRow}
                onClick={() => apply({ ...table, headerRow: !headerRow })}
              >
                <span className="table-block__menu-icon"><IconHeader /></span>
                머리글 행
                <span className={`table-block__switch${headerRow ? ' table-block__switch--on' : ''}`}>
                  <span className="table-block__switch-thumb" />
                </span>
              </button>

              <button
                type="button"
                aria-expanded={colorMenuFor === 'row'}
                onClick={() => setColorMenuFor((prev) => (prev === 'row' ? null : 'row'))}
              >
                <span className="table-block__menu-icon"><IconColor /></span>
                색
                <span className="table-block__menu-chevron"><IconChevronRight /></span>
              </button>
              {colorMenuFor === 'row' && (
                <div className="table-block__menu-colors">
                  {COLUMN_ROW_COLORS.map((c) => {
                    const active = (rows[menu.index].color ?? 'default') === c.key
                    return (
                      <button
                        key={c.key}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        title={c.label}
                        className={`table-block__color-swatch${active ? ' table-block__color-swatch--on' : ''}`}
                        style={{ background: c.value ?? 'var(--surface)' }}
                        onClick={() => apply(setRowColor(table, menu.index, c.key === 'default' ? undefined : c.key))}
                      />
                    )
                  })}
                </div>
              )}

              <div className="table-block__menu-sep" />

              <button type="button" role="menuitem" onClick={() => apply(insertRow(table, menu.index), { row: menu.index, column: 0 })}>
                <span className="table-block__menu-icon"><IconArrowUp /></span>
                위에 삽입
              </button>
              <button type="button" role="menuitem" onClick={() => apply(insertRow(table, menu.index + 1), { row: menu.index + 1, column: 0 })}>
                <span className="table-block__menu-icon"><IconArrowDown /></span>
                아래에 삽입
              </button>
              <button type="button" role="menuitem" onClick={() => apply(duplicateRow(table, menu.index))}>
                <span className="table-block__menu-icon"><IconCopy /></span>
                복제
                <span className="table-block__menu-shortcut">Ctrl+D</span>
              </button>
              <button type="button" role="menuitem" onClick={() => apply(clearRow(table, menu.index))}>
                <span className="table-block__menu-icon"><IconEraser /></span>
                콘텐츠 삭제
              </button>
              <button
                type="button"
                role="menuitem"
                className="table-block__menu-danger"
                disabled={rows.length <= 1}
                onClick={() => apply(removeRow(table, menu.index))}
              >
                <span className="table-block__menu-icon"><IconTrash /></span>
                삭제
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
