import { useMemo, useState } from 'react'
import type { Post, PostStatus } from '../types'
import { blocksToPlainText, formatRelative, postExcerpt, postWordCount } from '../lib/blocks'

type Filter = 'all' | PostStatus

type PostListProps = {
  posts: Post[]
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onOpenSettings: () => void
}

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'published', label: '발행' },
  { id: 'draft', label: '초안' },
]

export function PostList({ posts, onOpen, onCreate, onDelete, onOpenSettings }: PostListProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [tag, setTag] = useState<string | null>(null)

  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const post of posts) {
      for (const value of post.tags) counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [posts]);


  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return posts.filter((post) => {
      if (filter !== 'all' && post.status !== filter) return false
      const haystack = `${post.title} ${post.tags.join(' ')} ${blocksToPlainText(post.blocks)}`
      return haystack.toLowerCase().includes(q)
    })
  }, [filter, posts, query, tag])

  return (
    <div className="list">
      <header className="list__head">
        <div className="list__brand">
          <span className="list__logo">✒️</span>
          <div>
            <h1>weblog</h1>
            <p>AI와 함께 쓰는 블로그</p>
          </div>
        </div>
        <div className="list__head-actions">
          <button type="button" className="btn btn--ghost" onClick={onOpenSettings}>
            ⚙ AI 설정
          </button>
          <button type="button" className="btn btn--primary" onClick={onCreate}>
            + 새 글 쓰기
          </button>
        </div>
      </header>

      <div className="list__toolbar">
        <input
          className="search"
          placeholder="제목, 내용, 태그 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="segmented">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={filter === item.id ? 'segmented__on' : undefined}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span className="segmented__count">
                {item.id === 'all'
                  ? posts.length
                  : posts.filter((post) => post.status === item.id).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="tag-row tag-row--filter">
          <button
            type="button"
            className={`tag${tag === null ? ' tag--on' : ''}`}
            onClick={() => setTag(null)}
          >
            모든 태그
          </button>
          {tags.map(([value, count]) => (
            <button
              type="button"
              key={value}
              className={`tag${tag === value ? ' tag--on' : ''}`}
              onClick={() => setTag(tag === value ? null : value)}
            >
              #{value} <span className="tag__count">{count}</span>
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty">
          <p className="empty__emoji">🗒️</p>
          <p className="empty__title">
            {posts.length === 0 ? '아직 글이 없습니다' : '조건에 맞는 글이 없습니다'}
          </p>
          <p className="empty__desc">
            {posts.length === 0
              ? '첫 글을 쓰고, 오른쪽 아래 ✨ 버튼으로 AI와 함께 이어가 보세요.'
              : '검색어나 필터를 바꿔보세요.'}
          </p>
          {posts.length === 0 && (
            <button type="button" className="btn btn--primary" onClick={onCreate}>
              + 새 글 쓰기
            </button>
          )}
        </div>
      ) : (
        <div className="cards">
          {visible.map((post) => (
            <article
              className="card"
              key={post.id}
              onClick={() => onOpen(post.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpen(post.id)
                }
              }}
            >
              <div className="card__top">
                <span className="card__emoji">{post.emoji}</span>
                <span className={`badge badge--${post.status}`}>
                  {post.status === 'published' ? '발행' : '초안'}
                </span>
                <button
                  type="button"
                  className="card__delete"
                  title="삭제"
                  aria-label="글 삭제"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (window.confirm(`"${post.title || '제목 없음'}" 글을 삭제할까요?`)) {
                      onDelete(post.id)
                    }
                  }}
                >
                  🗑
                </button>
              </div>
              <h2 className="card__title">{post.title || '제목 없음'}</h2>
              <p className="card__excerpt">{postExcerpt(post) || '내용이 없습니다.'}</p>
              <div className="card__tags">
                {post.tags.map((value) => (
                  <span className="tag tag--sm" key={value}>
                    #{value}
                  </span>
                ))}
              </div>
              <footer className="card__meta">
                <span>{formatRelative(post.updatedAt)}</span>
                <span>{postWordCount(post)}자</span>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
