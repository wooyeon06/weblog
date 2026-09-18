import type { ReactNode } from 'react'

/**
 * 인라인 마크다운(**굵게**, *기울임*, `코드`, ~~취소선~~, [링크](url))을
 * React 엘리먼트로 변환한다. innerHTML 을 쓰지 않으므로 XSS 위험이 없다.
 */
const INLINE_PATTERN =
  /(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~]+~~)|(`[^`]+`)|(\[[^\]]+\]\([^)\s]+\))/g

const SAFE_PROTOCOL = /^(https?:|mailto:|\/|#)/i

function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index))
    const token = match[0]
    const id = `${keyPrefix}-${key}`
    key += 1

    if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={id}>{renderInline(token.slice(2, -2), id)}</strong>)
    } else if (token.startsWith('~~')) {
      nodes.push(<del key={id}>{renderInline(token.slice(2, -2), id)}</del>)
    } else if (token.startsWith('`')) {
      nodes.push(
        <code className="inline-code" key={id}>
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
      if (link && SAFE_PROTOCOL.test(link[2])) {
        nodes.push(
          <a key={id} href={link[2]} target="_blank" rel="noreferrer noopener">
            {link[1]}
          </a>,
        )
      } else {
        nodes.push(token)
      }
    } else {
      nodes.push(<em key={id}>{renderInline(token.slice(1, -1), id)}</em>)
    }

    lastIndex = index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function RichText({ text }: { text: string }) {
  return <>{renderInline(text)}</>
}
