/** 서식 편집: 선택 구간에 서식 입히기/걷기, 블록 나누기·합치기, 글자 삽입 */

import { parseInline } from './parse'
import { mdToPlain, plainToMd } from './position'
import { serializeInline } from './serialize'
import { copySpan, splitSpans, type Mark, type Span, type WrapKind } from './types'

export type InlineEdit = { md: string; start: number; end: number }

export function spansOf(md: string): Span[] {
  return parseInline(md).map((run) => copySpan(run))
}

/** 마크다운 선택 구간 → 앞뒤 공백을 뺀 화면 구간 */
function plainRange(md: string, start: number, end: number): [number, number] | null {
  const runs = parseInline(md)
  const text = runs.map((run) => run.text).join('')
  let s = mdToPlain(runs, Math.min(start, end))
  let e = mdToPlain(runs, Math.max(start, end))
  while (s < e && /\s/.test(text[s])) s += 1
  while (e > s && /\s/.test(text[e - 1])) e -= 1
  return s === e ? null : [s, e]
}

function selectedSpans(md: string, start: number, end: number) {
  const range = plainRange(md, start, end)
  return range ? splitSpans(spansOf(md), range[0], range[1]) : null
}

function rebuild(before: Span[], middle: Span[], after: Span[]): InlineEdit {
  const { md } = serializeInline([...before, ...middle, ...after])
  const runs = parseInline(md)
  const start = before.reduce((sum, span) => sum + span.text.length, 0)
  const end = start + middle.reduce((sum, span) => sum + span.text.length, 0)
  return { md, start: plainToMd(runs, md, start, 'after', false), end: plainToMd(runs, md, end, 'before', false) }
}

export function isMarkActive(md: string, start: number, end: number, mark: Mark): boolean {
  const middle = selectedSpans(md, start, end)?.[1]
  return !!middle?.length && middle.every((span) => span.marks.includes(mark))
}

/** 선택 구간 전체가 같은 값이면 그 값을, 아니면 undefined 를 돌려준다. */
export function wrapValue(md: string, start: number, end: number, kind: WrapKind): string | undefined {
  const middle = selectedSpans(md, start, end)?.[1]
  if (!middle?.length) return undefined
  const value = middle[0][kind]
  return middle.every((span) => span[kind] === value) ? value : undefined
}

/** 선택 구간 전체에 서식이 있으면 걷어내고, 아니면 입힌다. */
export function toggleMark(md: string, start: number, end: number, mark: Mark): InlineEdit | null {
  const selected = selectedSpans(md, start, end)
  if (!selected) return null
  const [before, middle, after] = selected
  const active = middle.every((span) => span.marks.includes(mark))
  const next = middle.map((span) => {
    let marks = active ? span.marks.filter((m) => m !== mark) : [...span.marks, mark]
    // 코드 안에서는 다른 서식이 해석되지 않는다. 코드를 켜면 나머지를 끄고, 다른 서식을 켜면 코드를 끈다.
    if (!active) marks = mark === 'code' ? ['code'] : marks.filter((m) => m !== 'code')
    return copySpan(span, span.text, marks)
  })
  return rebuild(before, next, after)
}

/** 링크 주소·글자색·배경색을 입힌다. 값이 비어 있으면 걷어낸다. */
export function setWrap(md: string, start: number, end: number, kind: WrapKind, value?: string): InlineEdit | null {
  const selected = selectedSpans(md, start, end)
  if (!selected) return null
  const [before, middle, after] = selected
  const clean = value?.trim()
  const next = middle.map((span) => {
    const copy = copySpan(span)
    if (clean) copy[kind] = clean
    else delete copy[kind]
    return copy
  })
  return rebuild(before, next, after)
}

/** 선택 구간의 모든 서식(링크·색 포함)을 걷어낸다. */
export function clearMarks(md: string, start: number, end: number): InlineEdit | null {
  const selected = selectedSpans(md, start, end)
  if (!selected) return null
  const [before, middle, after] = selected
  return rebuild(before, middle.map((span) => ({ text: span.text, marks: [] })), after)
}

/**
 * 블록을 커서 위치에서 둘로 나눈다. 서식 중간에서 나눠도 양쪽 모두 서식이 유지된다.
 * (단순히 문자열을 자르면 `**ab` / `cd**` 처럼 기호가 깨진다)
 */
export function splitInline(md: string, start: number, end = start): [string, string] {
  const runs = parseInline(md)
  const s = mdToPlain(runs, Math.min(start, end))
  const e = mdToPlain(runs, Math.max(start, end))
  const [before, , after] = splitSpans(spansOf(md), s, e)
  return [serializeInline(before).md, serializeInline(after).md]
}

/**
 * 두 블록을 이어 붙인다. 이음매의 기호가 서로 엉키지 않도록 조각 단위로 합친다.
 * `caret` 은 합친 결과에서 이음매의 마크다운 위치다.
 */
export function joinInline(a: string, b: string): { md: string; caret: number } {
  const left = spansOf(a)
  const { md } = serializeInline([...left, ...spansOf(b)])
  const seam = left.reduce((sum, span) => sum + span.text.length, 0)
  return { md, caret: plainToMd(parseInline(md), md, seam, 'before', seam === 0) }
}

/** 선택 구간을 글자로 바꾼다. 새 글자는 바로 앞 글자의 서식을 이어받는다. (붙여넣기·줄바꿈) */
export function insertInline(md: string, start: number, end: number, text: string): InlineEdit {
  const runs = parseInline(md)
  const s = mdToPlain(runs, Math.min(start, end))
  const e = mdToPlain(runs, Math.max(start, end))
  const [before, , after] = splitSpans(spansOf(md), s, e)
  const style = before[before.length - 1] ?? after[0]
  const inserted = style ? copySpan(style, text) : { text, marks: [] }
  const edit = rebuild(before, [inserted], after)
  return { ...edit, start: edit.end }
}
