import './BlockRow.scss'

import type { ClipboardEvent, KeyboardEvent, PointerEvent, ReactNode, Ref } from 'react'
import { createContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PLACEHOLDERS } from '../../../lib/blocks'
import { normalizeTable } from '../../../lib/table'
import type { EditableField, RichField } from '../../../lib/editableField'
import { BlockType, type Block, type TableData } from '../../../types'
import BlockMenu from '../BlockMenu'
import { SLASH_ITEMS } from '../../../lib/slashItems'
import { RichInput } from '../rich/RichInput'
import { TableBlockWrapper } from './table/TableBlockWrapper'

export type BlockAction = 'moveUp' | 'moveDown' | 'duplicate' | 'delete'

/** 드래그로 볼지 클릭으로 볼지 가르는 거리 (useDragItem 의 임계값과 맞춘다) */
const CLICK_SLOP = 4

type BlockRowProps = {
  block: Block
  listNumber?: number
  isActive: boolean
  registerRef: (id: string, element: EditableField | null) => void
  onTextChange: (id: string, text: string, caret: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>, id: string) => void
  onPaste: (event: ClipboardEvent<HTMLElement>, id: string) => void
  onFocus: (id: string) => void
  onToggleCheck: (id: string) => void
  onAddBelow: (id: string) => void
  onAction: (id: string, action: BlockAction) => void
  onTableChange: (id: string, table: TableData) => void

  /** 지금 끌고 있는 블록 본체 */
  isDragging?: boolean
  /** 이 블록 "위"에 삽입선을 그린다 */
  dropBefore?: boolean
  /** 이 블록 "아래"(= 문서 끝)에 삽입선을 그린다 */
  dropAfter?: boolean
  onReorderStart?: (event: PointerEvent) => void
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

// eslint-disable-next-line react-refresh/only-export-components
export const BlockRowContext = createContext<BlockRowProps>({} as BlockRowProps);

export const BlockRowProvider = ({children, props} :  {props : BlockRowProps, children : ReactNode}) => {
  return (
      <BlockRowContext.Provider value={props}>
          {children}
      </BlockRowContext.Provider>
  )
}

export function BlockRow(props: BlockRowProps) {
  const {
    block,
    listNumber,
    isActive,
    registerRef,
    onTextChange,
    onKeyDown,
    onPaste,
    onFocus,
    onToggleCheck,
    onAddBelow,
    onTableChange,
    isDragging,
    dropBefore,
    dropAfter,
    onReorderStart,
  } = props
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const pressRef = useRef<{ x: number; y: number; wasOpen: boolean } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const isDivider = block.type === BlockType.DIVIDER;
  const isTable = block.type === BlockType.TABLE
  /** 코드 블록은 서식 없이 글자 그대로 다루므로 textarea 를 쓴다. 구분선은 키 입력만 받는 숨은 textarea. */
  const isPlain = block.type === BlockType.CODE || isDivider

  // 저장소에서 온 값을 믿지 않고 항상 직사각형으로 맞춰서 넘긴다.
  const table = useMemo(() => (isTable ? normalizeTable(block.table) : null), [isTable, block.table])
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

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

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

  /**
   * ⋮⋮ 는 "클릭하면 옵션 메뉴, 끌면 순서 변경"이다.
   * 누르는 순간 일단 메뉴를 닫아 드래그 중에 메뉴가 떠다니지 않게 하고,
   * 거의 움직이지 않은 경우(= 그냥 클릭)에만 누르기 직전 상태를 기준으로 토글한다.
   */
  const handlePressHandle = (event: PointerEvent) => {
    event.stopPropagation()
    pressRef.current = { x: event.clientX, y: event.clientY, wasOpen: menuOpen }
    setMenuOpen(false)
    onReorderStart?.(event)
  }

  const handleClickHandle = (event: React.MouseEvent) => {
    const press = pressRef.current
    pressRef.current = null
    if (!press) return
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) >= CLICK_SLOP) return
    setMenuOpen(!press.wasOpen)
  }

  return (
    <BlockRowProvider props={props}>
      <div
        className={blockClass}
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
            onClick={() => onAddBelow(block.id)}
          >
            +
          </button>
          <div className="block__menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="block__gutter-btn block__drag-handle"
              title="드래그해서 이동 · 클릭해서 옵션"
              aria-label="블록 옵션"
              aria-expanded={menuOpen}
              onClick={handleClickHandle}
              onPointerDown={handlePressHandle}
            >
              ⋮⋮
            </button>
            {menuOpen && (
              <BlockMenu setMenuOpen={setMenuOpen} />
            )}
          </div>
        </div>

        <div className="block__body">
          {block.type === 'bulleted' && <span className="block__marker">•</span>}
          {block.type === 'numbered' && <span className="block__marker">{listNumber}.</span>}
          {block.type === 'todo' && (
            <input
              type="checkbox"
              className="block__checkbox"
              checked={Boolean(block.checked)}
              onChange={() => onToggleCheck(block.id)}
              aria-label="할 일 완료"
            />
          )}
          {isDivider && <hr className="block__divider" />}

          {block.type === BlockType.IMAGE ? (
            <div className="block__image-wrap">
              <img className="block__image" src={block.text} alt="" />
            </div>
          ) : table ? (
            <TableBlockWrapper
              table={table}
              onChange={(next) => onTableChange(block.id, next)}
              onFocus={() => onFocus(block.id)}
              registerFirstCell={registerTableCell}
            />
          ) : !isPlain ? (
            <RichInput
              fieldRef={registerRichField}
              className={`block__input${block.type === 'todo' && block.checked ? ' block__input--done' : ''}`}
              value={block.text}
              placeholder={placeholder}
              onChange={(text, caret) => onTextChange(block.id, text, caret)}
              onKeyDown={(event) => onKeyDown(event, block.id)}
              onPaste={(event) => onPaste(event, block.id)}
              onFocus={() => onFocus(block.id)}
            />
          ) : (
            <textarea
              ref={(element) => {
                textareaRef.current = element
                registerRef(block.id, element)
              }}
              className={`block__input${isDivider ? ' block__input--hidden' : ''}${block.type === 'todo' && block.checked ? ' block__input--done' : ''
                }`}
              value={block.text}
              rows={1}
              spellCheck={false}
              placeholder={placeholder}
              readOnly={isDivider}
              onChange={(event) =>
                onTextChange(block.id, event.target.value, event.target.selectionStart)
              }
              onKeyDown={(event) => onKeyDown(event, block.id)}
              onPaste={(event) => onPaste(event, block.id)}
              onFocus={() => onFocus(block.id)}
            />
          )}
        </div>
      </div>
    </BlockRowProvider>
  )
}
