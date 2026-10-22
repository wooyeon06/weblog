import './BlockRow.scss'

import type { Ref } from 'react'
import { useCallback, useContext, useLayoutEffect, useMemo, useRef } from 'react'
import { useBlockEventHandler } from './useBlockEventHandler'
import { useBlockUtils } from './useBlockUtils'
import { useCodeFormat } from './useCodeFormat'
import { PLACEHOLDERS } from '../../../lib/blocks'
import { CODE_LANGUAGES, normalizeLang } from '../../../lib/codeLanguages'
import type { EditableField, RichField } from '../../../lib/editableField'
import { SLASH_ITEMS } from '../../../lib/slashItems'
import { normalizeTable } from '../../../lib/table'
import { EditorContext } from '../../../pages/EditorPage'
import { BlockType, type Block } from '../../../types'
import { CodeCopyButton } from '../../code/CodeCopyButton'
import { CodeHighlight } from '../../code/CodeHighlight'
import { RichInput } from '../rich/RichInput'
import BlockMenu from './BlockMenu'
import { TableBlock } from './table/TableBlock'

/**
 * 편집 이벤트는 훅(useBlockEventHandler·useBlockUtils)과 EditorContext 에서 직접 가져오므로,
 * props 에는 행마다 다르고 위에서만 알 수 있는 값만 둔다.
 */
type BlockRowProps = {
  block: Block
  /** 번호 목록의 번호. 앞 블록들을 세야 하므로 목록 전체를 아는 쪽에서 넘긴다. */
  listNumber?: number

  // 드래그 상태는 Editor 의 useDragBlockRow 하나가 관리한다.
  /** 지금 끌고 있는 블록 본체 */
  isDragging?: boolean
  /** 이 블록 "위"에 삽입선을 그린다 */
  dropBefore?: boolean
  /** 이 블록 "아래"(= 문서 끝)에 삽입선을 그린다 */
  dropAfter?: boolean
}

/** 커서를 따라다니는 드래그 미리보기 카드. 위치는 useDragBlockRow 가 transform 으로 직접 갱신한다. */
export function BlockGhost({
  block,
  width,
  ref,
}: {
  block: Block
  width: number
  ref?: Ref<HTMLDivElement>
}) {
  const meta = SLASH_ITEMS.find((item) => item.type === block.type)
  const isImage = block.type === BlockType.IMAGE
  const text = isImage ? '' : block.text.trim()

  return (
    <div className="block-ghost" style={{ width }} ref={ref} aria-hidden>
      {isImage ? (
        <img className="block-ghost__thumb" src={block.text} alt="" />
      ) : (
        <span className="block-ghost__icon">{meta?.icon ?? 'Aa'}</span>
      )}
      <span className={`block-ghost__text${text ? '' : ' block-ghost__text--empty'}`}>
        {text || meta?.label || '빈 블록'}
      </span>
    </div>
  )
}

