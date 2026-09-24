import type { CellMerge, TableColumn, TableData, TableRow } from '../types'
import { uid } from './id'

export const MIN_COLUMN_WIDTH = 72
export const DEFAULT_COLUMN_WIDTH = 168
export const MAX_COLUMN_WIDTH = 720

/** 열/행에 칠할 수 있는 배경색 프리셋. key 는 TableColumn/TableRow.color 에 저장된다. */
export const COLUMN_ROW_COLORS: { key: string; label: string; value?: string }[] = [
  { key: 'default', label: '기본', value: undefined },
  { key: 'gray', label: '회색', value: '#f1f1ef' },
  { key: 'brown', label: '갈색', value: '#f4eeee' },
  { key: 'orange', label: '주황', value: '#fbecdd' },
  { key: 'yellow', label: '노랑', value: '#fbf3db' },
  { key: 'green', label: '초록', value: '#edf3ec' },
  { key: 'blue', label: '파랑', value: '#e7f3f8' },
  { key: 'purple', label: '보라', value: '#f6f3f9' },
  { key: 'pink', label: '분홍', value: '#faf1f5' },
  { key: 'red', label: '빨강', value: '#fdebec' },
]

export function colorValueOf(key?: string): string | undefined {
  return COLUMN_ROW_COLORS.find((c) => c.key === key)?.value
}

/** 셀 안의 줄바꿈은 마크다운 한 줄 안에 담아야 하므로 <br> 로 바꾼다. */
const BR = '<br>'

function clampWidth(width: unknown): number {
  const value = typeof width === 'number' && Number.isFinite(width) ? width : DEFAULT_COLUMN_WIDTH
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(value)))
}

function newColumn(width = DEFAULT_COLUMN_WIDTH): TableColumn {
  return { id: uid('tc_'), width: clampWidth(width) }
}

function newRow(size: number, cells: string[] = []): TableRow {
  return { id: uid('tr_'), cells: Array.from({ length: size }, (_, i) => cells[i] ?? '') }
}

export function newTable(rowCount = 3, columnCount = 3): TableData {
  return {
    columns: Array.from({ length: columnCount }, () => newColumn()),
    rows: Array.from({ length: rowCount }, () => newRow(columnCount)),
    headerRow: true,
    headerColumn: false,
  }
}

/**
 * 저장소나 마크다운에서 들어온 값을 신뢰하지 않고 항상 직사각형으로 맞춘다.
 * (행마다 셀 개수가 다르거나 id 가 비어 있는 경우를 여기서 흡수한다)
 */
export function normalizeTable(table?: TableData | null): TableData {
  const columns = Array.isArray(table?.columns) ? table.columns : []
  const rows = Array.isArray(table?.rows) ? table.rows : []
  if (columns.length === 0 || rows.length === 0) return newTable()

  const nextColumns = columns.map((column) => ({
    id: column?.id || uid('tc_'),
    width: clampWidth(column?.width),
    color: column?.color,
  }))
  const nextRows = rows.map((row) => ({
    id: row?.id || uid('tr_'),
    cells: Array.from({ length: nextColumns.length }, (_, i) => row?.cells?.[i] ?? ''),
    color: row?.color,
  }))

  return withMerges(
    {
      columns: nextColumns,
      rows: nextRows,
      headerRow: Boolean(table?.headerRow),
      headerColumn: Boolean(table?.headerColumn),
    },
    Array.isArray(table?.merges) ? table.merges : [],
  )
}

// -------------------------------------------------------------------- 셀 병합

/** 셀 범위. 네 값 모두 포함(inclusive)이다. */
export type CellRange = { top: number; left: number; bottom: number; right: number }

const mergesOf = (table: TableData) => table.merges ?? []

const contains = (m: CellMerge, r: number, c: number) =>
  r >= m.row && r < m.row + m.rowSpan && c >= m.col && c < m.col + m.colSpan

const intersects = (m: CellMerge, range: CellRange) =>
  m.row <= range.bottom && m.row + m.rowSpan - 1 >= range.top && m.col <= range.right && m.col + m.colSpan - 1 >= range.left

