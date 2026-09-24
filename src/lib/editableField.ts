import { mdToPlain, parseInline, plainToMd, type Run, type Span } from './inlineMarkdown'
import { colorClass } from './textColors'

/**
 * 에디터가 입력칸을 다루는 공통 인터페이스. 위치는 모두 "마크다운 문자열" 기준이다.
 * - 코드 블록은 textarea 를 그대로 쓴다. (HTMLTextAreaElement 가 이 모양을 그대로 만족한다)
 * - 나머지 블록·표 셀은 서식을 바로 보여주는 contentEditable(RichField)이다.
 */
export interface EditableField {
  readonly value: string
  readonly selectionStart: number
  readonly selectionEnd: number
  setSelectionRange(start: number, end: number): void
  focus(): void
  blur(): void
  getBoundingClientRect(): DOMRect
}

const registry = new WeakMap<Element, RichField>()

/** DOM 요소 → 입력칸. 표 셀처럼 요소를 querySelector 로 찾는 곳에서 쓴다. */
export function fieldOf(element: Element | null | undefined): EditableField | null {
  if (!element) return null
  if (element instanceof HTMLTextAreaElement) return element
  return registry.get(element) ?? null
}

export function richFieldOf(element: Element | null | undefined): RichField | null {
  return element ? registry.get(element) ?? null : null
}

const SAFE_PROTOCOL = /^(https?:|mailto:|\/|#)/i

/**
 * 서식 요소 바로 뒤에 커서를 두기 위한 보이지 않는 글자(zero-width space).
 * 요소 뒤에 텍스트 노드가 없으면 브라우저는 커서를 요소 안에 두므로, 서식을 벗어나 칠 수 없다.
 * 화면 글자·마크다운 어디에도 세지 않는다.
 */
const CARET_ANCHOR = String.fromCharCode(0x200b)
const stripAnchors = (text: string) => text.split(CARET_ANCHOR).join('')
export const isSafeHref = (href: string) => SAFE_PROTOCOL.test(href)

// ------------------------------------------------------------ DOM ↔ 조각

/** 조각 목록을 DOM 으로 그린다. 태그 구성은 읽기 화면(RichText)과 같다. */
function buildNodes(runs: Run[]): DocumentFragment {
  const fragment = document.createDocumentFragment()
  for (const run of runs) {
    let node: Node = document.createTextNode(run.text)
    const wrap = (element: HTMLElement) => {
      element.appendChild(node)
      node = element
    }
    if (run.marks.includes('code')) {
      const code = document.createElement('code')
      code.className = 'inline-code'
      wrap(code)
    }
    if (run.marks.includes('strike')) wrap(document.createElement('s'))
    if (run.marks.includes('underline')) wrap(document.createElement('u'))
    if (run.marks.includes('italic')) wrap(document.createElement('em'))
    if (run.marks.includes('bold')) wrap(document.createElement('strong'))
    if (run.bg) {
      const span = document.createElement('span')
      span.dataset.bg = run.bg
      span.className = colorClass('bg', run.bg)
      wrap(span)
    }
    if (run.color) {
      const span = document.createElement('span')
      span.dataset.color = run.color
      span.className = colorClass('color', run.color)
      wrap(span)
    }
    if (run.href) {
      const anchor = document.createElement('a')
      anchor.dataset.href = run.href
      anchor.className = 'rt-link'
      if (isSafeHref(run.href)) anchor.href = run.href
      anchor.title = `${run.href}\nCtrl+클릭으로 열기`
      wrap(anchor)
    }
    fragment.appendChild(node)
  }
  // 인라인 코드로 끝나는 블록은 코드 뒤에 커서 자리를 둔다.
  // 없으면 End 키·줄 끝 클릭 때 커서가 코드 안에 갇혀 평문을 이어 쓸 수 없다.
  if (runs[runs.length - 1]?.marks.includes('code')) fragment.appendChild(document.createTextNode(CARET_ANCHOR))
  // pre-wrap 에서 끝의 줄바꿈은 뒤에 무언가 있어야 빈 줄로 보인다.
  if (runs[runs.length - 1]?.text.endsWith('\n')) fragment.appendChild(document.createElement('br'))
  return fragment
}

/** 편집 후의 DOM → 조각 목록. 브라우저가 넣는 <br> 은 무시한다. (줄바꿈은 항상 "\n" 글자로 넣는다) */
export function readSpans(root: HTMLElement): Span[] {
  const spans: Span[] = []
  const walk = (node: Node, style: Span) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        spans.push({ ...style, text: stripAnchors((child as Text).data).replace(/\xa0/g, ' ') })
        return
      }
      if (!(child instanceof HTMLElement) || child.tagName === 'BR') return
      const next: Span = { ...style, marks: [...style.marks] }
      switch (child.tagName) {
        case 'STRONG':
        case 'B':
          next.marks.push('bold')
          break
        case 'EM':
        case 'I':
          next.marks.push('italic')
          break
        case 'U':
          next.marks.push('underline')
          break
        case 'S':
        case 'DEL':
        case 'STRIKE':
          next.marks.push('strike')
          break
        case 'CODE':
          next.marks.push('code')
          break
        case 'A':
          if (child.dataset.href) next.href = child.dataset.href
          break
      }
      if (child.dataset.color) next.color = child.dataset.color
      if (child.dataset.bg) next.bg = child.dataset.bg
      walk(child, next)
    })
  }
  walk(root, { text: '', marks: [] })
  return spans
}

