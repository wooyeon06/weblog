/** 입력칸 본체: contentEditable 을 textarea 처럼 다루는 RichField */
import { mdToPlain, parseInline, plainToMd, type Run } from '../inlineMarkdown'
import { buildNodes, CARET_ANCHOR, inCode, plainToPoint, pointToPlain } from './dom'
import { registerField, unregisterField } from './registry'
import type { EditableField, EditListener } from './types'

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
    registerField(root, this)
  }

  dispose() {
    unregisterField(this.root)
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

  /**
   * 화면 글자 기준 선택 구간. (DOM 위치 → "입력칸 처음부터 몇 번째 글자")
   *
   * 브라우저는 위치를 "어느 텍스트 노드의 몇 번째"로 주는데, 서식이 있으면 노드가 쪼개져 있다.
   *   화면: 가나다 나나나 나나나
   *   DOM : "가나다 " <code>"나나|나"</code> " 나나나"
   *   브라우저 값 (code 안 텍스트 노드, 2) → 이 함수의 값 6 ("가나다 " 4글자 + "나나" 2글자)
   * 에디터는 textarea 처럼 숫자로 커서를 다루므로 이렇게 바꿔서 쓴다.
   * 마크다운 기준(기호 포함) 위치가 필요하면 selection() 을 쓴다. 반대 방향은 setPlainSelection().
   */
  plainSelection(): [number, number] {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      // 선택은 페이지 전체에 하나뿐이다. 시작·끝이 모두 이 입력칸 안에 있을 때만 이 입력칸의 선택으로 본다.
      if (this.root.contains(range.startContainer) && this.root.contains(range.endContainer)) {
        // 커서만 있으면(선택 없음) 두 값이 같다.
        return [
          pointToPlain(this.root, range.startContainer, range.startOffset),
          pointToPlain(this.root, range.endContainer, range.endOffset),
        ]
      }
    }
    // 커서가 다른 곳에 있으면 이 입력칸에서 마지막으로 기억한 선택을 돌려준다. (textarea 와 같은 동작)
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
   * 화살표가 커서 자리 글자(CARET_ANCHOR)를 넘을 때 쓴다.
   * 브라우저는 보이지 않는 글자도 한 칸으로 세서, 커서가 그대로인데 키만 먹는 자리가 생긴다.
   * 화면 위치나 코드 안/밖이 바뀔 때까지 이어서 옮긴다.
   * @returns 직접 옮겼는지 (false 면 브라우저 기본 동작에 맡긴다)
   */
  skipCaretAnchor(direction: 'left' | 'right'): boolean {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !selection.isCollapsed) return false
    const node = selection.anchorNode
    if (!node || node.nodeType !== Node.TEXT_NODE || !this.root.contains(node)) return false

    // 옮길 방향의 바로 옆 글자가 커서 자리인지 본다. (노드 끝이면 이웃 텍스트 노드의 글자)
    const text = node as Text
    const offset = selection.anchorOffset
    let neighbor: string | undefined = direction === 'left' ? text.data[offset - 1] : text.data[offset]
    if (neighbor === undefined) {
      const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_TEXT)
      walker.currentNode = text
      const adjacent = (direction === 'left' ? walker.previousNode() : walker.nextNode()) as Text | null
      neighbor = adjacent ? (direction === 'left' ? adjacent.data[adjacent.data.length - 1] : adjacent.data[0]) : undefined
    }
    if (neighbor !== CARET_ANCHOR) return false

    const state = () => {
      const current = selection.anchorNode
      return `${this.plainSelection()[0]}:${current ? inCode(current) : false}`
    }
    const start = state()
    // 커서 자리가 여러 개 붙어 있어도 몇 번이면 충분하다. 끝에 닿아 더 못 가면 그대로 둔다.
    for (let i = 0; i < 4; i += 1) {
      selection.modify('move', direction === 'left' ? 'backward' : 'forward', 'character')
      if (state() !== start) break
    }
    return true
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
      // 코드 바로 바깥: 오른쪽이면 뒤 글자의 커서 자리 뒤, 왼쪽이면 앞 글자의 맨 끝
      // (커서 자리 앞은 코드 끝과 같은 위치로 취급돼 치는 글자가 코드에 들어간다)
      const pos = direction === 'right' ? text.data.length - text.data.replace(new RegExp(`^${CARET_ANCHOR}+`), '').length : text.data.length
      selection.setBaseAndExtent(text, pos, text, pos)
      return true
    }

    // 코드는 굵게·링크 등에 감싸여 있을 수 있으므로 root 가 아니라 코드의 부모에 넣는다.
    const anchor = document.createTextNode(CARET_ANCHOR)
    code.parentNode!.insertBefore(anchor, direction === 'right' ? next : code)
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