/** (r, c) 를 덮는 병합. 없으면 undefined */
export function mergeAt(table: TableData, r: number, c: number): CellMerge | undefined {
  return mergesOf(table).find((m) => contains(m, r, c))
}

/** 다른 셀에 가려져 그리지 않는 셀인지 (병합의 왼쪽 위 셀은 아니다) */
export function isCoveredCell(table: TableData, r: number, c: number): boolean {
  const merge = mergeAt(table, r, c)
  return !!merge && (merge.row !== r || merge.col !== c)
}

export function spanOf(table: TableData, r: number, c: number): { rowSpan: number; colSpan: number } {
  const merge = mergeAt(table, r, c)
  return merge && merge.row === r && merge.col === c
    ? { rowSpan: merge.rowSpan, colSpan: merge.colSpan }
    : { rowSpan: 1, colSpan: 1 }
}

/** 두 셀을 모서리로 하는 범위. 걸쳐 있는 병합 셀은 통째로 들어가도록 넓힌다. */
export function rangeOf(table: TableData, a: { row: number; column: number }, b: { row: number; column: number }): CellRange {
  const range: CellRange = {
    top: Math.min(a.row, b.row),
    left: Math.min(a.column, b.column),
    bottom: Math.max(a.row, b.row),
    right: Math.max(a.column, b.column),
  }
  let grown = true
  while (grown) {
    grown = false
    for (const m of mergesOf(table)) {
      if (!intersects(m, range)) continue
      const next = {
        top: Math.min(range.top, m.row),
        left: Math.min(range.left, m.col),
        bottom: Math.max(range.bottom, m.row + m.rowSpan - 1),
        right: Math.max(range.right, m.col + m.colSpan - 1),
      }
      if (next.top !== range.top || next.left !== range.left || next.bottom !== range.bottom || next.right !== range.right) {
        Object.assign(range, next)
        grown = true
      }
    }
  }
  return range
}

/** 범위가 병합 셀 하나와 정확히 같으면 그 병합 */
export function mergeOfRange(table: TableData, range: CellRange): CellMerge | undefined {
  return mergesOf(table).find(
    (m) => m.row === range.top && m.col === range.left && m.row + m.rowSpan - 1 === range.bottom && m.col + m.colSpan - 1 === range.right,
  )
}

/** 범위를 셀 하나로 합친다. 내용은 비어 있지 않은 셀을 줄바꿈으로 이어 왼쪽 위 셀에 모은다. */
export function mergeCells(table: TableData, range: CellRange): TableData {
  if (range.top === range.bottom && range.left === range.right) return table
  const texts: string[] = []
  for (let r = range.top; r <= range.bottom; r += 1) {
    for (let c = range.left; c <= range.right; c += 1) {
      const text = table.rows[r]?.cells[c]
      if (text) texts.push(text)
    }
  }
  const rows = table.rows.map((row, r) => {
    if (r < range.top || r > range.bottom) return row
    return {
      ...row,
      cells: row.cells.map((cell, c) => {
        if (c < range.left || c > range.right) return cell
        return r === range.top && c === range.left ? texts.join('\n') : ''
      }),
    }
  })
  const merges = mergesOf(table).filter((m) => !intersects(m, range))
  merges.push({
    row: range.top,
    col: range.left,
    rowSpan: range.bottom - range.top + 1,
    colSpan: range.right - range.left + 1,
  })
  return withMerges({ ...table, rows }, merges)
}

/** 범위에 걸친 병합을 모두 푼다. 내용은 왼쪽 위 셀에 그대로 남는다. */
export function unmergeCells(table: TableData, range: CellRange): TableData {
  return withMerges(table, mergesOf(table).filter((m) => !intersects(m, range)))
}

/** 범위 안 셀의 내용만 비운다. */
export function clearCells(table: TableData, range: CellRange): TableData {
  return {
    ...table,
    rows: table.rows.map((row, r) =>
      r < range.top || r > range.bottom
        ? row
        : { ...row, cells: row.cells.map((cell, c) => (c >= range.left && c <= range.right ? '' : cell)) },
    ),
  }
}

