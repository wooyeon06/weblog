/** 링크 입력칸·@ 메뉴에서 쓰는 페이지 검색과 페이지 링크 넣기 */
import type { Post } from '../types'
import { parseInline, plainText, plainToMd, serializeInline, spansOf, type Span } from './inlineMarkdown'

/** 페이지로 가는 앱 안 링크 주소 */
export const pageHref = (id: string) => `#/p/${encodeURIComponent(id)}`

/** 주소로 보이는 입력인지. (주소면 페이지를 검색하지 않는다) 예: https://…, www.…, naver.com, #/p/… */
export function looksLikeUrl(text: string): boolean {
  const value = text.trim()
  return /^(https?:|mailto:|www\.|#|\/)/i.test(value) || /^\S+\.[a-z]{2,}(\/\S*)?$/i.test(value)
}

/**
 * 제목으로 페이지를 찾는다. 제목이 검색어로 시작하는 페이지를 먼저, 그다음 최근에 고친 순서.
 * 검색어가 비면 최근에 고친 페이지를 돌려준다.
 */
export function searchPages(
  posts: Post[],
  query: string,
  { excludeId, limit = 8 }: { excludeId?: string; limit?: number } = {},
): Post[] {
  const q = query.trim().toLowerCase()
  const candidates = posts.filter((post) => post.id !== excludeId)
  if (!q) return [...candidates].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit)

  return candidates
    .map((post) => ({ post, at: post.title.toLowerCase().indexOf(q) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => Number(a.at > 0) - Number(b.at > 0) || b.post.updatedAt - a.post.updatedAt)
    .slice(0, limit)
    .map(({ post }) => post)
}

/** 화면 글자 [from, to) 를 inserted 조각들로 바꾼다. 앞뒤 조각의 서식은 그대로 둔다. */
function replacePlain(spans: Span[], from: number, to: number, inserted: Span[]): Span[] {
  const before: Span[] = []
  const after: Span[] = []
  let pos = 0
  for (const span of spans) {
    const start = pos
    pos += span.text.length
    const head = Math.min(span.text.length, Math.max(0, from - start))
    const tail = Math.max(0, Math.min(span.text.length, to - start))
    if (head > 0) before.push({ ...span, text: span.text.slice(0, head) })
    if (pos > to) after.push({ ...span, text: span.text.slice(tail) })
  }
  return [...before, ...inserted, ...after]
}

/** 본문에 넣는 페이지 링크 글자. 이모지가 있으면 앞에 붙인다. (예: "📝 ENG") */
export const pageLinkLabel = (post: Post) => [post.emoji, post.title || '제목 없음'].filter(Boolean).join(' ')

/**
 * 본문 마크다운의 화면 글자 [from, to) (`@검색어`) 를 "이모지 제목" 페이지 링크로 바꾼다.
 * 뒤에 공백을 하나 둬서 이어 쓰는 글자가 링크에 붙지 않게 하고(이미 공백이 있으면 그대로),
 * 커서는 그 공백 뒤(마크다운 위치)로 돌려준다.
 */
export function insertPageLink(md: string, from: number, to: number, post: Post): { md: string; caret: number } {
  const label = pageLinkLabel(post)
  const spaceAfter = /\s/.test(plainText(md)[to] ?? '')
  const spans = replacePlain(spansOf(md), from, to, [
    { text: label, marks: [], href: pageHref(post.id) },
    ...(spaceAfter ? [] : [{ text: ' ', marks: [] }]),
  ])
  const next = serializeInline(spans).md
  return { md: next, caret: plainToMd(parseInline(next), next, from + label.length + 1, 'before') }
}
