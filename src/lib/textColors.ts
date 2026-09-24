/**
 * 본문 글자색 / 배경색 팔레트. 마크다운에는 키만 저장한다. ({color:red}…{/color})
 * 실제 색 값은 richText.scss 의 CSS 변수(라이트/다크)로 정한다.
 */
export type ColorKind = 'color' | 'bg'

export const TEXT_COLORS: { key: string; label: string }[] = [
  { key: 'default', label: '기본' },
  { key: 'gray', label: '회색' },
  { key: 'brown', label: '갈색' },
  { key: 'orange', label: '주황' },
  { key: 'yellow', label: '노랑' },
  { key: 'green', label: '초록' },
  { key: 'blue', label: '파랑' },
  { key: 'purple', label: '보라' },
  { key: 'pink', label: '분홍' },
  { key: 'red', label: '빨강' },
]

const KNOWN = new Set(TEXT_COLORS.map((color) => color.key))

/** 알려진 색 키만 클래스로 바꾼다. (저장소 값을 그대로 class 에 넣지 않는다) */
export function colorClass(kind: ColorKind, key?: string): string {
  if (!key || key === 'default' || !KNOWN.has(key)) return ''
  return kind === 'color' ? `rt-color-${key}` : `rt-bg-${key}`
}

export type RecentColor = { kind: ColorKind; key: string }

const RECENT_KEY = 'weblog:recent-colors'
const RECENT_LIMIT = 5

export function loadRecentColors(): RecentColor[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is RecentColor =>
        (item?.kind === 'color' || item?.kind === 'bg') && typeof item.key === 'string' && KNOWN.has(item.key),
    )
  } catch {
    return []
  }
}

export function pushRecentColor(color: RecentColor): RecentColor[] {
  const next = [color, ...loadRecentColors().filter((c) => c.kind !== color.kind || c.key !== color.key)].slice(
    0,
    RECENT_LIMIT,
  )
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // 저장이 막혀 있어도 이번 세션에서는 그대로 쓴다.
  }
  return next
}
