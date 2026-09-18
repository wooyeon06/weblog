import './Editor.scss';

import type { Ref } from 'react'
import { useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  markdownToBlocks,
  newBlock,
  numberedIndex,
  postWordCount
} from '../../lib/blocks'
import { usePostStore } from '../../storage/usePostStore'
import { BlockType, type Block, type Post, type TableData } from '../../types'
import type { BlockAction } from './BlockRow'
import { BlockGhost, BlockRow } from './BlockRow'
import { PostView } from './PostView'
import { SlashMenu } from './SlashMenu'
import { EditorContext } from '../../pages/EditorPage'
import useBlockHandler from '../../hooks/useBlockHandler'
import Tag from './Tag'
import { useDragBlockRow } from '../../hooks/useDragBlockRow'

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
  ref?: Ref<EditorHandle>
}


/** 문서 끝에는 항상 클릭해서 이어 쓸 수 있는 빈 블록을 둔다. */
function withTrailingBlock(blocks: Block[]): Block[] {
  const last = blocks[blocks.length - 1]
  if (blocks.length === 0) return [newBlock()]
  if (last.type !== 'text' || last.text !== '') return [...blocks, newBlock()]
  return blocks
}

export function Editor({ post, onBack, savedLabel, ref }: EditorProps) {
  const { deletePost } = usePostStore();
  const { listRef, dragIdx, overIdx, ghost, ghostRef, startReorder } = useDragBlockRow();

  //EventHandler
  const { slashItems, pendingFocus, focusBlock, applySlashItem,
    commitBlocks, patch, handleTextChange, closeSlash, handleKeyDown, handlePaste } = useBlockHandler();
  
  //Provider Context
  const { activeId, setActiveId, slash, slashIndex, setSlashIndex, inputs} = useContext(EditorContext);

  const [preview, setPreview] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const activeIdRef = useRef<string | null>(null)

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const registerRef = useCallback((id: string, element: HTMLTextAreaElement | null) => {
    if (element) inputs.current.set(id, element)
    else inputs.current.delete(id)
  }, [])

  useEffect(() => {
    const request = pendingFocus.current
    if (!request) return
    const element = inputs.current.get(request.id)
    if (!element) return
    pendingFocus.current = null
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
   * 블록 행에서 발생한 액션을 처리한다. (위로 이동, 아래로 이동, 복제, 삭제)
   */
  const handleAction = useCallback(
    (id: string, action: BlockAction) => {
      const index = post.blocks.findIndex((block) => block.id === id)
      if (index < 0) return
      const blocks = post.blocks.slice()

      if (action === 'moveUp' && index > 0) {
        [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]]
      } else if (action === 'moveDown' && index < blocks.length - 1) {
        [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]]
      } else if (action === 'duplicate') {
        blocks.splice(index + 1, 0, { ...blocks[index], id: newBlock().id })
      } else if (action === 'delete') {
        blocks.splice(index, 1)
        const focusTarget = blocks[index - 1] ?? blocks[index]
        if (focusTarget) focusBlock(focusTarget.id, focusTarget.text.length)
      } else {
        return
      }
      commitBlocks(blocks)
    },
    [commitBlocks, focusBlock, post.blocks],
  )

  const addBlockBelow = useCallback(
    (id: string) => {
      const index = post.blocks.findIndex((block) => block.id === id)
      if (index < 0) return
      const blocks = post.blocks.slice()
      const next = newBlock('text', '', blocks[index].indent)
      blocks.splice(index + 1, 0, next)
      focusBlock(next.id, 0)
      commitBlocks(blocks)
    },
    [commitBlocks, focusBlock, post.blocks],
  )

  const handleTableChange = useCallback(
    (id: string, table: TableData) => {
      commitBlocks(post.blocks.map((block) => (block.id === id ? { ...block, table } : block)))
    },
    [commitBlocks, post.blocks],
  )

  const toggleCheck = useCallback(
    (id: string) => {
      const blocks = post.blocks.map((block) =>
        block.id === id ? { ...block, checked: !block.checked } : block,
      )
      commitBlocks(blocks)
    },
    [commitBlocks, post.blocks],
  )

  const focusLastBlock = useCallback(() => {
    const blocks = withTrailingBlock(post.blocks)
    const last = blocks[blocks.length - 1]
    focusBlock(last.id, last.text.length)
    if (blocks.length !== post.blocks.length) commitBlocks(blocks)
    else inputs.current.get(last.id)?.focus()
  }, [commitBlocks, focusBlock, post.blocks])

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
    [commitBlocks, focusBlock, post.blocks],
  )

  

  const wordCount = postWordCount(post)

  return (
    <div className="editor">
      <header className="editor__bar">
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

      <div className="editor__scroll">
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
                    isActive={block.id === activeId}
                    registerRef={registerRef}
                    onTextChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onFocus={setActiveId}
                    onToggleCheck={toggleCheck}
                    onAddBelow={addBlockBelow}
                    onAction={handleAction}
                    onTableChange={handleTableChange}

                    isDragging={dragIdx === index}
                    // overIdx 는 "이 블록 앞에 넣는다"는 뜻. 제자리로 돌아가는 위치에는 선을 그리지 않는다.
                    dropBefore={
                      dragIdx !== null && overIdx === index && index !== dragIdx && index !== dragIdx + 1
                    }
                    dropAfter={
                      dragIdx !== null &&
                      overIdx === post.blocks.length &&
                      index === post.blocks.length - 1 &&
                      dragIdx !== index
                    }
                    onReorderStart={(e) => startReorder(e, index)}
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

      {ghost && <BlockGhost ref={ghostRef} block={ghost.block} width={ghost.width} />}

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
