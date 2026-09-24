export const BlockType = {
  TEXT: 'text',
  H1: 'h1',
  H2: 'h2',
  H3: 'h3',
  BULLETED: 'bulleted',
  NUMBERED: 'numbered',
  TODO: 'todo',
  QUOTE: 'quote',
  CODE: 'code',
  DIVIDER: 'divider',
  IMAGE: 'image',
  TABLE: 'table',
} as const

export type BlockType = typeof BlockType[keyof typeof BlockType]

export type TableColumn = {
  id: string
  /** 열 너비(px). 사용자가 경계선을 끌어서 조절한다. */
  width: number
  /** 열 배경색. COLUMN_ROW_COLORS 의 key. 없으면 기본(무색) */
  color?: string
}

export type TableRow = {
  id: string
  /** columns 와 같은 순서·길이를 유지하는 셀 텍스트 */
  cells: string[]
  /** 행 배경색. COLUMN_ROW_COLORS 의 key. 없으면 기본(무색) */
  color?: string
}

/** 병합된 셀. (row, col) 이 왼쪽 위 셀이고, 내용은 그 셀에만 둔다. 가려진 셀은 항상 비어 있다. */
export type CellMerge = {
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

export type TableData = {
  columns: TableColumn[]
  rows: TableRow[]
  /** 첫 행을 머리글로 표시 */
  headerRow: boolean
  /** 첫 열을 머리글로 표시 */
  headerColumn: boolean
  /** 병합된 셀 목록. 서로 겹치지 않는다. */
  merges?: CellMerge[]
}

export type Block = {
  id: string
  type: BlockType
  text: string
  /** todo 블록 체크 상태 */
  checked?: boolean
  /** 0~3 단계 들여쓰기 */
  indent: number
  /** table 블록의 표 데이터 */
  table?: TableData
}

export type PostStatus = 'draft' | 'published'

export type Post = {
  id: string
  title: string
  emoji: string
  tags: string[]
  blocks: Block[]
  status: PostStatus
  createdAt: number
  updatedAt: number
}

/** 자동 저장 표시 상태 */
export type SaveState = 'idle' | 'saving' | 'saved'

export type AiProvider = 'gemini' | 'groq' | 'openrouter'

export type AiSettings = {
  provider: AiProvider
  apiKey: string
  model: string
}

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  /** 스트리밍 중인 메시지 여부 */
  pending?: boolean
  error?: boolean
}
