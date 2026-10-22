/** 파싱: 마크다운 문자열 → Run[] */

import {
  DELIMITER_TRY_ORDER,
  ESCAPABLE,
  isSpace,
  sameStyle,
  sortMarks,
  type DelimiterMark,
  type Mark,
  type Run,
} from './types'

/** 라벨 안의 `코드` 는 `]` 를 품을 수 있으므로 통째로 건너뛴다. */
const LINK_PATTERN = /^\[((?:\\.|`[^`\n]*`|[^\]\\\n])+)\]\(([^)\s]+)\)/ //[구글](https://google.com)
const COLOR_OPEN_PATTERN = /^\{(color|bg):([a-z]+)\}/
const COLOR_CLOSE_PATTERN = /^\{\/(color|bg)\}/

/**
 * 마크다운 문자열 한 줄을 Run[](서식별 글자 묶음 목록)로 바꾸는 파서입니다.
 * "가나다 **굵게** `코드`"
   ↓ parseInline
   [ {text:"가나다 ", marks:[]}, {text:"굵게", marks:["bold"]}, {text:" ", marks:[]}, {text:"코드", marks:["code"]} ]
 * @param md 마크다운 문자열
 * @returns
 */
export function parseInline(md: string): Run[] {
  const runs: Run[] = []
  /** 열린 서식 → 여는 기호와, 내용이 시작되는 위치. 교차(**a *b** c*)도 허용하도록 집합으로 다룬다. */
  const open = new Map<DelimiterMark, { token: string; at: number }>()
  const colors: { color?: string; bg?: string } = {}
  let link: { href: string; closeAt: number; resume: number } | null = null
  let text = ''
  let starts: number[] = [] //여는 기호의 위치
  let ends: number[] = []   //닫는 기호의 위치
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

    //저장된 마크다운 2\*3=6
    if (char === '\\' && ESCAPABLE.has(md[i + 1]) && i + 1 < limit) {
      pushChar(md[i + 1], i, i + 2)
      i += 2
      continue
    }

    //inline code
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
    //link [구글](https://google.com)
    if (char === '[' && !link) {
      const match = LINK_PATTERN.exec(md.slice(i))
      if (match) {
        flush()
        /*
        위치   0  1  2  3  4  5  6  7  8  9  10 11 12 13
        글자   가 [  구 글  ]  (  g  .  c  o  m  )  나
                 ↑i       ↑closeAt              ↑resume
        */
        link = { href: match[2], closeAt: i + 1 + match[1].length, resume: i + match[0].length }
        i += 1
        continue
      }
    }
    //{color:red}안녕{/color}
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

    //지금 위치(i)에 있는 기호가 굵게·기울임·밑줄·취소선을 열거나 닫는 기호인지 판단
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

/**
 * 주어진 위치에서 구분자와 일치하는지를 확인한다.
 * @param md 
 * @param i 
 * @param open 
 * @param limit 
 * @returns 
 */
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
