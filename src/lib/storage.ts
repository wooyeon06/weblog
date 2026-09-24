import type { AiSettings, Post } from '../types'
import { uid } from './id'

/**
 * 데이터 저장소. 지금은 브라우저 localStorage 를 사용한다.
 * 나중에 서버 API 로 옮길 때 이 파일의 함수 본문만 교체하면 된다.
 */
const POSTS_KEY = 'welog:posts'
const SETTINGS_KEY = 'welog:ai-settings'
const SEEDED_KEY = 'welog:seeded'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn('[welog] localStorage 저장 실패', error)
  }
}

export function loadPosts(): Post[] {
  const posts = read<Post[]>(POSTS_KEY, [])
  return posts.slice().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function savePosts(posts: Post[]): void {
  write(POSTS_KEY, posts)
}

export function loadSettings(): AiSettings {
  return read<AiSettings>(SETTINGS_KEY, {
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-3.6-flash',
  })
}

export function saveSettings(settings: AiSettings): void {
  write(SETTINGS_KEY, settings)
}

export function createEmptyPost(): Post {
  const now = Date.now()
  return {
    id: uid('p_'),
    title: '',
    emoji: '📝',
    tags: [],
    blocks: [{ id: uid('b_'), type: 'text', text: '', indent: 0 }],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
}

/** 탭을 새로 열었을 때 빈 화면을 보지 않도록 예시 글을 한 번 넣어준다. */
export function seedIfEmpty(): Post[] {
  const existing = loadPosts()
  if (existing.length > 0 || localStorage.getItem(SEEDED_KEY)) return existing

  const now = Date.now()
  const sample: Post = {
    id: uid('p_'),
    title: 'welog 사용법',
    emoji: '👋',
    tags: ['가이드'],
    status: 'published',
    createdAt: now,
    updatedAt: now,
    blocks: [
      {
        id: uid('b_'),
        type: 'text',
        text: 'AI와 함께 쓰는 블로그입니다. 아래 내용을 지우고 바로 글을 써보세요.',
        indent: 0,
      },
      { id: uid('b_'), type: 'h2', text: '에디터', indent: 0 },
      {
        id: uid('b_'),
        type: 'bulleted',
        text: '빈 줄에서 `/` 를 누르면 블록 타입 메뉴가 열립니다.',
        indent: 0,
      },
      {
        id: uid('b_'),
        type: 'bulleted',
        text: '`# `, `- `, `1. `, `> `, `[] ` 처럼 마크다운을 입력하면 블록이 바뀝니다.',
        indent: 0,
      },
      { id: uid('b_'), type: 'bulleted', text: 'Tab / Shift+Tab 으로 들여쓰기.', indent: 0 },
      { id: uid('b_'), type: 'h2', text: 'AI 도우미', indent: 0 },
      {
        id: uid('b_'),
        type: 'numbered',
        text: '오른쪽 아래 **✨ 버튼**을 누르면 언제든 대화창이 열립니다.',
        indent: 0,
      },
      {
        id: uid('b_'),
        type: 'numbered',
        text: '작성 중인 글 전체를 문맥으로 넘기기 때문에 "이어서 써줘" 같은 요청이 됩니다.',
        indent: 0,
      },
      {
        id: uid('b_'),
        type: 'numbered',
        text: 'AI 답변 아래 **본문에 삽입** 을 누르면 블록으로 변환되어 들어갑니다.',
        indent: 0,
      },
      {
        id: uid('b_'),
        type: 'quote',
        text: '데이터는 localStorage 에 저장되므로 탭을 닫으면 사라집니다.',
        indent: 0,
      },
    ],
  }

  localStorage.setItem(SEEDED_KEY, '1')
  savePosts([sample])
  return [sample]
}
