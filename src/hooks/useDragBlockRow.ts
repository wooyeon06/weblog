import { useCallback, useContext, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { EditorContext } from "../pages/EditorPage";
import type { Block } from "../types";
import usePostHandler from "./usePostHandler";

/** 이 거리(px)를 넘겨야 드래그로 인정한다. (⋮⋮ 클릭으로 메뉴를 열 수 있게) */
const DRAG_THRESHOLD = 4
/** 자동 스크롤이 시작되는 가장자리 폭 */
const EDGE = 72
const MAX_SCROLL_SPEED = 16
/** 고스트 카드 최대 너비 */
const GHOST_MAX_WIDTH = 440

export type BlockGhostState = {
  block: Block
  width: number
}

/** 실제로 스크롤되는 조상 요소를 찾는다. (에디터는 window 가 아니라 .editor__scroll 이 스크롤된다) */
function scrollParentOf(node: HTMLElement | null): HTMLElement | null {
  for (let element = node?.parentElement ?? null; element; element = element.parentElement) {
    const { overflowY } = getComputedStyle(element)
    if ((overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight) {
      return element
    }
  }
  return null
}

export function useDragBlockRow() {
    const { activePost: post } = usePostHandler();
    const { commitBlocks } = useContext(EditorContext);

    /** 드래그가 끝나는 시점의 최신 값을 쓰기 위해 ref 로 들고 있는다. */
    const blocksRef = useRef<Block[]>([]);
    const commitRef = useRef(commitBlocks);
    useEffect(() => {
        blocksRef.current = post?.blocks ?? []
        commitRef.current = commitBlocks
    });

    /** 드래그 중인 블록의 원래 인덱스 */
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    /** 삽입 위치. 0 ~ blocks.length (i = "i번째 블록 앞에 넣는다") */
    const [overIdx, setOverIdx] = useState<number | null>(null);
    const [ghost, setGhost] = useState<BlockGhostState | null>(null);

    const dragIdxRef = useRef<number | null>(null);
    const overIdxRef = useRef<number | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const scrollerRef = useRef<HTMLElement | null>(null);

    /** 고스트는 리렌더 없이 transform 만 직접 갱신한다. (pointermove 마다 리렌더하면 본문이 버벅인다) */
    const ghostNodeRef = useRef<HTMLDivElement | null>(null);
    const posRef = useRef({ x: 0, y: 0 });
    const grabRef = useRef({ x: 0, y: 0 });

    /** 언마운트 시 남아있는 리스너/클래스를 정리하기 위한 훅 */
    const cleanupRef = useRef<(() => void) | null>(null);
    useEffect(() => () => cleanupRef.current?.(), []);

    const paintGhost = useCallback(() => {
        const node = ghostNodeRef.current
        if (!node) return
        const x = posRef.current.x - grabRef.current.x
        const y = posRef.current.y - grabRef.current.y
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }, []);

    /** 고스트 엘리먼트가 붙는 순간 현재 좌표를 바로 적용한다. (0,0 에서 튀어나오는 것 방지) */
    const ghostRef = useCallback((node: HTMLDivElement | null) => {
        ghostNodeRef.current = node
        if (node) paintGhost()
    }, [paintGhost]);

    const startReorder = useCallback((e: ReactPointerEvent, index: number) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        if (cleanupRef.current) return

        const row = (e.currentTarget as HTMLElement).closest('.block') as HTMLElement | null
        const startX = e.clientX
        const startY = e.clientY

        let activated = false
        let rafId = 0
        let lastY = startY

        posRef.current = { x: startX, y: startY }

        /** 포인터 Y 를 기준으로 "몇 번째 앞에 넣을지" 계산한다. */
        function updateOverIdx(clientY: number) {
            const list = listRef.current
            if (!list) return

            const rows = Array.from(list.children) as HTMLElement[]
            let next = rows.length

            for (let i = 0; i < rows.length; i++) {
                const rect = rows[i].getBoundingClientRect()
                if (clientY < rect.top + rect.height / 2) {
                    next = i
                    break
                }
            }

            if (overIdxRef.current === next) return
            overIdxRef.current = next
            setOverIdx(next)
        }

        function tick() {
            rafId = requestAnimationFrame(tick)

            const scroller = scrollerRef.current
            const top = scroller ? scroller.getBoundingClientRect().top : 0
            const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight

            let dy = 0
            if (lastY < top + EDGE) {
                dy = -MAX_SCROLL_SPEED * Math.min(1, (top + EDGE - lastY) / EDGE)
            } else if (lastY > bottom - EDGE) {
                dy = MAX_SCROLL_SPEED * Math.min(1, (lastY - (bottom - EDGE)) / EDGE)
            }
            if (dy === 0) return

            if (scroller) scroller.scrollTop += dy
            else window.scrollBy(0, dy)
            updateOverIdx(lastY)
        }

        function activate() {
            activated = true
            dragIdxRef.current = index
            overIdxRef.current = index

            const rect = row?.getBoundingClientRect()
            // 잡은 지점이 고스트 안에서도 같은 위치에 오도록 오프셋을 기억한다.
            grabRef.current = rect ? { x: startX - rect.left, y: startY - rect.top } : { x: 0, y: 0 }
            scrollerRef.current = scrollParentOf(listRef.current)
            document.body.classList.add('is-block-dragging')

            setDragIdx(index)
            setOverIdx(index)
            setGhost({
                block: blocksRef.current[index],
                width: Math.min(rect?.width ?? 320, GHOST_MAX_WIDTH),
            })

            rafId = requestAnimationFrame(tick)
        }

        const onMove = (event: PointerEvent) => {
            lastY = event.clientY
            posRef.current = { x: event.clientX, y: event.clientY }

            if (!activated) {
                if (Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_THRESHOLD) return
                activate()
            }

            paintGhost()
            updateOverIdx(lastY)
        }

        const finish = (commit: boolean) => {
            cleanupRef.current = null
            cancelAnimationFrame(rafId)
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            document.removeEventListener('pointercancel', onCancel)
            document.removeEventListener('keydown', onKeyDown)
            document.body.classList.remove('is-block-dragging')

            const from = dragIdxRef.current
            const to = overIdxRef.current

            dragIdxRef.current = null
            overIdxRef.current = null
            ghostNodeRef.current = null
            scrollerRef.current = null

            setGhost(null)
            setOverIdx(null)
            setDragIdx(null)

            if (!commit || !activated || from === null || to === null) return

            // to 는 "제거 전" 배열 기준의 삽입 위치이므로, 아래로 옮길 때 한 칸 당겨야 한다.
            const target = to > from ? to - 1 : to
            if (target === from) return

            const blocks = blocksRef.current.slice()
            const [moved] = blocks.splice(from, 1)
            blocks.splice(target, 0, moved)
            commitRef.current(blocks)
        }

        const onUp = () => finish(true)
        const onCancel = () => finish(false)
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') finish(false)
        }

        cleanupRef.current = () => finish(false)
        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
        document.addEventListener('pointercancel', onCancel)
        document.addEventListener('keydown', onKeyDown)
    }, [paintGhost]);

    return {
        dragIdx,
        overIdx,
        ghost,
        ghostRef,
        listRef,
        startReorder,
    };
}
