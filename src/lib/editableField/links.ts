/** 링크 주소·글자 규칙. DOM 과 상관없는 순수 함수라 편집기(dom.ts)와 읽기 화면(RichText)이 같이 쓴다. */

const SAFE_PROTOCOL = /^(https?:|mailto:|\/|#)/i

export const isSafeHref = (href: string) => SAFE_PROTOCOL.test(href)

/** 앱 안 페이지 링크(#/p/...). 새 탭이 아니라 지금 탭에서 연다. */
export const isInternalHref = (href: string) => href.startsWith('#/')

/** 맨 앞의 이모지 하나(피부색·이음 기호로 이어진 이모지 포함)와 뒤따르는 공백 */
const LEADING_ICON = /^(\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?)*\s)(.+)$/su

/**
 * 페이지 링크 글자("👓 ENG")를 아이콘("👓 ")과 제목("ENG")으로 나눈다. 이모지로 시작하지 않으면 null.
 * 노션처럼 밑줄을 제목에만 긋기 위해 화면에서만 나눠 그린다. (저장되는 글자는 그대로)
 */
export function splitPageIcon(text: string): [icon: string, title: string] | null {
  const match = LEADING_ICON.exec(text)
  return match ? [match[1], match[2]] : null
}
