import type { BlockType } from '../../types'

export type SlashItem = {
  type: BlockType
  label: string
  hint: string
  icon: string
  keywords: string[]
}

export const SLASH_ITEMS: SlashItem[] = [
  { type: 'text', label: '텍스트', hint: '일반 문단', icon: 'Aa', keywords: ['text', '텍스트', '본문', 'p'] },
  { type: 'h1', label: '제목 1', hint: '가장 큰 제목', icon: 'H1', keywords: ['h1', '제목', 'heading', 'title'] },
  { type: 'h2', label: '제목 2', hint: '중간 제목', icon: 'H2', keywords: ['h2', '제목', 'heading'] },
  { type: 'h3', label: '제목 3', hint: '작은 제목', icon: 'H3', keywords: ['h3', '제목', 'heading'] },
  {
    type: 'bulleted',
    label: '글머리 목록',
    hint: '• 로 시작하는 목록',
    icon: '•',
    keywords: ['bullet', 'list', '목록', '글머리', 'ul'],
  },
  {
    type: 'numbered',
    label: '번호 목록',
    hint: '1. 로 시작하는 목록',
    icon: '1.',
    keywords: ['number', 'list', '번호', '순서', 'ol'],
  },
  { type: 'todo', label: '할 일', hint: '체크박스 목록', icon: '☑', keywords: ['todo', 'check', '할일', '체크'] },
  { type: 'quote', label: '인용', hint: '인용문 강조', icon: '❝', keywords: ['quote', '인용', 'blockquote'] },
  { type: 'code', label: '코드', hint: '코드 블록', icon: '</>', keywords: ['code', '코드', 'pre'] },
  {
    type: 'table',
    label: '표',
    hint: '행과 열이 있는 표',
    icon: '⊞',
    keywords: ['table', '표', '테이블', 'grid', '행', '열'],
  },
  {
    type: 'image',
    label: '이미지',
    hint: '클립보드 이미지 붙여넣기',
    icon: '▣',
    keywords: ['image', 'img', '사진', 'paste', '붙여넣기'],
  },
  {
    type: 'divider',
    label: '구분선',
    hint: '가로 선으로 나누기',
    icon: '—',
    keywords: ['divider', '구분선', 'hr', 'line'],
  },
]

export function filterSlashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_ITEMS
  return SLASH_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((keyword) => keyword.toLowerCase().includes(q)),
  )
}
