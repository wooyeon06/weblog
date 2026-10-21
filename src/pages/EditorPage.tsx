import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Ref } from 'react'
import { Editor } from '../components/editor/Editor'
import type { EditorHandle } from '../components/editor/Editor'
import { back, navigate } from '../lib/router'
import type { Block, Post, SaveState } from '../types'
import type { EditableField } from '../lib/editableField'
import { usePostStore } from '../storage/usePostStore'
import { newBlock } from '../lib/blocks'
import usePostHandler from '../hooks/usePostHandler'
import { BlockDragProvider } from '../components/editor/block/BlockDragProvider'
import { filterSlashItems, type SlashItem } from '../lib/slashItems'

type EditorPageProps = {
  /** 라우트의 id 로 찾은 글. 없으면(삭제·잘못된 링크) 목록으로 되돌린다. */
  post: Post | null
  saveState: SaveState
  /** AI 도우미가 본문 삽입/선택 영역 조회에 쓰는 핸들. */
  ref?: Ref<EditorHandle>
}

export type EditorProviderType = {
  activeId: string | null
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>
  slash: SlashState | null
  setSlash: React.Dispatch<React.SetStateAction<SlashState | null>>
  slashIndex: number
  setSlashIndex: React.Dispatch<React.SetStateAction<number>>
  /** 지금 슬래시 검색어에 맞는 메뉴 항목 */
  slashItems: SlashItem[]
  closeSlash: () => void
  /** 다음 렌더 뒤 포커스할 블록. 화면을 다시 그리지 않도록 ref 로 둔다. (Editor 가 꺼내 쓴다) */
  pendingFocusRef: React.RefObject<{ id: string; caret: number } | null>
  focusBlock: (id: string, caret: number) => void
  patch: (changes: Partial<Post>, post?: Post) => void
  commitBlocks: (blocks: Block[], post?: Post) => void
  /** 블록 id → 입력칸. 위치는 모두 마크다운 기준이다. */
  inputs: React.RefObject<Map<string, EditableField>>
  /** 블록 입력칸을 inputs 에 등록(element)/해제(null)한다. */
  registerRef: (id: string, element: EditableField | null) => void
  activePost : Post | null
} 


export type SlashState = {
  blockId: string
  start: number
  query: string
  anchor: { left: number; top: number; bottom: number }
}



export const EditorContext = createContext<EditorProviderType>({} as EditorProviderType);

const EditorProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const {activePost} = usePostHandler();
  const inputs = useRef(new Map<string, EditableField>())

  /** 블록 입력칸이 마운트/언마운트될 때 inputs 에 등록/해제한다. */
  const registerRef = useCallback((id: string, element: EditableField | null) => {
    if (element) inputs.current.set(id, element)
    else inputs.current.delete(id)
  }, [])

  //=============================== Focus [S] ===============================
  //다음 렌더가 끝나면 이 블록의 이 위치에 커서를 놓아라"라는 예약 메모
  const pendingFocusRef = useRef<{ id: string; caret: number } | null>(null);

  const focusBlock = useCallback((id: string, caret: number) => {
    pendingFocusRef.current = { id, caret }
  }, [])
  //=============================== Focus [E] ===============================

  const slashItems = useMemo(() => (slash ? filterSlashItems(slash.query) : []), [slash]); //  `/` 눌렀을 때 나오는 항목
  const closeSlash = useCallback(() => {
    setSlash(null)
    setSlashIndex(0)
  }, []);

  //=============================== Block [S] ===============================
  const onChange = usePostStore((state) => state.updatePost);
  
  //post 저장
  const patch = useCallback(
    (changes: Partial<Post>, post? : Post) => {
      if(!post) {
        if(activePost) onChange({ ...activePost, ...changes, updatedAt: Date.now() })
      } else {
        onChange({ ...post, ...changes, updatedAt: Date.now() })
      }
    },
    // activePost 가 빠지면 마운트 시점의 글을 계속 덮어써서 제목/태그가 되돌아간다.
    [onChange, activePost],
  )

  //block 저장
  const commitBlocks = useCallback(
    (blocks: Block[], post? : Post) => {
      if(!post) {
        if(activePost) patch({ blocks: blocks.length ? blocks : [newBlock()] }, activePost)
      } else {
        patch({ blocks: blocks.length ? blocks : [newBlock()] }, post)
      }
    },
    [patch, activePost],
  )
  //=============================== Block [E] ===============================


  return (
    <EditorContext.Provider value={{ activeId, setActiveId, slash, setSlash, slashIndex, 
    setSlashIndex, slashItems, closeSlash, pendingFocusRef, focusBlock, patch, commitBlocks, inputs, registerRef, activePost }}>
      {children}
    </EditorContext.Provider>
  )
}

/** `#/p/:id` 에디터 화면. */
export function EditorPage({ post, saveState, ref }: EditorPageProps) {
  useEffect(() => {
    if (!post) navigate({ name: 'list' }, { replace: true })
  }, [post])

  if (!post) return null

  const savedLabel =
    saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '세션에 저장됨' : ''

  return (
    <EditorProvider>
      <BlockDragProvider>
        <Editor
          ref={ref}
          post={post}
          onBack={back}
          savedLabel={savedLabel}
        />
      </BlockDragProvider>
    </EditorProvider>
  )
}
