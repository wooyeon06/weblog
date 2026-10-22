/** 자동 서식: 입력 중 `**굵게**` 같은 패턴을 서식으로 바꾼다. */

import { copySpan, sameStyle, splitSpans, type Mark, type Span } from './types'

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
 * before: [{text:'가나 **굵게**'}]           caret 10
   after:  [{text:'가나 '}, {text:'굵게', marks:['bold']}]   caret 5
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
