/** DOM ↔ 조각(run/span) 변환과, 화면 글자 위치 ↔ DOM 위치 변환 */
import type { Run, Span } from '../inlineMarkdown'
import { colorClass } from '../textColors'
import { isInternalHref, isSafeHref, splitPageIcon } from './links'

/**
 * 서식 요소 바로 뒤에 커서를 두기 위한 보이지 않는 글자(zero-width space).
 * 요소 뒤에 텍스트 노드가 없으면 브라우저는 커서를 요소 안에 두므로, 서식을 벗어나 칠 수 없다.
 * 화면 글자·마크다운 어디에도 세지 않는다.
 */
export const CARET_ANCHOR = String.fromCharCode(0x200b) //zero-width space
export const stripAnchors = (text: string) => text.split(CARET_ANCHOR).join('')

const isCode = (run: Run | undefined) => !!run?.marks.includes('code')
/**
 * 조각 목록을 DOM 으로 그린다. 태그 구성은 읽기 화면(RichText)과 같다.
 *
 * 마크다운을 parseInline 으로 "같은 서식끼리 묶인 조각(run)"으로 나눈 뒤, 조각마다 텍스트 노드를 만들고
 * 서식 태그로 안쪽부터 감싼다. RichField.render() 가 이 결과를 입력칸에 넣는다.
 *   `가나다 **굵게** \`코드\``
 *   → runs: [{text:'가나다 '}, {text:'굵게', marks:['bold']}, {text:' '}, {text:'코드', marks:['code']}]
 *   → "가나다 " <strong>굵게</strong> " " ◇<code>◇코드</code>◇
 *
 * - 감싸는 순서는 code → s → u → em → strong → 배경색 → 글자색 → 링크(가장 바깥).
 *   readSpans 는 어떤 순서로 감싸여 있어도 읽으므로 이 순서는 화면 모양만 정한다.
 * - ◇ 는 커서 자리(CARET_ANCHOR). 화면·마크다운 어디에도 없는 글자로, 코드 앞뒤에서 커서를 코드 밖에 둘 수 있게 한다.
 * - innerHTML 을 쓰지 않고 노드를 직접 만들므로 본문에 HTML 이 섞여 있어도 실행되지 않는다.
 * 
 * @param runs 조각 목록. parseInline 결과를 그대로 쓸 수 있다.
 * @returns DOM 조각. DocumentFragment 는 화면에 붙이는 순간 안에 있던 자식들만 옮겨지고 fragment 자신은 사라진다.
 *   화면에 태그로 존재하지 않으므로 스타일이나 클래스를 줄 수 없다.
 */
export function buildNodes(runs: Run[]): DocumentFragment {
  //태그가 아닌 임시 바구니입니다. 붙이는 순간 안에 있던 자식들만 옮겨지고 fragment 자신은 사라집니다(빈 상태로 남음). 화면에 태그로 존재하지 않으니 스타일이나 클래스를 줄 수 없습니다.
  const fragment = document.createDocumentFragment()
  runs.forEach((run, index) => {
    // 인라인 코드 앞뒤에는 항상 커서 자리를 둔다.
    // 코드 끝과 바로 뒤 글자의 맨 앞은 화면상 같은 위치라, 브라우저는 글자를 칠 때 코드 끝(안)을 고른다.
    // 사이에 커서 자리 글자가 있어야 "코드 밖" 위치가 따로 생겨 코드와 평문 사이에 쓸 수 있다.
    const prev = runs[index - 1]
    if (isCode(run) || isCode(prev)) {
      fragment.appendChild(document.createTextNode(CARET_ANCHOR))
    }
    // 코드 안 맨 앞에도 커서 자리를 둔다. 없으면 "코드 첫 글자 앞(안)"이 "코드 앞(밖)"과 같은 위치로 취급돼
    // 그 자리에 친 글자가 코드 밖으로 나간다. (뒤쪽은 코드 끝 자체가 안쪽 위치라 필요 없다)
    let node: Node = document.createTextNode(isCode(run) ? CARET_ANCHOR + run.text : run.text)
    // 페이지 링크는 아이콘과 제목을 따로 감싸 제목에만 밑줄을 긋는다. (readSpans 는 이 span 들을 글자 그대로 읽는다)
    const icon = run.href && isInternalHref(run.href) && !isCode(run) ? splitPageIcon(run.text) : null
    if (icon) {
      const label = document.createElement('span')
      const iconEl = document.createElement('span')
      const titleEl = document.createElement('span')
      iconEl.className = 'rt-link__icon'
      iconEl.textContent = icon[0]
      titleEl.className = 'rt-link__title'
      titleEl.textContent = icon[1]
      label.append(iconEl, titleEl)
      node = label
    }
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
      anchor.className = isInternalHref(run.href) ? 'rt-link rt-link--page' : 'rt-link'
      if (isSafeHref(run.href)) anchor.href = run.href
      anchor.title = `${run.href}\n클릭하면 열립니다`
      wrap(anchor)
    }
    fragment.appendChild(node)
  })
  // 인라인 코드로 끝나는 블록은 코드 뒤에 커서 자리를 둔다. (End 키·줄 끝 클릭 때 평문을 이어 쓸 수 있게)
  if (isCode(runs[runs.length - 1])) fragment.appendChild(document.createTextNode(CARET_ANCHOR))
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

/**
 * DOM 위치 → 화면 글자 위치.
 * 입력칸 처음부터 그 위치까지를 범위로 잡고, 그 안의 글자 수를 센다. (보이지 않는 커서 자리 글자는 빼고)
 * @param root 입력칸 루트 요소
 * @param node DOM 위치의 노드
 * @param offset 노드 안에서 몇 번째 글자 위치인지
 * @returns 입력칸 처음부터 그 위치까지 보이는 글자 수
 */
export function pointToPlain(root: HTMLElement, node: Node, offset: number): number {
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

export const inCode = (node: Node) => !!node.parentElement?.closest('code')

/**
 * 화면 글자 위치 → DOM 위치. 조각 경계에서는 `bias` 쪽 텍스트 노드 안에 둔다.
 * 같은 위치에 커서 자리(CARET_ANCHOR)가 있으면 그쪽을 고른다. (서식 밖에서 이어 쓰도록)
 */
export function plainToPoint(root: HTMLElement, plain: number, bias: 'before' | 'after'): [Node, number] {
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
        // 인라인 코드 끝이면 바로 뒤 코드 밖 글자 맨 앞에 둔다. (이어 치는 글자가 코드에 들어가지 않게)
        const next = nodes[i + 1]
        if (next && inCode(node) && !inCode(next)) return [next, 0]
      }
      return [node, rawOffset(node.data, Math.max(0, plain - offset))]
    }
    offset = end
  }
  const last = nodes[nodes.length - 1]
  return last ? [last, last.data.length] : [root, 0]
}