/** DOM 위치 → 화면 글자 위치 */
function pointToPlain(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange()
  range.setStart(root, 0)
  range.setEnd(node, offset)
  return stripAnchors(range.toString()).length
}

/** 텍스트 노드 안에서 보이는 글자 n 개 뒤의 실제 위치 */
function rawOffset(data: string, visible: number): number {
  let count = 0
  for (let i = 0; i < data.length; i += 1) {
    if (count === visible) return i
    if (data[i] !== CARET_ANCHOR) count += 1
  }
  return data.length
}

/**
 * 화면 글자 위치 → DOM 위치. 조각 경계에서는 `bias` 쪽 텍스트 노드 안에 둔다.
 * 같은 위치에 커서 자리(CARET_ANCHOR)가 있으면 그쪽을 고른다. (서식 밖에서 이어 쓰도록)
 */
function plainToPoint(root: HTMLElement, plain: number, bias: 'before' | 'after'): [Node, number] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)

  let offset = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const end = offset + stripAnchors(node.data).length
    if (bias === 'before' ? plain <= end : plain < end) {
      if (plain === end) {
        for (let j = i + 1; j < nodes.length && !stripAnchors(nodes[j].data); j += 1) {
          if (nodes[j].data) return [nodes[j], nodes[j].data.length]
        }
      }
      return [node, rawOffset(node.data, Math.max(0, plain - offset))]
    }
    offset = end
  }
  const last = nodes[nodes.length - 1]
  return last ? [last, last.data.length] : [root, 0]
}

// ------------------------------------------------------------ 입력칸 본체

type EditListener = (md: string, start: number, end: number) => void

/**
 * contentEditable 을 textarea 처럼 다루는 어댑터.
 * `value` 는 지금 화면이 나타내는 마크다운이고, 선택 위치도 마크다운 기준으로 주고받는다.
 */
export class RichField implements EditableField {
  readonly root: HTMLElement
  value = ''
  private runs: Run[] = []
  /** 포커스가 없을 때 돌려줄 마지막 선택(화면 글자 기준). textarea 처럼 선택을 기억한다. */
  private saved: [number, number] = [0, 0]
  /** 서식 툴바 등 바깥에서 본문을 바꿀 때 RichInput 이 받아 처리한다. */
  onEdit: EditListener | null = null

  constructor(root: HTMLElement) {
    this.root = root
    registry.set(root, this)
  }

  dispose() {
    registry.delete(this.root)
  }

  get selectionStart() {
    return this.selection()[0]
  }

  get selectionEnd() {
    return this.selection()[1]
  }

  /** 마크다운 기준 선택 구간 */
  selection(): [number, number] {
    const [start, end] = this.plainSelection()
    if (start === end) {
      const caret = plainToMd(this.runs, this.value, start, 'before')
      return [caret, caret]
    }
    return [plainToMd(this.runs, this.value, start, 'after'), plainToMd(this.runs, this.value, end, 'before')]
  }

