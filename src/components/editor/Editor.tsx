import './Editor.scss';

import type { ReactNode, Ref } from 'react'
import { useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  markdownToBlocks,
  newBlock,
  numberedIndex,
  postWordCount
} from '../../lib/blocks'
import { usePostStore } from '../../storage/usePostStore'
import { BlockType, type Block, type Post } from '../../types'
import { BlockGhost, BlockRow } from './block/BlockRow'
import { PostView } from '../postview/PostView'
import { PageMention } from './PageMention'
import { SlashMenu } from './SlashMenu'
import { TableOfContents } from './tableofcontents/TableOfContents'
import { SelectionToolbar } from './block/SelectionToolbar'
import { EditorContext } from '../../pages/EditorPage'
import { useBlockUtils } from './block/useBlockUtils'
import Tag from './Tag'
import { useBlockDrag } from './block/useDragBlockRow'

const EMOJIS = ['📝', '💡', '🚀', '🌱', '📚', '🧠', '☕', '🎨', '🔧', '🐛', '✨', '🗺️']

export type EditorHandle = {
  /** AI 답변을 현재 커서 위치에 블록으로 삽입한다. */
  insertMarkdown: (markdown: string) => void
  /** 선택된 텍스트가 있으면 반환한다. */
  getSelectedText: () => string
}

type EditorProps = {
  post: Post
  onBack: () => void
  savedLabel: string
  /** 상단 바 맨 앞에 둘 요소 (사이드바가 닫혔을 때 여는 버튼) */
  barStart?: ReactNode
  ref?: Ref<EditorHandle>
}


/** 문서 끝에는 항상 클릭해서 이어 쓸 수 있는 빈 블록을 둔다. */
function withTrailingBlock(blocks: Block[]): Block[] {
  const last = blocks[blocks.length - 1]
  if (blocks.length === 0) return [newBlock()]
  if (last.type !== 'text' || last.text !== '') return [...blocks, newBlock()]
  return blocks
}