/**
 * 병합 목록을 정리해 붙인다: 표 밖으로 나가는 부분은 자르고, 1×1 은 버리고, 겹치면 앞의 것을 남긴다.
 * 가려진 셀의 내용은 비운다. (화면에 안 보이는 글자가 남지 않게)
 */
function withMerges(table: TableData, merges: CellMerge[]): TableData {
  const rowCount = table.rows.length
  const columnCount = table.columns.length
  const kept: CellMerge[] = []
  for (const raw of merges) {
    const row = Math.floor(Number(raw?.row))
    const col = Math.floor(Number(raw?.col))
    if (!(row >= 0 && row < rowCount && col >= 0 && col < columnCount)) continue
    const merge: CellMerge = {
      row,
      col,
      rowSpan: Math.max(1, Math.min(Math.floor(Number(raw.rowSpan)) || 1, rowCount - row)),
      colSpan: Math.max(1, Math.min(Math.floor(Number(raw.colSpan)) || 1, columnCount - col)),
    }
    if (merge.rowSpan === 1 && merge.colSpan === 1) continue
    const box = { top: row, left: col, bottom: row + merge.rowSpan - 1, right: col + merge.colSpan - 1 }
    if (kept.some((m) => intersects(m, box))) continue
    kept.push(merge)
  }

  const next: TableData = { ...table }
  if (kept.length) next.merges = kept
  else delete next.merges
  if (!kept.length) return next

  next.rows = table.rows.map((row, r) => {
    if (!kept.some((m) => r >= m.row && r < m.row + m.rowSpan)) return row
    return {
      ...row,
      cells: row.cells.map((cell, c) => {
        const m = kept.find((k) => contains(k, r, c))
        return m && (m.row !== r || m.col !== c) ? '' : cell
      }),
    }
  })
  return next
}

/** 줄(행 또는 열) 하나를 at 위치에 끼워 넣었을 때 병합을 맞춘다. 병합 안쪽에 끼우면 그만큼 늘어난다. */
function shiftForInsert(merges: CellMerge[], axis: 'row' | 'col', at: number): CellMerge[] {
  return merges.map((m) => {
    const start = axis === 'row' ? m.row : m.col
    const span = axis === 'row' ? m.rowSpan : m.colSpan
    if (start >= at) return axis === 'row' ? { ...m, row: m.row + 1 } : { ...m, col: m.col + 1 }
    if (at < start + span) return axis === 'row' ? { ...m, rowSpan: m.rowSpan + 1 } : { ...m, colSpan: m.colSpan + 1 }
    return m
  })
}

/**
 * 줄 하나를 지웠을 때 병합을 맞춘다.
 * 병합의 첫 줄이 지워지면 다음 줄이 왼쪽 위 셀이 되므로 내용을 그리로 옮긴다.
 */
function shiftForRemove(table: TableData, axis: 'row' | 'col', at: number): TableData {
  let rows = table.rows
  const merges: CellMerge[] = []
  for (const m of mergesOf(table)) {
    const start = axis === 'row' ? m.row : m.col
    const span = axis === 'row' ? m.rowSpan : m.colSpan
    if (start > at) {
      merges.push(axis === 'row' ? { ...m, row: m.row - 1 } : { ...m, col: m.col - 1 })
    } else if (start + span - 1 < at) {
      merges.push(m)
    } else if (span > 1) {
      merges.push(axis === 'row' ? { ...m, rowSpan: m.rowSpan - 1 } : { ...m, colSpan: m.colSpan - 1 })
      if (start === at) {
        // 지워지기 전 표 기준: 원래 왼쪽 위 셀의 내용을 다음 줄의 같은 자리로 옮긴다.
        const text = table.rows[m.row].cells[m.col]
        const target = axis === 'row' ? { r: m.row + 1, c: m.col } : { r: m.row, c: m.col + 1 }
        rows = rows.map((row, r) =>
          r === target.r ? { ...row, cells: row.cells.map((cell, c) => (c === target.c ? text : cell)) } : row,
        )
      }
    }
  }
  return { ...table, rows, merges }
}

