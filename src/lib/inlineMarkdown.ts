/**
 * 블록 본문의 인라인 마크다운을 "서식이 붙은 글자 조각(run)" 목록으로 다룬다.
 *
 *   **굵게**  *기울임*  ++밑줄++  ~~취소선~~  `코드`  [링크](url)
 *   {color:red}글자색{/color}  {bg:yellow}배경색{/bg}
 *
 * - 저장 형식은 마크다운 문자열 그대로다. (블록 text)
 * - 편집기(RichInput)와 읽기 화면(RichText)이 같은 파서를 쓰므로 두 화면이 항상 같게 보인다.
 * - 사용자가 글자로 친 기호(`*` 등)는 `\*` 처럼 이스케이프해서 저장한다. 서식으로 오해되지 않는다.
 * - 조각의 각 글자가 마크다운 어디에 있는지 기억하므로 "화면 글자 위치 ↔ 마크다운 위치"를 오갈 수 있다.
 */

export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code'

/** 바깥 → 안쪽 순서. 코드는 다른 서식을 해석하지 않으므로 항상 가장 안쪽이다. */
export const MARKS: Mark[] = ['bold', 'italic', 'underline', 'strike', 'code']

type DelimiterMark = Exclude<Mark, 'code'>

const DELIMITERS: Record<DelimiterMark, string> = {
  bold: '**',
  italic: '*',
  underline: '++',
  strike: '~~',
}

/** 같은 위치에서 먼저 시도할 순서. `**` 를 `*` 보다 먼저 본다. */
const DELIMITER_TRY_ORDER: Array<[string, DelimiterMark]> = [
  ['**', 'bold'],
  ['__', 'bold'],
  ['++', 'underline'],
  ['~~', 'strike'],
  ['*', 'italic'],
  ['_', 'italic'],
]

/** 글자로 쓰려면 앞에 `\` 를 붙여야 하는 문자 */
const ESCAPABLE = new Set(['\\', '*', '_', '~', '+', '`', '[', ']', '{', '}'])

/** 조각 전체를 감싸는 값 있는 속성. 링크 주소, 글자색, 배경색. */
export type WrapKind = 'href' | 'color' | 'bg'
const WRAP_KINDS: WrapKind[] = ['href', 'color', 'bg']

export type Span = { text: string; marks: Mark[]; href?: string; color?: string; bg?: string }

/**
 * 파싱 결과 조각. `starts[k]` / `ends[k]` 는 k 번째 글자가 마크다운에서 차지하는 구간이다.
 * (이스케이프된 글자는 `\` 까지 포함해 두 칸을 차지한다)
 */
export type Run = Span & { plainStart: number; starts: number[]; ends: number[] }

