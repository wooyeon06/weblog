import './Sidebar.scss'

import { useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../../lib/router'
import { createEmptyPost } from '../../lib/storage'
import { usePostStore } from '../../storage/usePostStore'
import type { Post } from '../../types'
import { ancestorsOf, groupByParent, movePage, resolveDrop, ROOT, type DropTarget } from './pageTree'
import { usePageDrag } from './usePageDrag'

/** 펼쳐 둔 페이지 id 목록을 기억하는 localStorage 키 */
const EXPANDED_KEY = 'welog:sidebar-expanded'
/** 이 폭보다 좁으면 사이드바가 본문 위에 겹쳐 뜨므로, 페이지를 고르면 닫는다. (Sidebar.scss 와 같은 값) */
const OVERLAY_QUERY = '(max-width: 900px)'
/** 트리 한 단계 들여쓰기(px) */
const DEPTH_INDENT = 14

function loadExpanded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/** 노션처럼 페이지를 트리로 보여 주는 왼쪽 사이드바. 에디터 화면에서만 쓴다. */
export function Sidebar({ activeId, open, onClose }: { activeId: string; open: boolean; onClose: () => void }) {
  const { posts, setPosts, deletePost } = usePostStore()
  const children = useMemo(() => groupByParent(posts), [posts])
  const [expanded, setExpanded] = useState(loadExpanded)

  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded]))
    } catch {
      // 저장하지 못해도 이번 화면에서는 그대로 동작한다.
    }
  }, [expanded])

  // 다른 곳(링크·목록)에서 하위 페이지를 열었을 때도 트리에서 보이도록 상위 페이지들을 펼친다.
  // 열린 페이지가 바뀔 때만 맞추고(렌더 중에 이전 값과 비교), 사용자가 일부러 접은 것은 그대로 둔다.
  const [revealedId, setRevealedId] = useState<string | null>(null)
  if (revealedId !== activeId) {
    setRevealedId(activeId)
    const ancestors = ancestorsOf(posts, activeId)
    if (ancestors.some((id) => !expanded.has(id))) setExpanded(new Set([...expanded, ...ancestors]))
  }

  const scrollerRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLUListElement>(null)

  /** 끌어다 놓은 곳으로 페이지를 옮긴다. 하위로 넣었으면 그 페이지를 펼쳐서 보이게 한다. */
  const dropPage = (dragId: string, target: DropTarget) => {
    const place = resolveDrop(children, expanded, dragId, target)
    const next = movePage(posts, children, dragId, place)
    if (next === posts) return
    setPosts(next)
    if (place.parentId !== ROOT) setExpanded((current) => new Set([...current, place.parentId]))
  }

  const { dragging, drop, ghostRef, startDrag } = usePageDrag({
    posts,
    scrollerRef,
    treeRef,
    onDrop: dropPage,
  })

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const openPage = (id: string) => {
    navigate({ name: 'editor', id })
    if (window.matchMedia(OVERLAY_QUERY).matches) onClose()
  }

  const addPage = (parentId?: string) => {
    const post: Post = { ...createEmptyPost(), parentId }
    setPosts((list) => [post, ...list])
    if (parentId) setExpanded((current) => new Set([...current, parentId]))
    openPage(post.id)
  }

  const removePage = (post: Post) => {
    const childCount = children.get(post.id)?.length ?? 0
    const message =
      `"${post.title || '제목 없음'}" 페이지를 삭제할까요?` +
      (childCount > 0 ? `\n하위 페이지 ${childCount}개는 한 단계 위로 옮겨집니다.` : '')
    if (!window.confirm(message)) return
    // 열려 있는 페이지를 지우면 상위 페이지로, 없으면 목록으로 간다.
    if (post.id === activeId) {
      if (post.parentId) navigate({ name: 'editor', id: post.parentId }, { replace: true })
      else navigate({ name: 'list' }, { replace: true })
    }
    deletePost(post.id)
  }

  /** 이 줄에 그릴 놓기 표시. 펼친 페이지의 "아래"는 첫 하위 자리이므로 한 단계 들여서 그린다. */
  const dropClassOf = (post: Post, depth: number, hasKids: boolean) => {
    if (!drop || drop.kind === 'end' || drop.id !== post.id) return { className: '', indent: depth }
    const intoKids = drop.kind === 'after' && hasKids && expanded.has(post.id)
    return { className: ` sidebar__row--drop-${drop.kind}`, indent: intoKids ? depth + 1 : depth }
  }

  const renderTree = (parentId: string, depth: number) =>
    (children.get(parentId) ?? []).map((post) => {
      const kids = children.get(post.id) ?? []
      const isOpen = expanded.has(post.id)
      const dropMark = dropClassOf(post, depth, kids.some((kid) => kid.id !== dragging?.post.id))
      return (
        <li key={post.id}>
          <div
            className={
              'sidebar__row' +
              (post.id === activeId ? ' sidebar__row--active' : '') +
              (post.id === dragging?.post.id ? ' sidebar__row--dragging' : '') +
              dropMark.className
            }
            data-page-id={post.id}
            style={{
              paddingLeft: 6 + depth * DEPTH_INDENT,
              ['--drop-indent' as string]: `${6 + dropMark.indent * DEPTH_INDENT}px`,
            }}
          >
            <button
              type="button"
              className={`sidebar__toggle${kids.length ? '' : ' sidebar__toggle--empty'}`}
              aria-label={isOpen ? '접기' : '펼치기'}
              aria-expanded={kids.length ? isOpen : undefined}
              tabIndex={kids.length ? 0 : -1}
              onClick={() => toggle(post.id)}
            >
              {isOpen ? '▾' : '▸'}
            </button>
            <button
              type="button"
              className="sidebar__link"
              aria-current={post.id === activeId ? 'page' : undefined}
              title={post.title || '제목 없음'}
              onPointerDown={(event) => startDrag(event, post)}
              onClick={() => openPage(post.id)}
            >
              <span className="sidebar__emoji">{post.emoji}</span>
              <span className={`sidebar__title${post.title ? '' : ' sidebar__title--empty'}`}>
                {post.title || '제목 없음'}
              </span>
            </button>
            <span className="sidebar__actions">
              <button type="button" title="하위 페이지 추가" aria-label="하위 페이지 추가" onClick={() => addPage(post.id)}>
                +
              </button>
              <button type="button" title="삭제" aria-label="페이지 삭제" onClick={() => removePage(post)}>
                🗑
              </button>
            </span>
          </div>
          {isOpen && kids.length > 0 && <ul className="sidebar__tree">{renderTree(post.id, depth + 1)}</ul>}
        </li>
      )
    })

  return (
    <>
      {/* 닫혀도 지우지 않고 접어 두어야 열고 닫을 때 애니메이션이 보인다. 닫힌 동안은 inert 로 포커스를 막는다. */}
      <aside className={`sidebar${open ? '' : ' sidebar--closed'}`} aria-label="페이지 목록" inert={!open}>
        <div ref={scrollerRef} className="sidebar__inner">
          <div className="sidebar__head">
            <button type="button" className="sidebar__home" onClick={() => navigate({ name: 'list' })}>
              📒 내 글
            </button>
            <button type="button" className="sidebar__close" title="사이드바 닫기" aria-label="사이드바 닫기" onClick={onClose}>
              «
            </button>
          </div>
          <button type="button" className="sidebar__new" onClick={() => addPage()}>
            + 새 페이지
          </button>
          <ul
            ref={treeRef}
            className={`sidebar__tree sidebar__tree--root${drop?.kind === 'end' ? ' sidebar__tree--drop-end' : ''}`}
          >
            {renderTree(ROOT, 0)}
          </ul>
        </div>
      </aside>
      {/* 좁은 화면에서 사이드바 바깥을 누르면 닫는다. */}
      <div className={`sidebar-backdrop${open ? ' sidebar-backdrop--open' : ''}`} onClick={onClose} aria-hidden />
      {dragging && (
        <div ref={ghostRef} className="page-ghost" style={{ width: dragging.width }} aria-hidden>
          <span className="sidebar__emoji">{dragging.post.emoji}</span>
          <span className="page-ghost__title">{dragging.post.title || '제목 없음'}</span>
        </div>
      )}
    </>
  )
}
