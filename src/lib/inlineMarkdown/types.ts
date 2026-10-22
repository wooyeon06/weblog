/** 인라인 마크다운 공용 타입·기호 표·조각(Span) 도우미. 다른 파일들이 모두 이 파일을 쓴다. */

export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code'

/** 바깥 → 안쪽 순서. 코드는 다른 서식을 해석하지 않으므로 항상 가장 안쪽이다. */
export const MARKS: Mark[] = ['bold', 'italic', 'underline', 'strike', 'code']

export type DelimiterMark = Exclude<Mark, 'code'>

export const DELIMITERS: Record<DelimiterMark, string> = {
  bold: '**',
  italic: '*',
  underline: '++',
  strike: '~~',
}

/** 같은 위치에서 먼저 시도할 순서. `**` 를 `*` 보다 먼저 본다. */
export const DELIMITER_TRY_ORDER: Array<[string, DelimiterMark]> = [
  ['**', 'bold'],
  ['__', 'bold'],
  ['++', 'underline'],
  ['~~', 'strike'],
  ['*', 'italic'],
  ['_', 'italic'],
]

/** 글자로 쓰려면 앞에 `\` 를 붙여야 하는 문자 */
export const ESCAPABLE = new Set(['\\', '*', '_', '~', '+', '`', '[', ']', '{', '}'])

/** 조각 전체를 감싸는 값 있는 속성. 링크 주소, 글자색, 배경색. */
export type WrapKind = 'href' | 'color' | 'bg'
export const WRAP_KINDS: WrapKind[] = ['href', 'color', 'bg']

export type Span = { text: string; marks: Mark[]; href?: string; color?: string; bg?: string }

/**
 * 파싱 결과 조각. `starts[k]` / `ends[k]` 는 k 번째 글자가 마크다운에서 차지하는 구간이다.
 * (이스케이프된 글자는 `\` 까지 포함해 두 칸을 차지한다)
 * { text: "나나나",  marks: ["code"], plainStart: 4, starts: [5,6,7],   ends: [6,7,8]   }
 */
export type Run = Span & { plainStart: number; starts: number[]; ends: number[] }

export function sortMarks(marks: Iterable<Mark>): Mark[] {
  const set = new Set(marks)
  return MARKS.filter((mark) => set.has(mark))
}

export const isSpace = (char: string | undefined) => char === undefined || /\s/.test(char)

export function sameStyle(a: Span, b: Span) {
  return (
    WRAP_KINDS.every((kind) => a[kind] === b[kind]) &&
    a.marks.length === b.marks.length &&
    a.marks.every((m, i) => m === b.marks[i])
  )
}

export function copySpan(span: Span, text = span.text, marks = span.marks): Span {
  const copy: Span = { text, marks: sortMarks(marks) }
  for (const kind of WRAP_KINDS) if (span[kind]) copy[kind] = span[kind]
  return copy
}

/** [start, end) 화면 구간을 기준으로 조각을 쪼갠다. (서식 편집·자동 서식이 함께 쓴다) */
export function splitSpans(spans: Span[], start: number, end: number): [Span[], Span[], Span[]] {
  const before: Span[] = []
  const middle: Span[] = []
  const after: Span[] = []
  let offset = 0
  for (const span of spans) {
    const spanEnd = offset + span.text.length
    const cut = (from: number, to: number) => copySpan(span, span.text.slice(from - offset, to - offset))
    if (start > offset) before.push(cut(offset, Math.min(spanEnd, start)))
    if (end > offset && start < spanEnd) middle.push(cut(Math.max(offset, start), Math.min(spanEnd, end)))
    if (end < spanEnd) after.push(cut(Math.max(offset, end), spanEnd))
    offset = spanEnd
  }
  const nonEmpty = (list: Span[]) => list.filter((span) => span.text)
  return [nonEmpty(before), nonEmpty(middle), nonEmpty(after)]
}