  /** 화면 글자 기준 선택 구간 */
  plainSelection(): [number, number] {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      if (this.root.contains(range.startContainer) && this.root.contains(range.endContainer)) {
        return [
          pointToPlain(this.root, range.startContainer, range.startOffset),
          pointToPlain(this.root, range.endContainer, range.endOffset),
        ]
      }
    }
    return this.saved
  }

  rememberSelection() {
    const selection = window.getSelection()
    if (selection?.rangeCount && this.root.contains(selection.anchorNode)) this.saved = this.plainSelection()
  }

  setSelectionRange(start: number, end: number) {
    this.setPlainSelection(mdToPlain(this.runs, start), mdToPlain(this.runs, end))
  }

  setPlainSelection(start: number, end: number) {
    this.saved = [start, end]
    if (document.activeElement !== this.root) return
    const selection = window.getSelection()
    if (!selection) return
    const [startNode, startOffset] = plainToPoint(this.root, start, start === end ? 'before' : 'after')
    const [endNode, endOffset] = plainToPoint(this.root, end, 'before')
    selection.setBaseAndExtent(startNode, startOffset, endNode, endOffset)
  }

  focus() {
    if (document.activeElement === this.root) return
    this.root.focus()
    this.setPlainSelection(...this.saved)
  }

  blur() {
    this.root.blur()
  }

  getBoundingClientRect() {
    return this.root.getBoundingClientRect()
  }

  /**
   * 커서가 인라인 코드의 경계에 있으면 그 요소 밖으로 나가게 한다.
   * 오른쪽 화살표면 코드 뒤, 왼쪽 화살표면 코드 앞에서 빠져나간다.
   * 이후 치는 글자는 서식 없이 들어간다.
   * @param onlyCode 인라인 코드 안에 있을 때만
   * @param direction 코드 밖으로 나가는 방향
   * @returns 옮겼는지
   */
  exitFormatting(onlyCode = false, direction: 'left' | 'right' = 'right'): boolean {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !selection.isCollapsed) return false
    const range = selection.getRangeAt(0)
    const { startContainer: node, startOffset: offset } = range
    if (node === this.root || !this.root.contains(node)) return false

    const code = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element | null)?.closest('code')
    if (onlyCode && !code) return false

    const isAtBoundary = (element: Element) => {
      if (direction === 'right') {
        if (node === element && offset >= element.childNodes.length) return true
        return node.nodeType === Node.TEXT_NODE && offset >= (node as Text).data.length && element.contains(node)
      }
      if (node === element && offset <= 0) return true
      return node.nodeType === Node.TEXT_NODE && offset <= 0 && element.contains(node)
    }

    if (!code || !isAtBoundary(code)) return false

    const next = direction === 'right' ? code.nextSibling : code.previousSibling
    if (next && next.nodeType === Node.TEXT_NODE) {
      const text = next as Text
      const pos = direction === 'right' ? text.data.length : 0
      selection.setBaseAndExtent(text, pos, text, pos)
      return true
    }

    const anchor = document.createTextNode(CARET_ANCHOR)
    if (direction === 'right') this.root.insertBefore(anchor, next)
    else this.root.insertBefore(anchor, code)
    selection.setBaseAndExtent(anchor, anchor.data.length, anchor, anchor.data.length)
    return true
  }

  /** 마크다운이 바뀐 것만 기록한다. (화면은 이미 그 내용을 보여주고 있을 때) */
  sync(md: string) {
    this.value = md
    this.runs = parseInline(md)
  }

  /**
   * 마크다운을 화면에 그린다. 지금 DOM 과 같으면 건드리지 않는다. (커서·IME 보호)
   * @returns DOM 을 새로 그렸는지
   */
  render(md: string): boolean {
    this.sync(md)
    const draft = document.createElement('div')
    draft.appendChild(buildNodes(this.runs))
    if (draft.innerHTML === this.root.innerHTML) return false
    this.root.replaceChildren(...Array.from(draft.childNodes))
    return true
  }

  /** 바깥(서식 툴바)에서 본문과 선택을 바꾼다. */
  edit(md: string, start: number, end: number) {
    this.onEdit?.(md, start, end)
  }
}
