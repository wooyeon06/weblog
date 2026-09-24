import type { Block, BlockType, Post } from '../types'
import { uid } from './id'
import { plainText } from './inlineMarkdown'
import { newTable, parseMarkdownTable, tableToMarkdown, tableToPlainText } from './table'

export const MAX_INDENT = 3

export function newBlock(type: BlockType = 'text', text = '', indent = 0): Block {
  const block: Block = { id: uid('b_'), type, text, indent }
  if (type === 'table') block.table = newTable()
  return block
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  text: '텍스트',
  h1: '제목 1',
  h2: '제목 2',
  h3: '제목 3',
  bulleted: '글머리 목록',
  numbered: '번호 목록',
  todo: '할 일',
  quote: '인용',
  code: '코드',
  divider: '구분선',
  image: '이미지',
  table: '표',
}

export const PLACEHOLDERS: Partial<Record<BlockType, string>> = {
  text: "쓰기 시작하거나 '/' 를 눌러 블록을 선택하세요",
  h1: '제목 1',
  h2: '제목 2',
  h3: '제목 3',
  bulleted: '목록',
  numbered: '목록',
  todo: '할 일',
  quote: '인용',
  code: '코드를 입력하세요',
  image: '이미지를 붙여넣으세요',
}

/** 리스트 계열 블록은 Enter 시 같은 타입을 이어간다. */
export function isListType(type: BlockType): boolean {
  return type === 'bulleted' || type === 'numbered' || type === 'todo'
}

/** 입력한 접두어를 블록 타입으로 변환하는 마크다운 단축키 */
const MARKDOWN_SHORTCUTS: Array<{ pattern: RegExp; type: BlockType; checked?: boolean }> = [
  { pattern: /^#\s$/, type: 'h1' },
  { pattern: /^##\s$/, type: 'h2' },
  { pattern: /^###\s$/, type: 'h3' },
  { pattern: /^[-*+]\s$/, type: 'bulleted' },
  { pattern: /^\d+[.)]\s$/, type: 'numbered' },
  { pattern: /^>\s$/, type: 'quote' },
  { pattern: /^\[\]\s$/, type: 'todo' },
  { pattern: /^\[\s?\]\s$/, type: 'todo' },
  { pattern: /^\[[xX]\]\s$/, type: 'todo', checked: true },
  { pattern: /^```$/, type: 'code' },
  { pattern: /^(---|\*\*\*|___)$/, type: 'divider' },
]

export function matchShortcut(
  input: string,
): { type: BlockType; checked?: boolean } | null {
  for (const shortcut of MARKDOWN_SHORTCUTS) {
    if (shortcut.pattern.test(input)) {
      return { type: shortcut.type, checked: shortcut.checked }
    }
  }
  return null
}

/** 번호 목록의 표시 번호. 같은 들여쓰기 단계에서 연속된 항목만 이어서 센다. */
export function numberedIndex(blocks: Block[], index: number): number {
  const target = blocks[index]
  let count = 1
  for (let i = index - 1; i >= 0; i -= 1) {
    const block = blocks[i]
    if (block.indent < target.indent) break
    if (block.indent > target.indent) continue
    if (block.type !== 'numbered') break
    count += 1
  }
  return count
}

export function blocksToMarkdown(blocks: Block[]): string {
  const lines: string[] = []
  blocks.forEach((block, index) => {
    const pad = '  '.repeat(block.indent)
    switch (block.type) {
      case 'h1':
        lines.push(`# ${block.text}`)
        break
      case 'h2':
        lines.push(`## ${block.text}`)
        break
      case 'h3':
        lines.push(`### ${block.text}`)
        break
      case 'bulleted':
        lines.push(`${pad}- ${block.text}`)
        break
      case 'numbered':
        lines.push(`${pad}${numberedIndex(blocks, index)}. ${block.text}`)
        break
      case 'todo':
        lines.push(`${pad}- [${block.checked ? 'x' : ' '}] ${block.text}`)
        break
      case 'quote':
        lines.push(`> ${block.text}`)
        break
      case 'code':
        lines.push('```', block.text, '```')
        break
      case 'divider':
        lines.push('---')
        break
      case 'image':
        lines.push(`![](${block.text})`)
        break
      case 'table':
        lines.push(tableToMarkdown(block.table))
        break
      default:
        lines.push(`${pad}${block.text}`)
    }
  })
  return lines.join('\n')
}

export function blocksToPlainText(blocks: Block[]): string {
  return blocks
    .filter((block) => block.type !== 'divider' && block.type !== 'image')
    .map((block) =>
      block.type === 'table' ? tableToPlainText(block.table) : block.type === 'code' ? block.text : plainText(block.text),
    )
    .join(' ')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** AI 응답(마크다운 텍스트)을 에디터 블록으로 변환한다. */
export function markdownToBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let codeBuffer: string[] | null = null

  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const rawLine = lines[cursor]
    const fence = rawLine.trim().startsWith('```')
    if (fence) {
      if (codeBuffer) {
        blocks.push(newBlock('code', codeBuffer.join('\n')))
        codeBuffer = null
      } else {
        codeBuffer = []
      }
      continue
    }
    if (codeBuffer) {
      codeBuffer.push(rawLine)
      continue
    }

    // GFM 표는 구분선 줄까지 미리 봐야 하므로 다른 규칙보다 먼저 확인한다.
    const table = parseMarkdownTable(lines, cursor)
    if (table) {
      const block = newBlock('table')
      block.table = table.table
      blocks.push(block)
      cursor = table.next - 1
      continue
    }

    const indentMatch = /^(\s*)/.exec(rawLine)
    const indent = Math.min(
      MAX_INDENT,
      Math.floor((indentMatch ? indentMatch[1].replace(/\t/g, '  ').length : 0) / 2),
    )
    const line = rawLine.trim()

    if (!line) continue

    if (/^(---|\*\*\*|___)$/.test(line)) {
      blocks.push(newBlock('divider'))
      continue
    }

    const image = /^!\[.*\]\((data:image\/[^\s)]+|https?:\/\/[^\s)]+)\)$/.exec(line)
    if (image) {
      blocks.push(newBlock('image', image[1], indent))
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const type: BlockType = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
      blocks.push(newBlock(type, heading[2]))
      continue
    }

    const todo = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line)
    if (todo) {
      const block = newBlock('todo', todo[2], indent)
      block.checked = todo[1].toLowerCase() === 'x'
      blocks.push(block)
      continue
    }

    const bulleted = /^[-*+]\s+(.*)$/.exec(line)
    if (bulleted) {
      blocks.push(newBlock('bulleted', bulleted[1], indent))
      continue
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (numbered) {
      blocks.push(newBlock('numbered', numbered[1], indent))
      continue
    }

    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) {
      blocks.push(newBlock('quote', quote[1]))
      continue
    }

    blocks.push(newBlock('text', line, indent))
  }

  if (codeBuffer) blocks.push(newBlock('code', codeBuffer.join('\n')))
  if (blocks.length === 0) blocks.push(newBlock('text', markdown.trim()))
  return blocks
}

export function postExcerpt(post: Post, length = 140): string {
  const text = blocksToPlainText(post.blocks)
  if (text.length <= length) return text
  return `${text.slice(0, length).trimEnd()}…`
}

export function postWordCount(post: Post): number {
  const text = blocksToPlainText(post.blocks)
  return text ? text.replace(/\s/g, '').length : 0
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(timestamp))
}

export function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '방금 전'
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`
  return formatDate(timestamp)
}
