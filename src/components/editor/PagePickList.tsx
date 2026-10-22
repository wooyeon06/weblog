import './PagePickList.scss'

import { useMemo } from 'react'
import { usePostStore } from '../../storage/usePostStore'
import type { Post } from '../../types'

/**
 * 페이지 고르기 목록. 링크 입력칸 아래와 @ 메뉴에서 같이 쓴다.
 * 키보드 이동(↑↓·Enter)은 쓰는 쪽이 처리하고, 여기서는 그리기와 마우스만 맡는다.
 */
export function PagePickList({
  pages,
  activeIndex,
  onActiveIndexChange,
  onPick,
  emptyText = '일치하는 페이지가 없어요',
}: {
  pages: Post[]
  /** 강조된 항목. -1 이면 없음 */
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onPick: (post: Post) => void
  emptyText?: string
}) {
  const posts = usePostStore((state) => state.posts)
  const titleById = useMemo(() => new Map(posts.map((post) => [post.id, post.title || '제목 없음'])), [posts])

  return (
    <div
      className="page-pick"
      role="listbox"
      aria-label="페이지"
      // 눌러도 입력칸의 포커스·선택이 풀리지 않게 한다.
      onMouseDown={(event) => event.preventDefault()}
    >
      {pages.length === 0 ? (
        <div className="page-pick__empty">{emptyText}</div>
      ) : (
        pages.map((post, index) => (
          <button
            type="button"
            key={post.id}
            role="option"
            aria-selected={index === activeIndex}
            className={`page-pick__item${index === activeIndex ? ' page-pick__item--active' : ''}`}
            onMouseEnter={() => onActiveIndexChange(index)}
            onClick={() => onPick(post)}
          >
            <span className="page-pick__emoji">{post.emoji}</span>
            <span className={`page-pick__title${post.title ? '' : ' page-pick__title--empty'}`}>
              {post.title || '제목 없음'}
            </span>
            {/* 제목이 같은 페이지를 구분할 수 있게 상위 페이지를 함께 보여 준다. */}
            {post.parentId && titleById.has(post.parentId) && (
              <span className="page-pick__parent">{titleById.get(post.parentId)}</span>
            )}
          </button>
        ))
      )}
    </div>
  )
}