export function Editor({ post, onBack, savedLabel, barStart, ref }: EditorProps) {
  const { deletePost } = usePostStore();
  const { listRef, ghost, ghostRef } = useBlockDrag();

  //Utils (블록 편집 이벤트는 BlockRow 가 직접 훅에서 가져온다)
  const { applySlashItem } = useBlockUtils();

  //Provider Context
  const { activeId, setActiveId, slash, slashIndex, setSlashIndex, slashItems, closeSlash,
    pendingFocusRef, focusBlock, inputs, commitBlocks, patch } = useContext(EditorContext);

  const [preview, setPreview] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const activeIdRef = useRef<string | null>(null)
  /** 본문 스크롤 영역. 목차가 스크롤 위치를 읽고 제목으로 이동할 때 쓴다. */
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    const request = pendingFocusRef.current
    if (!request) return

    const element = inputs.current.get(request.id)
    if (!element) return

    pendingFocusRef.current = null

    element.focus()
    const caret = Math.min(request.caret, element.value.length)
    element.setSelectionRange(caret, caret)
  })

  useEffect(() => {
    const element = titleRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [post.title, preview])

  
  // ---------------------------------------------------------------- 블록 편집
  /**
   * 커서가 마지막 블록에 있으면 새 블록을 추가하고, 아니면 마지막 블록으로 포커스한다.
   * @returns 새 블록이 추가되었으면 true, 아니면 false
   */
  const focusLastBlock = useCallback(() => {
    const blocks = withTrailingBlock(post.blocks)
    const last = blocks[blocks.length - 1]
    focusBlock(last.id, last.text.length)
    if (blocks.length !== post.blocks.length) commitBlocks(blocks)
    else inputs.current.get(last.id)?.focus()
  }, [commitBlocks, focusBlock, inputs, post.blocks])

  // ------------------------------------------------------------- AI 삽입 API

  useImperativeHandle(
    ref,
    () => ({
      insertMarkdown: (markdown: string) => {
        const inserted = markdownToBlocks(markdown)
        if (inserted.length === 0) return
        const blocks = post.blocks.slice()
        const activeIndex = blocks.findIndex((block) => block.id === activeIdRef.current)
        const at = activeIndex >= 0 ? activeIndex : blocks.length - 1
        const anchorBlock = blocks[at]

        if (anchorBlock && anchorBlock.type === 'text' && !anchorBlock.text) {
          blocks.splice(at, 1, ...inserted)
        } else {
          blocks.splice(at + 1, 0, ...inserted)
        }

        const withTail = withTrailingBlock(blocks)
        const last = inserted[inserted.length - 1]
        focusBlock(last.id, last.text.length)
        setActiveId(last.id)
        commitBlocks(withTail, post)
      },
      getSelectedText: () => {
        const element = activeIdRef.current ? inputs.current.get(activeIdRef.current) : null
        if (!element) return ''
        return element.value.slice(element.selectionStart, element.selectionEnd)
      },
    }),
    [commitBlocks, focusBlock, inputs, post, setActiveId],
  )

  

  const wordCount = postWordCount(post)

  return (
    <div className="editor">
      <header className="editor__bar">
        {barStart}
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          ← 목록
        </button>
        <span className="editor__saved">{savedLabel}</span>
        <div className="editor__bar-right">
          <span className="editor__count">{wordCount}자</span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => patch({ status: post.status === 'published' ? 'draft' : 'published' })}
          >
            {post.status === 'published' ? '🌐 발행됨' : '🔒 초안'}
          </button>
          <button
            type="button"
            className={`btn btn--ghost${preview ? ' btn--on' : ''}`}
            onClick={() => setPreview((value) => !value)}
          >
            {preview ? '✏️ 편집' : '👁 읽기'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--danger"
            onClick={() => {
              if (window.confirm('이 글을 삭제할까요?')) deletePost(post.id)
            }}
          >
            삭제
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="editor__scroll">
        <div className="editor__page">
          <div className="editor__emoji-row">
            <button
              type="button"
              className="editor__emoji"
              onClick={() => setEmojiOpen((open) => !open)}
              aria-label="아이콘 변경"
            >
              {post.emoji}
            </button>
            {emojiOpen && (
              <div className="emoji-picker">
                {EMOJIS.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => {
                      patch({ emoji })
                      setEmojiOpen(false)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {preview ? (
            <>
              <h1 className="editor__title-view">{post.title || '제목 없음'}</h1>
              {post.tags.length > 0 && (
                <div className="tag-row">
                  {post.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <PostView blocks={post.blocks} />
            </>
          ) : (
            <>
              <textarea
                ref={titleRef}
                className="editor__title"
                placeholder="제목 없음"
                value={post.title}
                rows={1}
                onChange={(event) => patch({ title: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    const first = post.blocks[0]
                    if (first) {
                      focusBlock(first.id, 0)
                      inputs.current.get(first.id)?.focus()
                    }
                  }
                }}
              />
              <Tag post={post} />
              <div ref={listRef} className="editor__blocks">
                {post.blocks.map((block, index) => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    listNumber={block.type === BlockType.NUMBERED ? numberedIndex(post.blocks, index) : undefined}
                  />
                ))}
              </div>

              <div
                className="editor__tail"
                onClick={focusLastBlock}
                role="presentation"
                aria-hidden
              />
            </>
          )}
        </div>
      </div>

      <TableOfContents blocks={post.blocks} scrollRef={scrollRef} />

      {ghost && <BlockGhost ref={ghostRef} block={ghost.block} width={ghost.width} />}

      {!preview && <SelectionToolbar containerRef={listRef} />}
      {!preview && <PageMention containerRef={listRef} />}

      {slash && slashItems.length > 0 && (
        <SlashMenu
          items={slashItems}
          anchor={slash.anchor}
          activeIndex={Math.min(slashIndex, slashItems.length - 1)}
          onActiveIndexChange={setSlashIndex}
          onSelect={applySlashItem}
          onClose={closeSlash}
        />
      )}
    </div>
  )
}
