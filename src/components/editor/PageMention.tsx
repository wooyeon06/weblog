import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { richFieldOf, type RichField } from '../../lib/editableField'
import { plainText } from '../../lib/inlineMarkdown'
import { Key } from '../../lib/keys'
import { insertPageLink, searchPages } from '../../lib/pageSearch'
import { useRoute } from '../../lib/router'
import { usePostStore } from '../../storage/usePostStore'
import type { Post } from '../../types'
import { PagePickList } from './PagePickList'

/** 커서 바로 앞의 `@검색어`. 줄 처음이나 공백 뒤의 @ 만 본다. (이메일 주소의 @ 는 제외) */
const MENTION = /(?:^|\s)@([^@\n]{0,30})$/
const MAX_RESULTS = 8
const GAP = 6
const MARGIN = 8

type Mention = {
  field: RichField
  /** 화면 글자 기준 `@` 위치와 커서 위치 */
  from: number
  to: number
  query: string
  /** 커서 위치(목록을 띄울 자리) */
  rect: { left: number; top: number; bottom: number }
}

/** 커서 바로 앞이 `@검색어` 면 그 정보를 읽는다. */
function readMention(container: HTMLElement | null): Mention | null {
  const field = richFieldOf(document.activeElement)
  if (!field || !container?.contains(field.root)) return null
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null

  const [caret] = field.plainSelection()
  const match = MENTION.exec(plainText(field.value).slice(0, caret))
  if (!match) return null

  const range = selection.getRangeAt(0)
  const box = range.getClientRects()[0] ?? range.getBoundingClientRect()
  // 빈 줄 끝처럼 커서 사각형을 못 구하면 입력칸 위치를 쓴다.
  const rect = box && (box.top || box.bottom) ? box : field.root.getBoundingClientRect()
  const query = match[1]
  return { field, from: caret - query.length - 1, to: caret, query, rect: { left: rect.left, top: rect.top, bottom: rect.bottom } }
}

/**
 * 본문에서 `@` 를 치면 페이지 목록을 띄우고, 고른 페이지를 제목 링크로 넣는다.
 * 일반 블록과 표 셀(서식 입력칸) 모두에서 동작한다. 코드 블록(textarea)에서는 동작하지 않는다.
 */
export function PageMention({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const posts = usePostStore((state) => state.posts)
  const route = useRoute()
  const menuRef = useRef<HTMLDivElement>(null)
  const [mention, setMention] = useState<Mention | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  /** Esc 로 닫은 @ 의 자리. 그 @ 에서는 다시 열지 않는다. */
  const dismissedRef = useRef<{ field: RichField; from: number } | null>(null)

  const currentId = route.name === 'editor' ? route.id : undefined
  const query = mention?.query
  const pages = useMemo(
    () => (query === undefined ? [] : searchPages(posts, query, { excludeId: currentId, limit: MAX_RESULTS })),
    [posts, query, currentId],
  )

  /** 직전에 읽은 @. 검색어가 바뀌었는지 비교한다. */
  const mentionRef = useRef<Mention | null>(null)
  const show = useCallback((next: Mention | null) => {
    const previous = mentionRef.current
    // 검색어가 바뀌면 첫 항목부터 다시 강조한다.
    if (!next || previous?.query !== next.query || previous.from !== next.from) setActiveIndex(0)
    mentionRef.current = next
    setMention(next)
  }, [])

  const update = useCallback(() => {
    const next = readMention(containerRef.current)
    const dismissed = dismissedRef.current
    if (next && dismissed && dismissed.field === next.field && dismissed.from === next.from) {
      show(null)
      return
    }
    if (!next) dismissedRef.current = null
    show(next)
  }, [containerRef, show])

  // 입력·커서 이동이 끝난 뒤(입력칸이 값을 반영한 뒤)에 다시 읽는다.
  useEffect(() => {
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    document.addEventListener('input', schedule, true)
    document.addEventListener('selectionchange', schedule)
    document.addEventListener('compositionend', schedule, true)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('input', schedule, true)
      document.removeEventListener('selectionchange', schedule)
      document.removeEventListener('compositionend', schedule, true)
    }
  }, [update])

  /** `@검색어` 를 고른 페이지의 제목 링크로 바꾼다. */
  const pick = useCallback(
    (post: Post) => {
      if (!mention) return
      const { field, from, to } = mention
      const { md, caret } = insertPageLink(field.value, from, to, post)
      show(null)
      field.focus()
      field.edit(md, caret, caret)
    },
    [mention, show],
  )

  // 목록이 떠 있는 동안 ↑↓·Enter·Tab·Esc 를 가로챈다. (에디터의 Enter 블록 나누기 등보다 먼저)
  useEffect(() => {
    if (!mention) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || document.activeElement !== mention.field.root) return
      if (event.key === Key.ArrowDown || event.key === Key.ArrowUp) {
        if (pages.length === 0) return
        const step = event.key === Key.ArrowDown ? 1 : -1
        setActiveIndex((index) => (index + step + pages.length) % pages.length)
      } else if (event.key === Key.Enter || event.key === Key.Tab) {
        const page = pages[activeIndex]
        if (!page) return
        pick(page)
      } else if (event.key === Key.Escape) {
        dismissedRef.current = { field: mention.field, from: mention.from }
        show(null)
      } else {
        return
      }
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [mention, pages, activeIndex, pick, show])

  // 커서 아래에 띄우고, 화면 아래 공간이 없으면 커서 위로 올린다.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!mention || !menu) {
      setPosition(null)
      return
    }
    const { width, height } = menu.getBoundingClientRect()
    let top = mention.rect.bottom + GAP
    if (top + height > window.innerHeight - MARGIN) top = Math.max(MARGIN, mention.rect.top - height - GAP)
    const left = Math.min(Math.max(MARGIN, mention.rect.left), window.innerWidth - width - MARGIN)
    setPosition({ left, top })
  }, [mention, pages.length])

  // 검색어에 공백이 들어갔는데 맞는 페이지가 없으면 그냥 글을 쓰는 중으로 보고 띄우지 않는다.
  if (!mention || (pages.length === 0 && /\s/.test(mention.query))) return null

  return (
    <div
      ref={menuRef}
      className="page-mention"
      style={{
        position: 'fixed',
        zIndex: 60,
        ...(position ? { left: position.left, top: position.top } : { visibility: 'hidden' }),
      }}
    >
      <PagePickList
        pages={pages}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onPick={pick}
        emptyText="일치하는 페이지가 없어요"
      />
    </div>
  )
}
