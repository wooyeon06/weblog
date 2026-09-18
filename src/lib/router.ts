import { useSyncExternalStore } from 'react'

/**
 * 의존성 없는 초소형 해시 라우터.
 *
 * `#/` 목록, `#/p/:id` 에디터 두 개의 경로만 있으면 되므로 라이브러리를 쓰지 않는다.
 * 해시를 쓰는 이유는 정적 호스팅(GitHub Pages 등)에서 서버 rewrite 설정 없이도
 * `#/p/xxx` 링크를 새로고침·공유할 수 있기 때문이다.
 */
export type Route = { name: 'list' } | { name: 'editor'; id: string }

export function toPath(route: Route): string {
  return route.name === 'editor' ? `#/p/${encodeURIComponent(route.id)}` : '#/'
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '')
  const match = /^\/p\/([^/?#]+)/.exec(path)
  if (match) return { name: 'editor', id: decodeURIComponent(match[1]) }
  return { name: 'list' }
}

let current: Route = parseHash(window.location.hash)
const listeners = new Set<() => void>()

function sync() {
  const next = parseHash(window.location.hash)
  if (toPath(next) === toPath(current)) return
  current = next
  for (const listener of listeners) listener()
}

// pushState/replaceState 는 hashchange 를 발생시키지 않으므로 navigate() 안에서 직접 sync 한다.
window.addEventListener('popstate', sync)
window.addEventListener('hashchange', sync)

/** 히스토리 항목마다 앱 안에서 몇 번째로 쌓인 화면인지 기록해 둔다. */
function depth(): number {
  const state = window.history.state as { d?: number } | null
  return typeof state?.d === 'number' ? state.d : 0
}

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const url = toPath(route)
  if (options.replace) {
    window.history.replaceState({ d: depth() }, '', url)
  } else {
    if (url === toPath(current)) return
    window.history.pushState({ d: depth() + 1 }, '', url)
  }
  sync()
}

/**
 * 뒤로가기. 앱 안에서 쌓인 화면이 있으면 히스토리를 되감고,
 * `#/p/xxx` 로 바로 들어온 경우(뒤가 남의 페이지)에는 목록으로 교체한다.
 */
export function back(): void {
  if (depth() > 0) window.history.back()
  else navigate({ name: 'list' }, { replace: true })
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}
