/** 사이드바 페이지 트리 계산. 화면과 상관없는 순수 함수만 둔다. */
import type { Post } from '../../types'

/** 최상위 페이지 묶음의 키 */
export const ROOT = ''

/** 끌어 옮긴 적이 있으면 order, 없으면 만든 시각. 새 페이지는 만든 시각이 커서 맨 아래에 붙는다. */
const sortKey = (post: Post) => post.order ?? post.createdAt

/** 상위 페이지 id → 하위 페이지 목록(순서대로). 상위가 없거나 사라진 글은 최상위에 둔다. */
export function groupByParent(posts: Post[]): Map<string, Post[]> {
  const ids = new Set(posts.map((post) => post.id))
  const groups = new Map<string, Post[]>()
  for (const post of posts) {
    const key = post.parentId && ids.has(post.parentId) ? post.parentId : ROOT
    groups.set(key, [...(groups.get(key) ?? []), post])
  }
  for (const list of groups.values()) list.sort((a, b) => sortKey(a) - sortKey(b))
  return groups
}

/** 가까운 상위부터 최상위까지의 상위 페이지 id */
export function ancestorsOf(posts: Post[], id: string): string[] {
  const byId = new Map(posts.map((post) => [post.id, post]))
  const ancestors: string[] = []
  for (let parent = byId.get(id)?.parentId; parent && byId.has(parent); parent = byId.get(parent)?.parentId) {
    if (ancestors.includes(parent)) break // 잘못된 데이터로 생긴 순환은 멈춘다.
    ancestors.push(parent)
  }
  return ancestors
}

/** id 가 rootId 자신이거나 그 하위 페이지인지. (자기 안으로는 옮길 수 없다) */
export function isWithin(posts: Post[], id: string, rootId: string): boolean {
  return id === rootId || ancestorsOf(posts, id).includes(rootId)
}

/** 끌어서 놓을 곳: 어떤 페이지의 앞·뒤·안, 또는 최상위 맨 끝 */
export type DropTarget = { kind: 'before' | 'after' | 'inside'; id: string } | { kind: 'end' }

/** 놓을 곳 → 새 상위 페이지와, 그 하위 목록(옮기는 페이지를 뺀)에서의 자리 */
export function resolveDrop(
  groups: Map<string, Post[]>,
  expanded: Set<string>,
  dragId: string,
  drop: DropTarget,
): { parentId: string; index: number } {
  const siblingsOf = (parentId: string) => (groups.get(parentId) ?? []).filter((post) => post.id !== dragId)

  if (drop.kind === 'end') return { parentId: ROOT, index: siblingsOf(ROOT).length }
  if (drop.kind === 'inside') return { parentId: drop.id, index: siblingsOf(drop.id).length }
  // 펼쳐 둔 페이지의 "바로 아래"는 화면상 그 첫 하위 페이지 자리다.
  if (drop.kind === 'after' && expanded.has(drop.id) && siblingsOf(drop.id).length > 0) {
    return { parentId: drop.id, index: 0 }
  }

  const parentId = [...groups].find(([, list]) => list.some((post) => post.id === drop.id))?.[0] ?? ROOT
  const at = siblingsOf(parentId).findIndex((post) => post.id === drop.id)
  return { parentId, index: drop.kind === 'before' ? at : at + 1 }
}

/**
 * 페이지를 새 상위 페이지의 index 자리로 옮긴다. 그 묶음의 순서(order)를 0부터 다시 매긴다.
 * 제자리면 같은 배열을 그대로 돌려준다.
 */
export function movePage(
  posts: Post[],
  groups: Map<string, Post[]>,
  dragId: string,
  { parentId, index }: { parentId: string; index: number },
): Post[] {
  const dragged = posts.find((post) => post.id === dragId)
  if (!dragged) return posts

  const current = groups.get(parentId) ?? []
  const next = current.filter((post) => post.id !== dragId)
  next.splice(index, 0, dragged)
  if (next.length === current.length && next.every((post, i) => post === current[i])) return posts

  const order = new Map(next.map((post, i) => [post.id, i]))
  return posts.map((post) => {
    const at = order.get(post.id)
    if (at === undefined) return post
    return post.id === dragId ? { ...post, order: at, parentId: parentId || undefined } : { ...post, order: at }
  })
}
