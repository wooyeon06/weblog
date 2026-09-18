import type { TableColumn, TableData, TableRow } from '../types'
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

  return {
    columns: nextColumns,
    rows: nextRows,
    headerRow: Boolean(table?.headerRow),
    headerColumn: Boolean(table?.headerColumn),
  }
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
  return {
    ...table,
    columns: insertAt(table.columns, index, newColumn()),
    rows: table.rows.map((row) => ({ ...row, cells: insertAt(row.cells, index, '') })),
  }
}

export function duplicateColumn(table: TableData, at: number): TableData {
  return {
    ...table,
    columns: insertAt(table.columns, at + 1, newColumn(table.columns[at].width)),
    rows: table.rows.map((row) => ({ ...row, cells: insertAt(row.cells, at + 1, row.cells[at]) })),
  }
}

export function removeColumn(table: TableData, at: number): TableData {
  if (table.columns.length <= 1) return table
  return {
    ...table,
    columns: removeAt(table.columns, at),
    rows: table.rows.map((row) => ({ ...row, cells: removeAt(row.cells, at) })),
  }
}

export function moveColumn(table: TableData, from: number, to: number): TableData {
  return {
    ...table,
    columns: moveAt(table.columns, from, to),
    rows: table.rows.map((row) => ({ ...row, cells: moveAt(row.cells, from, to) })),
  }
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
  return { ...table, rows: insertAt(table.rows, index, newRow(table.columns.length)) }
}

export function duplicateRow(table: TableData, at: number): TableData {
  return { ...table, rows: insertAt(table.rows, at + 1, newRow(table.columns.length, table.rows[at].cells)) }
}

export function removeRow(table: TableData, at: number): TableData {
  if (table.rows.length <= 1) return table
  return { ...table, rows: removeAt(table.rows, at) }
}

export function moveRow(table: TableData, from: number, to: number): TableData {
  return { ...table, rows: moveAt(table.rows, from, to) }
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