/** 직렬화: Span[] → 마크다운 문자열 */

import { parseInline } from './parse'
import {
  copySpan,
  DELIMITERS,
  ESCAPABLE,
  MARKS,
  sameStyle,
  WRAP_KINDS,
  type Mark,
  type Span,
  type WrapKind,
} from './types'

/** 이웃한 같은 서식 조각을 합치고, 서식 가장자리의 공백은 서식 밖으로 뺀다. (`** a**` 는 해석되지 않으므로) */
export function normalizeSpans(spans: Span[]): Span[] {
  const pieces: Span[] = []
  for (const span of mergeSpans(spans)) {
    const hasDelimiter = span.marks.some((mark) => mark !== 'code')
    if (!hasDelimiter) {
      pieces.push(span)
      continue
    }
    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(span.text)!
    const bareMarks = span.marks.filter((mark) => mark === 'code')
    if (match[1]) pieces.push(copySpan(span, match[1], bareMarks))
    if (match[2]) pieces.push(copySpan(span, match[2]))
    if (match[3]) pieces.push(copySpan(span, match[3], bareMarks))
  }
  return mergeSpans(pieces)
}

function mergeSpans(spans: Span[]): Span[] {
  const merged: Span[] = []
  for (const span of spans) {
    if (!span.text) continue
    const last = merged[merged.length - 1]
    // 코드 안의 백틱은 표현할 수 없으므로 비슷한 글자로 바꾼다.
    const next = copySpan(span, span.marks.includes('code') ? span.text.replace(/`/g, 'ˋ') : span.text)
    if (last && sameStyle(last, next)) last.text += next.text
    else merged.push(next)
  }
  return merged
}

type Token = { kind: 'mark'; mark: Mark } | { kind: WrapKind; value: string }

const tokenKey = (token: Token) => (token.kind === 'mark' ? token.mark : `${token.kind}:${token.value}`)

function openToken(token: Token) {
  if (token.kind !== 'mark') return token.kind === 'href' ? '[' : `{${token.kind}:${token.value}}`
  return token.mark === 'code' ? '`' : DELIMITERS[token.mark]
}

function closeToken(token: Token) {
  if (token.kind !== 'mark') return token.kind === 'href' ? `](${token.value})` : `{/${token.kind}}`
  return token.mark === 'code' ? '`' : DELIMITERS[token.mark]
}

/**
 * 조각 목록을 열고 닫는 기호로 바꾼다. 이웃 조각과 겹치는 서식은 이어서 연다.
 * `order` 는 서식을 여는 순서(바깥 → 안쪽)다.
 */
function emit(spans: Span[], order: Mark[]): { md: string; map: number[] } {
  let md = ''
  const map: number[] = []
  const stack: Token[] = []

  for (const span of spans) {
    const wanted: Token[] = []
    for (const kind of WRAP_KINDS) {
      const value = span[kind]
      if (value) wanted.push({ kind, value })
    }
    for (const mark of order) if (span.marks.includes(mark)) wanted.push({ kind: 'mark', mark })

    let common = 0
    while (common < stack.length && common < wanted.length && tokenKey(stack[common]) === tokenKey(wanted[common])) {
      common += 1
    }
    while (stack.length > common) md += closeToken(stack.pop()!)
    for (const token of wanted.slice(common)) {
      md += openToken(token)
      stack.push(token)
    }

    const literal = span.marks.includes('code')
    for (const char of span.text) {
      if (!literal && ESCAPABLE.has(char)) md += '\\'
      map.push(md.length)
      md += char
    }
  }
  while (stack.length) md += closeToken(stack.pop()!)
  return { md, map }
}

export function runsMatchSpans(runs: Span[], spans: Span[]) {
  return runs.length === spans.length && runs.every((run, i) => run.text === spans[i].text && sameStyle(run, spans[i]))
}

const EMIT_ORDERS: Mark[][] = [
  MARKS,
  ['italic', 'bold', 'underline', 'strike', 'code'],
  ['underline', 'strike', 'bold', 'italic', 'code'],
  ['strike', 'underline', 'italic', 'bold', 'code'],
]

/**
 * 조각 목록 → 마크다운.
 * `map[p]` 는 화면 글자 p 가 마크다운에서 놓인 위치다.
 * `*` 와 `**` 가 붙으면 해석이 갈릴 수 있으므로, 다시 파싱했을 때 그대로 돌아오는 순서를 고른다.
 */
export function serializeInline(input: Span[]): { md: string; map: number[]; spans: Span[] } {
  const spans = normalizeSpans(input)
  let first: { md: string; map: number[] } | null = null
  for (const order of EMIT_ORDERS) {
    const result = emit(spans, order)
    if (runsMatchSpans(parseInline(result.md), spans)) return { ...result, spans }
    first ??= result
  }
  return { ...first!, spans }
}