export function BlockRow({ block, listNumber, isDragging, dropBefore, dropAfter }: BlockRowProps) {
  const { activeId, setActiveId, registerRef } = useContext(EditorContext)
  
  const { addBlockBelow, toggleCheck, setTable, setLang } = useBlockUtils();
  const { handleTextChange, handleKeyDown, handlePaste } = useBlockEventHandler()
  const isActive = block.id === activeId
if(isActive) console.log("%cactiveId", "color: green", `%c${activeId}`, "color: blue");

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { formatError, handleFormatKey } = useCodeFormat(textareaRef, block.lang, (text) =>
    handleTextChange(block.id, text, text.length),
  )

  const isDivider = block.type === BlockType.DIVIDER;
  const isCode = block.type === BlockType.CODE
  const isTable = block.type === BlockType.TABLE
  /** 코드 블록은 서식 없이 글자 그대로 다루므로 textarea 를 쓴다. 구분선은 키 입력만 받는 숨은 textarea. */
  const isPlain = isCode || isDivider

  // 저장소에서 온 값을 믿지 않고 항상 직사각형으로 맞춰서 넘긴다.
  const table = useMemo(() => (isTable ? normalizeTable(block.table) : null), [isTable, block.table]);

  const registerTableCell = useCallback(
    (element: EditableField | null) => registerRef(block.id, element),
    [registerRef, block.id],
  )
  const registerRichField = useCallback(
    (field: RichField | null) => registerRef(block.id, field),
    [registerRef, block.id],
  )

  useLayoutEffect(() => {
    const element = textareaRef.current
    if (!element || isDivider) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [block.text, block.type, isDivider, isPlain])

  const placeholder = block.text
    ? ''
    : block.type === BlockType.TEXT
      ? isActive
        ? PLACEHOLDERS.text ?? ''
        : ''
      : PLACEHOLDERS[block.type] ?? ''


  const blockClass = [
    `block block--${block.type}`,
    isDragging ? 'block--dragging' : '',
    dropBefore ? 'block--drop-before' : '',
    dropAfter ? 'block--drop-after' : '',
  ].filter(Boolean).join(' ');

  /** 코드·구분선 블록의 입력칸 */
  const plainInput = isPlain && (
    <textarea
      ref={(element) => {
        textareaRef.current = element
        registerRef(block.id, element)
      }}
      className={`block__input${isDivider ? ' block__input--hidden' : ''}`}
      value={block.text}
      rows={1}
      spellCheck={false}
      placeholder={placeholder}
      readOnly={isDivider}
      onChange={(event) =>
        handleTextChange(block.id, event.target.value, event.target.selectionStart)
      }
      onKeyDown={(event) => {
        // 코드 블록의 Shift+Alt+F 는 포맷으로 쓰고 에디터 키 처리로 넘기지 않는다.
        if (isCode && handleFormatKey(event)) return
        handleKeyDown(event, block.id)
      }}
      onPaste={(event) => handlePaste(event, block.id)}
      onFocus={() => setActiveId(block.id)}
    />
  )


  return (
    <div
      className={blockClass}
      data-block-id={block.id}
      data-indent={block.indent}
      data-active={isActive}
      style={{ marginLeft: block.indent * 24 }}
    >
      <div className="block__gutter">
        <button
          type="button"
          className="block__gutter-btn"
          title="아래에 블록 추가"
          aria-label="아래에 블록 추가"
          onClick={() => addBlockBelow(block.id)}
        >
          +
        </button>
        <BlockMenu block={block} />
      </div>

      <div className="block__body">
        {block.type === 'bulleted' && <span className="block__marker">•</span>}
        {block.type === 'numbered' && <span className="block__marker">{listNumber}.</span>}
        {block.type === 'todo' && (
          <input
            type="checkbox"
            className="block__checkbox"
            checked={Boolean(block.checked)}
            onChange={() => toggleCheck(block.id)}
            aria-label="할 일 완료"
          />
        )}
        {isDivider && <hr className="block__divider" />}

        {block.type === BlockType.IMAGE ? (
          <div className="block__image-wrap">
            <img className="block__image" src={block.text} alt="" />
          </div>
        ) : table ? (
          <TableBlock
            table={table}
            onChange={(next) => setTable(block.id, next)}
            onFocus={() => setActiveId(block.id)}
            registerFirstCell={registerTableCell}
          />
        ) : !isPlain ? (
          <RichInput
            fieldRef={registerRichField}
            className={`block__input${block.type === 'todo' && block.checked ? ' block__input--done' : ''}`}
            value={block.text}
            placeholder={placeholder}
            onChange={(text, caret) => handleTextChange(block.id, text, caret)}
            onKeyDown={(event) => handleKeyDown(event, block.id)}
            onPaste={(event) => handlePaste(event, block.id)}
            onFocus={() => setActiveId(block.id)}
          />
        ) : isCode ? (
          <div className="code-editor">
            <div className="code-editor__header">
              <select
                className="code-editor__lang"
                value={normalizeLang(block.lang)}
                onChange={(event) => setLang(block.id, event.target.value)}
                aria-label="코드 언어"
                title="코드 언어 (Shift+Alt+F 로 포맷)"
              >
                {CODE_LANGUAGES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <span className="code-editor__error" role="status">
                {formatError}
              </span>
              <CodeCopyButton code={block.text} className="code-editor__copy" />
            </div>
            {/* 글자가 투명한 textarea 아래에 색칠한 pre 를 겹쳐서, 입력은 textarea 로 받고 색은 pre 로 보여 준다. */}
            <div className="code-editor__area">
              <pre className="code-editor__highlight code-hl" aria-hidden>
                <CodeHighlight code={block.text} lang={block.lang} />
              </pre>
              {plainInput}
            </div>
          </div>
        ) : (
          plainInput
        )}
      </div>
    </div>
  )
}
