import './TableOfContents.scss'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { plainText } from '../../../lib/inlineMarkdown'
import type { Block } from '../../../types'

/** 스크롤 영역 위쪽에서 이만큼(px) 안으로 들어온 제목을 "지금 읽는 제목"으로 본다. */
const ACTIVE_OFFSET = 80
/** 제목으로 이동할 때 위쪽에 남겨 둘 여백(px) */
const SCROLL_MARGIN = 16

const HEADING_LEVEL: Partial<Record<Block['type'], number>> = { h1: 1, h2: 2, h3: 3 }

type Heading = { id: string; text: string; depth: number }

/** 블록에서 제목만 뽑는다. depth 는 가장 큰 제목 단계를 0 으로 한 들여쓰기 단계. */
function collectHeadings(blocks: Block[]): Heading[] {
  const items = blocks.flatMap((block) => {
    const level = HEADING_LEVEL[block.type]
    const text = level ? plainText(block.text).trim() : ''
    return level && text ? [{ id: block.id, text, level }] : []
  })
  const top = Math.min(...items.map((item) => item.level))
  return items.map(({ id, text, level }) => ({ id, text, depth: level - top }))
}

/** 편집 화면(BlockRow)·읽기 화면(PostView) 모두 제목 요소에 data-block-id 를 단다. */
const findHeading = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`)

/**
 * 오른쪽에 떠 있는 목차. 제목을 누르면 그 위치로 스크롤하고, 지금 읽는 제목을 강조한다.
 * 화면이 좁으면 접혀 있다가 "목차" 버튼으로 펼친다.
 */
export function TableOfContents({
  blocks,
  scrollRef,
}: {
  blocks: Block[]
  /** 본문이 스크롤되는 요소 */
  scrollRef: RefObject<HTMLElement | null>
}) {
  const headings = useMemo(() => collectHeadings(blocks), [blocks])
  const [activeId, setActiveId] = useState<string | null>(null)
  /** 좁은 화면에서 펼쳤는지 */
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // 스크롤 위치에 맞춰 지금 읽는 제목을 찾는다.
  useEffect(() => {
    const root = scrollRef.current
    if (!root || headings.length === 0) return

    let frame = 0
    const update = () => {
      frame = 0
      // 맨 아래까지 내렸으면 마지막 제목이 위쪽까지 올라오지 못해도 마지막 제목으로 본다.
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
        setActiveId(headings[headings.length - 1].id)
        return
      }
      const line = root.getBoundingClientRect().top + ACTIVE_OFFSET
      let current = headings[0].id
      for (const heading of headings) {
        const element = findHeading(root, heading.id)
        if (!element) continue
        if (element.getBoundingClientRect().top > line) break
        current = heading.id
      }
      setActiveId(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [headings, scrollRef])

  // 목차가 길면 강조된 항목이 목차 안에서 보이도록 목차를 스크롤한다.
  useEffect(() => {
    const list = listRef.current
    const item = list?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!list || !item) return
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop - 8
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight + 8
  }, [activeId])

  if (headings.length === 0) return null

  const scrollTo = (id: string) => {
    const root = scrollRef.current
    const element = root && findHeading(root, id)
    if (!root || !element) return
    const top = root.scrollTop + element.getBoundingClientRect().top - root.getBoundingClientRect().top
    root.scrollTo({ top: top - SCROLL_MARGIN, behavior: 'smooth' })
    setActiveId(id)
    setOpen(false)
  }

  return (
    <nav className={`toc${open ? ' toc--open' : ''}`} aria-label="목차">
      <button
        type="button"
        className="toc__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '✕' : '☰'} 목차
      </button>
      <div ref={listRef} className="toc__list">
        {headings.map((heading) => (
          <button
            type="button"
            key={heading.id}
            className="toc__item"
            style={{ paddingLeft: 12 + heading.depth * 12 }}
            aria-current={heading.id === activeId}
            title={heading.text}
            onClick={() => scrollTo(heading.id)}
          >
            {heading.text}
          </button>
        ))}
      </div>
    </nav>
  )
}