/** 라벨 안의 `코드` 는 `]` 를 품을 수 있으므로 통째로 건너뛴다. */
const LINK_PATTERN = /^\[((?:\\.|`[^`\n]*`|[^\]\\\n])+)\]\(([^)\s]+)\)/
const COLOR_OPEN_PATTERN = /^\{(color|bg):([a-z]+)\}/
const COLOR_CLOSE_PATTERN = /^\{\/(color|bg)\}/

function sortMarks(marks: Iterable<Mark>): Mark[] {
  const set = new Set(marks)
  return MARKS.filter((mark) => set.has(mark))
}

const isSpace = (char: string | undefined) => char === undefined || /\s/.test(char)

function sameStyle(a: Span, b: Span) {
  return (
    WRAP_KINDS.every((kind) => a[kind] === b[kind]) &&
    a.marks.length === b.marks.length &&
    a.marks.every((m, i) => m === b.marks[i])
  )
}

function copySpan(span: Span, text = span.text, marks = span.marks): Span {
  const copy: Span = { text, marks: sortMarks(marks) }
  for (const kind of WRAP_KINDS) if (span[kind]) copy[kind] = span[kind]
  return copy
}

// ------------------------------------------------------------------ 파싱

/** 마크다운 → 조각 목록 */
export function parseInline(md: string): Run[] {
  const runs: Run[] = []
  /** 열린 서식 → 여는 기호와, 내용이 시작되는 위치. 교차(**a *b** c*)도 허용하도록 집합으로 다룬다. */
  const open = new Map<DelimiterMark, { token: string; at: number }>()
  const colors: { color?: string; bg?: string } = {}
  let link: { href: string; closeAt: number; resume: number } | null = null
  let text = ''
  let starts: number[] = []
  let ends: number[] = []
  let plain = 0

  const flush = (extra?: Mark) => {
    if (!text) return
    const run: Run = {
      text,
      marks: sortMarks(extra ? [...open.keys(), extra] : open.keys()),
      plainStart: plain,
      starts,
      ends,
    }
    if (link) run.href = link.href
    if (colors.color) run.color = colors.color
    if (colors.bg) run.bg = colors.bg
    runs.push(run)
    plain += text.length
    text = ''
    starts = []
    ends = []
  }
  const pushChar = (char: string, start: number, end: number) => {
    text += char
    starts.push(start)
    ends.push(end)
  }

  let i = 0
  while (i < md.length) {
    if (link && i === link.closeAt) {
      flush()
      i = link.resume
      link = null
      continue
    }

    const char = md[i]
    const limit = link ? link.closeAt : md.length

    if (char === '\\' && ESCAPABLE.has(md[i + 1]) && i + 1 < limit) {
      pushChar(md[i + 1], i, i + 2)
      i += 2
      continue
    }

    if (char === '`') {
      const end = md.indexOf('`', i + 1)
      if (end > i + 1 && end < limit) {
        flush()
        for (let k = i + 1; k < end; k += 1) pushChar(md[k], k, k + 1)
        flush('code')
        i = end + 1
        continue
      }
    }

    if (char === '[' && !link) {
      const match = LINK_PATTERN.exec(md.slice(i))
      if (match) {
        flush()
        link = { href: match[2], closeAt: i + 1 + match[1].length, resume: i + match[0].length }
        i += 1
        continue
      }
    }

    if (char === '{') {
      const rest = md.slice(i)
      const close = COLOR_CLOSE_PATTERN.exec(rest)
      if (close) {
        const kind = close[1] as 'color' | 'bg'
        if (colors[kind]) {
          flush()
          delete colors[kind]
          i += close[0].length
          continue
        }
      }
      const opening = COLOR_OPEN_PATTERN.exec(rest)
      if (opening) {
        const kind = opening[1] as 'color' | 'bg'
        if (!colors[kind] && md.indexOf(`{/${kind}}`, i + opening[0].length) !== -1) {
          flush()
          colors[kind] = opening[2]
          i += opening[0].length
          continue
        }
      }
    }

    const delimiter = matchDelimiter(md, i, open, limit)
    if (delimiter) {
      flush()
      const [token, mark] = delimiter
      if (open.has(mark)) open.delete(mark)
      else open.set(mark, { token, at: i + token.length })
      i += token.length
      continue
    }

    pushChar(char, i, i + 1)
    i += 1
  }
  flush()
  return mergeRuns(runs)
}

/** md[j] 가 `\` 로 이스케이프된 글자인지 */
function isEscaped(md: string, j: number) {
  let slashes = 0
  for (let k = j - 1; k >= 0 && md[k] === '\\'; k -= 1) slashes += 1
  return slashes % 2 === 1
}

function matchDelimiter(
  md: string,
  i: number,
  open: Map<DelimiterMark, { token: string; at: number }>,
  limit: number,
): [string, DelimiterMark] | null {
  for (const [token, mark] of DELIMITER_TRY_ORDER) {
    if (!md.startsWith(token, i)) continue
    const after = i + token.length
    const opened = open.get(mark)

    if (opened) {
      // 닫기: 여는 기호와 같은 모양, 내용이 비어 있지 않고, 바로 앞이 공백이 아니어야 한다.
      if (opened.token === token && i > opened.at && !isSpace(md[i - 1])) return [token, mark]
      continue
    }

    // 열기: 바로 뒤가 공백이 아니고, 뒤쪽에 짝이 되는 닫는 기호가 있어야 한다. (`2 * 3` 은 글자 그대로)
    if (isSpace(md[after]) || after >= limit) continue
    // `_` 는 단어 중간(snake_case)에서는 서식으로 보지 않는다.
    if (token[0] === '_' && /\w/.test(md[i - 1] ?? '')) continue
    let j = md.indexOf(token, after + 1)
    while (j !== -1 && (isSpace(md[j - 1]) || isEscaped(md, j))) j = md.indexOf(token, j + 1)
    if (j !== -1) return [token, mark]
  }
  return null
}

function mergeRuns(runs: Run[]): Run[] {
  const merged: Run[] = []
  for (const run of runs) {
    const last = merged[merged.length - 1]
    // 원문에서 붙어 있는 조각만 합친다. (사이에 기호가 있으면 위치 대응이 깨진다)
    if (last && sameStyle(last, run) && last.ends[last.ends.length - 1] === run.starts[0]) {
      last.text += run.text
      last.starts = [...last.starts, ...run.starts]
      last.ends = [...last.ends, ...run.ends]
    } else {
      merged.push({ ...run })
    }
  }
  return merged
}