/** 줄 순서를 바꿨을 때 병합을 맞춘다. 병합한 줄들이 흩어지면 그 병합은 푼다. */
function remapMerges(merges: CellMerge[], axis: 'row' | 'col', newIndexOf: (old: number) => number): CellMerge[] {
  return merges.flatMap((m) => {
    const start = axis === 'row' ? m.row : m.col
    const span = axis === 'row' ? m.rowSpan : m.colSpan
    const first = newIndexOf(start)
    for (let k = 1; k < span; k += 1) if (newIndexOf(start + k) !== first + k) return []
    return [axis === 'row' ? { ...m, row: first } : { ...m, col: first }]
  })
}

function moveIndexMap(length: number, from: number, to: number): (old: number) => number {
  const order = moveAt(Array.from({ length }, (_, i) => i), from, to)
  const newIndex = new Array<number>(length)
  order.forEach((old, index) => {
    newIndex[old] = index
  })
  return (old) => newIndex[old]
}

// ------------------------------------------------------------------ 배열 유틸

function insertAt<T>(list: T[], index: number, item: T): T[] {
  const next = list.slice()
  next.splice(index, 0, item)
  return next
}

function removeAt<T>(list: T[], index: number): T[] {
  const next = list.slice()
  next.splice(index, 1)
  return next
}

/** to 는 "제거 전" 배열 기준의 삽입 위치. (블록 드래그와 같은 규칙) */
function moveAt<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to > from ? to - 1 : to, 0, moved)
  return next
}

// -------------------------------------------------------------------- 열 편집

export function insertColumn(table: TableData, at: number): TableData {
  const index = Math.max(0, Math.min(at, table.columns.length))
  return withMerges(
    {
      ...table,
      columns: insertAt(table.columns, index, newColumn()),
      rows: table.rows.map((row) => ({ ...row, cells: insertAt(row.cells, index, '') })),
    },
    shiftForInsert(mergesOf(table), 'col', index),
  )
}

export function duplicateColumn(table: TableData, at: number): TableData {
  return withMerges(
    {
      ...table,
      columns: insertAt(table.columns, at + 1, newColumn(table.columns[at].width)),
      rows: table.rows.map((row) => ({ ...row, cells: insertAt(row.cells, at + 1, row.cells[at]) })),
    },
    shiftForInsert(mergesOf(table), 'col', at + 1),
  )
}

export function removeColumn(table: TableData, at: number): TableData {
  if (table.columns.length <= 1) return table
  const shifted = shiftForRemove(table, 'col', at)
  return withMerges(
    {
      ...shifted,
      columns: removeAt(table.columns, at),
      rows: shifted.rows.map((row) => ({ ...row, cells: removeAt(row.cells, at) })),
    },
    mergesOf(shifted),
  )
}

export function moveColumn(table: TableData, from: number, to: number): TableData {
  return withMerges(
    {
      ...table,
      columns: moveAt(table.columns, from, to),
      rows: table.rows.map((row) => ({ ...row, cells: moveAt(row.cells, from, to) })),
    },
    remapMerges(mergesOf(table), 'col', moveIndexMap(table.columns.length, from, to)),
  )
}

export function resizeColumn(table: TableData, at: number, width: number): TableData {
  return {
    ...table,
    columns: table.columns.map((column, i) => (i === at ? { ...column, width: clampWidth(width) } : column)),
  }
}

export function setColumnColor(table: TableData, at: number, color?: string): TableData {
  return {
    ...table,
    columns: table.columns.map((column, i) => (i === at ? { ...column, color } : column)),
  }
}

/** 열 구조는 그대로 두고 셀 내용만 비운다. */
export function clearColumn(table: TableData, at: number): TableData {
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell, c) => (c === at ? '' : cell)),
    })),
  }
}

// -------------------------------------------------------------------- 행 편집

export function insertRow(table: TableData, at: number): TableData {
  const index = Math.max(0, Math.min(at, table.rows.length))
  return withMerges(
    { ...table, rows: insertAt(table.rows, index, newRow(table.columns.length)) },
    shiftForInsert(mergesOf(table), 'row', index),
  )
}

export function duplicateRow(table: TableData, at: number): TableData {
  return withMerges(
    { ...table, rows: insertAt(table.rows, at + 1, newRow(table.columns.length, table.rows[at].cells)) },
    shiftForInsert(mergesOf(table), 'row', at + 1),
  )
}

