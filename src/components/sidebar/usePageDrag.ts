import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { Key } from '../../lib/keys'
import type { Post } from '../../types'
import { isWithin, type DropTarget } from './pageTree'

/** 이 거리(px)를 넘겨야 드래그로 인정한다. (그냥 누르면 페이지 열기) */
const DRAG_THRESHOLD = 4
/** 자동 스크롤이 시작되는 사이드바 위·아래 가장자리 폭 */
const EDGE = 40
const MAX_SCROLL_SPEED = 12
/** 줄 높이에서 위·아래 이 비율은 앞·뒤로 넣기, 가운데는 하위로 넣기 */
const EDGE_RATIO = 0.25

/**
 * 사이드바 페이지를 끌어 옮긴다. (블록 드래그 useDragBlockRow 와 같은 방식)
 * 고스트는 pointermove 마다 리렌더하지 않고 transform 만 직접 바꾼다.
 */
export function usePageDrag({
  posts,
  scrollerRef,
  treeRef,
  onDrop,
}: {
  posts: Post[]
  /** 사이드바에서 스크롤되는 요소 (가장자리 자동 스크롤) */
  scrollerRef: RefObject<HTMLElement | null>
  /** 최상위 트리 목록. 그 아래 빈 곳에 놓으면 최상위 맨 끝으로 간다. */
  treeRef: RefObject<HTMLElement | null>
  onDrop: (dragId: string, drop: DropTarget) => void
}) {
  /** 드래그가 끝나는 시점의 최신 값을 쓰기 위해 ref 로 들고 있는다. */
  const postsRef = useRef(posts)
  const onDropRef = useRef(onDrop)
  useEffect(() => {
    postsRef.current = posts
    onDropRef.current = onDrop
  })

  const [dragging, setDragging] = useState<{ post: Post; width: number } | null>(null)
  const [drop, setDrop] = useState<DropTarget | null>(null)

  const ghostNodeRef = useRef<HTMLDivElement | null>(null)
  const posRef = useRef({ x: 0, y: 0 })
  const grabRef = useRef({ x: 0, y: 0 })
  const cleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanupRef.current?.(), [])

  const paintGhost = useCallback(() => {
    const node = ghostNodeRef.current
    if (!node) return
    const x = posRef.current.x - grabRef.current.x
    const y = posRef.current.y - grabRef.current.y
    node.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }, [])

  /** 고스트가 붙는 순간 현재 좌표를 바로 적용한다. (0,0 에서 튀어나오는 것 방지) */
  const ghostRef = useCallback(
    (node: HTMLDivElement | null) => {
      ghostNodeRef.current = node
      if (node) paintGhost()
    },
    [paintGhost],
  )

  /** 페이지 줄을 누르면 호출한다. 일정 거리 이상 움직여야 드래그가 시작된다. */
  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, post: Post) => {
      // 터치는 사이드바 스크롤과 겹치므로 마우스·펜만 받는다.
      if (event.pointerType === 'touch' || event.button !== 0 || cleanupRef.current) return

      const row = event.currentTarget.closest<HTMLElement>('[data-page-id]')
      const startX = event.clientX
      const startY = event.clientY
      let activated = false
      let rafId = 0
      let current: DropTarget | null = null

      posRef.current = { x: startX, y: startY }

      /** 포인터 아래의 줄과 그 줄 안에서의 높이로 놓을 곳을 정한다. */
      const findDrop = (x: number, y: number): DropTarget | null => {
        const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-page-id]')
        if (target) {
          const id = target.dataset.pageId ?? ''
          if (isWithin(postsRef.current, id, post.id)) return null
          const rect = target.getBoundingClientRect()
          const ratio = (y - rect.top) / rect.height
          return { kind: ratio < EDGE_RATIO ? 'before' : ratio > 1 - EDGE_RATIO ? 'after' : 'inside', id }
        }
        const tree = treeRef.current?.getBoundingClientRect()
        const scroller = scrollerRef.current?.getBoundingClientRect()
        if (tree && scroller && y > tree.bottom && y < scroller.bottom && x > scroller.left && x < scroller.right) {
          return { kind: 'end' }
        }
        return null
      }

      const updateDrop = () => {
        const next = findDrop(posRef.current.x, posRef.current.y)
        if (JSON.stringify(next) === JSON.stringify(current)) return
        current = next
        setDrop(next)
      }

      const tick = () => {
        rafId = requestAnimationFrame(tick)
        const scroller = scrollerRef.current
        if (!scroller) return
        const { top, bottom } = scroller.getBoundingClientRect()
        const y = posRef.current.y
        let dy = 0
        if (y < top + EDGE) dy = -MAX_SCROLL_SPEED * Math.min(1, (top + EDGE - y) / EDGE)
        else if (y > bottom - EDGE) dy = MAX_SCROLL_SPEED * Math.min(1, (y - (bottom - EDGE)) / EDGE)
        if (dy === 0) return
        scroller.scrollTop += dy
        updateDrop()
      }

      const activate = () => {
        activated = true
        const rect = row?.getBoundingClientRect()
        // 잡은 지점이 고스트 안에서도 같은 위치에 오도록 오프셋을 기억한다.
        grabRef.current = rect ? { x: startX - rect.left, y: startY - rect.top } : { x: 0, y: 0 }
        document.body.classList.add('is-page-dragging')
        setDragging({ post, width: rect?.width ?? 220 })
        rafId = requestAnimationFrame(tick)
      }

      const onMove = (moveEvent: PointerEvent) => {
        posRef.current = { x: moveEvent.clientX, y: moveEvent.clientY }
        if (!activated) {
          if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD) return
          activate()
        }
        paintGhost()
        updateDrop()
      }

      const finish = (commit: boolean) => {
        cleanupRef.current = null
        cancelAnimationFrame(rafId)
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('pointercancel', onCancel)
        document.removeEventListener('keydown', onKeyDown)
        document.body.classList.remove('is-page-dragging')
        ghostNodeRef.current = null
        setDragging(null)
        setDrop(null)

        if (!activated) return
        // 놓은 자리의 버튼에서 이어서 발생하는 click(페이지 열기)은 한 번 막는다.
        const blockClick = (clickEvent: MouseEvent) => {
          clickEvent.stopPropagation()
          clickEvent.preventDefault()
        }
        window.addEventListener('click', blockClick, { capture: true, once: true })
        window.setTimeout(() => window.removeEventListener('click', blockClick, { capture: true }), 0)

        if (commit && current) onDropRef.current(post.id, current)
      }

      const onUp = () => finish(true)
      const onCancel = () => finish(false)
      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === Key.Escape) finish(false)
      }

      cleanupRef.current = () => finish(false)
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
      document.addEventListener('pointercancel', onCancel)
      document.addEventListener('keydown', onKeyDown)
    },
    [paintGhost, scrollerRef, treeRef],
  )

  return { dragging, drop, ghostRef, startDrag }
}