// ---------------------------------------------------------------- 직렬화

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

// ------------------------------------------------------------ 위치 변환

export function plainLength(runs: Run[]) {
  const last = runs[runs.length - 1]
  return last ? last.plainStart + last.text.length : 0
}

/** 서식 기호를 뺀 글자만 */
export function plainText(md: string) {
  return parseInline(md).map((run) => run.text).join('')
}

/** 마크다운 위치 → 화면 글자 위치. 기호 안쪽을 가리키면 가까운 글자 경계로 붙인다. */
export function mdToPlain(runs: Run[], md: number): number {
  for (const run of runs) {
    for (let k = 0; k < run.text.length; k += 1) {
      // 글자 앞(또는 이스케이프 `\` 와 글자 사이)
      if (md < run.ends[k]) return run.plainStart + k
    }
    if (md === run.ends[run.ends.length - 1]) return run.plainStart + run.text.length
  }
  return plainLength(runs)
}

/**
 * 화면 글자 위치 → 마크다운 위치.
 * `edges` 가 true 면 처음/끝은 항상 0 / md.length 다. (블록 합치기·방향키 이동이 이 값을 비교한다)
 * 조각 경계에서는 `bias` 가 'before' 면 앞 조각 안쪽(**ab|**), 'after' 면 뒤 조각 안쪽(**|cd**)을 가리킨다.
 */
export function plainToMd(
  runs: Run[],
  md: string,
  plain: number,
  bias: 'before' | 'after' = 'before',
  edges = true,
): number {
  const total = plainLength(runs)
  if (edges && plain <= 0) return 0
  if (edges && plain >= total) return md.length
  for (const run of runs) {
    const k = plain - run.plainStart
    if (bias === 'before' && k > 0 && k <= run.text.length) return run.ends[k - 1]
    if (bias === 'after' && k >= 0 && k < run.text.length) return run.starts[k]
  }
  return plain <= 0 ? 0 : md.length
}

// ------------------------------------------------------------- 서식 편집

export type InlineEdit = { md: string; start: number; end: number }

export function spansOf(md: string): Span[] {
  return parseInline(md).map((run) => copySpan(run))
}

/** [start, end) 화면 구간을 기준으로 조각을 쪼갠다. */
function splitSpans(spans: Span[], start: number, end: number): [Span[], Span[], Span[]] {
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

// ------------------------------------------------------------- 자동 서식

/** 커서 바로 앞에서 끝나는 `**글자**` 같은 패턴. 먼저 맞는 것을 쓴다. (`**` 를 `*` 보다 먼저) */
const AUTO_FORMATS: Array<[RegExp, Mark]> = [
  [/(?:\*\*|__)([^\s*_](?:[^\n]*?[^\s*_])?)(?:\*\*|__)$/, 'bold'],
  [/~~([^\s~](?:[^\n]*?[^\s~])?)~~$/, 'strike'],
  [/\+\+([^\s+](?:[^\n]*?[^\s+])?)\+\+$/, 'underline'],
  [/(?<![*\w])\*([^\s*](?:[^*\n]*?[^\s*])?)\*$/, 'italic'],
  [/(?<![_\w])_([^\s_](?:[^_\n]*?[^\s_])?)_$/, 'italic'],
  [/`([^`\n]+)`$/, 'code'],
]

/**
 * 노션처럼 `**굵게**` 를 끝까지 치는 순간 기호를 없애고 서식으로 바꾼다.
 * `caret` 은 화면 글자 기준 커서. 바꿀 것이 없으면 null.
 */
export function autoFormat(spans: Span[], caret: number): { spans: Span[]; caret: number } | null {
  const text = spans.map((span) => span.text).join('')
  const before = text.slice(0, caret)
  for (const [pattern, mark] of AUTO_FORMATS) {
    const match = pattern.exec(before)
    if (!match) continue
    // 여는/닫는 기호가 같은 모양이어야 한다. (`**a__` 는 제외)
    const markerLength = (match[0].length - match[1].length) / 2
    if (match[0].slice(0, markerLength) !== match[0].slice(-markerLength)) continue

    const start = caret - match[0].length
    const [head, middle, tail] = splitSpans(spans, start, caret)
    // 한 가지 서식 안에서 친 경우만. 코드 안에서는 기호가 글자 그대로다.
    if (!middle.every((span) => sameStyle(span, middle[0])) || middle[0].marks.includes('code')) continue

    const style = middle[0]
    const marks = mark === 'code' ? ['code' as Mark] : [...style.marks, mark]
    return {
      spans: [...head, copySpan(style, match[1], marks), ...tail],
      caret: start + match[1].length,
    }
  }
  return null
}