export function removeRow(table: TableData, at: number): TableData {
  if (table.rows.length <= 1) return table
  const shifted = shiftForRemove(table, 'row', at)
  return withMerges({ ...shifted, rows: removeAt(shifted.rows, at) }, mergesOf(shifted))
}

export function moveRow(table: TableData, from: number, to: number): TableData {
  return withMerges(
    { ...table, rows: moveAt(table.rows, from, to) },
    remapMerges(mergesOf(table), 'row', moveIndexMap(table.rows.length, from, to)),
  )
}

export function setRowColor(table: TableData, at: number, color?: string): TableData {
  return { ...table, rows: table.rows.map((row, i) => (i === at ? { ...row, color } : row)) }
}

/** 행 구조는 그대로 두고 셀 내용만 비운다. */
export function clearRow(table: TableData, at: number): TableData {
  return {
    ...table,
    rows: table.rows.map((row, r) => (r === at ? { ...row, cells: row.cells.map(() => '') } : row)),
  }
}

export function setCell(table: TableData, rowIndex: number, columnIndex: number, text: string): TableData {
  return {
    ...table,
    rows: table.rows.map((row, r) =>
      r === rowIndex ? { ...row, cells: row.cells.map((cell, c) => (c === columnIndex ? text : cell)) } : row,
    ),
  }
}

// ------------------------------------------------------------------- 마크다운

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, BR).trim()
}

function unescapeCell(text: string): string {
  return text.trim().replace(/<br\s*\/?>/gi, '\n').replace(/\\\|/g, '|')
}

/** `\|` 는 셀 구분자가 아니므로 건너뛰고 자른다. */
function splitMarkdownRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return inner.split(/(?<!\\)\|/).map(unescapeCell)
}

/**
 * GFM 표로 직렬화한다.
 * GFM 은 머리글 행이 필수라, 머리글이 꺼져 있으면 빈 머리글을 내보낸다.
 * (파서 쪽에서 빈 머리글을 headerRow: false 로 되돌리므로 왕복해도 값이 유지된다)
 */
export function tableToMarkdown(table?: TableData | null): string {
  const data = normalizeTable(table)
  const width = data.columns.length
  const header = data.headerRow ? data.rows[0].cells : Array.from({ length: width }, () => '')
  const body = data.headerRow ? data.rows.slice(1) : data.rows

  return [
    `| ${header.map(escapeCell).join(' | ')} |`,
    `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.cells.map(escapeCell).join(' | ')} |`),
  ].join('\n')
}

/**
 * lines[start] 부터 GFM 표를 읽는다. 표가 아니면 null.
 * @returns 파싱한 표와, 표가 끝난 다음 줄의 인덱스
 */
export function parseMarkdownTable(
  lines: string[],
  start: number,
): { table: TableData; next: number } | null {
  const headerLine = lines[start]?.trim() ?? ''
  const dividerLine = lines[start + 1]?.trim() ?? ''
  if (!headerLine.startsWith('|') || !dividerLine.startsWith('|')) return null

  const header = splitMarkdownRow(headerLine)
  const divider = splitMarkdownRow(dividerLine)
  if (divider.length !== header.length) return null
  if (!divider.every((cell) => /^:?-+:?$/.test(cell))) return null

  const body: string[][] = []
  let next = start + 2
  for (; next < lines.length; next += 1) {
    const line = lines[next].trim()
    if (!line.startsWith('|')) break
    body.push(splitMarkdownRow(line))
  }

  const headerRow = header.some((cell) => cell !== '')
  const cellRows = headerRow ? [header, ...body] : body
  if (cellRows.length === 0) cellRows.push(header.map(() => ''))

  return {
    table: normalizeTable({
      columns: header.map(() => ({ id: '', width: DEFAULT_COLUMN_WIDTH })),
      rows: cellRows.map((cells) => ({ id: '', cells })),
      headerRow,
      headerColumn: false,
    }),
    next,
  }
}

export function tableToPlainText(table?: TableData | null): string {
  return normalizeTable(table)
    .rows.map((row) => row.cells.filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' ')
}