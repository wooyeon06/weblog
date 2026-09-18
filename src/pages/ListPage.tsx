import { PostList } from '../components/PostList'
import { navigate } from '../lib/router'
import type { Post } from '../types'

type ListPageProps = {
  posts: Post[]
  onCreate: () => void
  onDelete: (id: string) => void
  onOpenSettings: () => void
}

/** `#/` 목록 화면. */
export function ListPage({ posts, onCreate, onDelete, onOpenSettings }: ListPageProps) {
  return (
    <>
      <PostList
        posts={posts}
        onOpen={(id) => navigate({ name: 'editor', id })}
        onCreate={onCreate}
        onDelete={onDelete}
        onOpenSettings={onOpenSettings}
      />
      <p className="storage-note">
        데이터는 이 브라우저 탭의 localStorage 에 저장됩니다. 탭을 닫으면 초기화됩니다.
      </p>
    </>
  )
}
