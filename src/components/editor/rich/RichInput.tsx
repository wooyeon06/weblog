import './richText.scss'

import type { ClipboardEvent, KeyboardEvent, MouseEvent } from 'react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { isSafeHref, readSpans, RichField } from '../../../lib/editableField'
import { autoFormat, insertInline, serializeInline } from '../../../lib/inlineMarkdown'

type RichInputProps = {
  value: string
  className?: string
  placeholder?: string
  /** 표 셀 위치("행:열"). 표가 셀을 찾을 때 쓴다. */
  cellKey?: string
  onChange: (md: string, caret: number) => void
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void
  onFocus?: () => void
  onBlur?: () => void
  /** 에디터 포커스 맵에 등록할 입력칸 */
  fieldRef?: (field: RichField | null) => void
}

type Snapshot = { md: string; caret: number }

/** 이 시간 안에 이어서 친 글자는 실행 취소 한 번에 함께 되돌린다. */
const HISTORY_MERGE_MS = 1000
const HISTORY_LIMIT = 200

/**
 * 서식을 바로 보여주는 한 줄(블록) 입력칸. 값은 인라인 마크다운 문자열이다.
 *
 * - 사용자가 치는 글자는 브라우저가 DOM 에 넣고, input 때마다 DOM → 마크다운으로 읽어 올린다.
 * - 다시 파싱한 결과가 지금 DOM 과 다르면(예: `**굵게**` 를 직접 친 경우) 그 결과로 다시 그린다.
 * - IME(한글) 조합 중에는 DOM 을 절대 건드리지 않고, 조합이 끝난 뒤 정리한다.
 * - 줄바꿈·붙여넣기는 브라우저에 맡기지 않고 직접 넣는다. (DOM 에 <div>·서식 HTML 이 섞이지 않게)
 */
export function RichInput({
  value,
  className,
  placeholder,
  cellKey,
  onChange,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  fieldRef,
}: RichInputProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const fieldInstance = useRef<RichField | null>(null)
  const composingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const history = useRef<{ entries: Snapshot[]; index: number; typedAt: number }>({
    entries: [],
    index: -1,
    typedAt: 0,
  })

  useEffect(() => {
    onChangeRef.current = onChange
  })

  const field = () => fieldInstance.current!

  const record = (snapshot: Snapshot, typing: boolean) => {
    const state = history.current
    const now = Date.now()
    const top = state.entries[state.index]
    if (top?.md === snapshot.md) return
    state.entries = state.entries.slice(0, state.index + 1)
    // 이어서 치는 글자는 마지막 기록을 덮어써서 한 번에 되돌린다.
    if (typing && state.index > 0 && now - state.typedAt < HISTORY_MERGE_MS) state.entries[state.index] = snapshot
    else state.entries.push(snapshot)
    if (state.entries.length > HISTORY_LIMIT) state.entries.shift()
    state.index = state.entries.length - 1
    state.typedAt = typing ? now : 0
  }

  /** 새 본문을 그리고, 선택을 맞추고, 위로 알린다. */
  const commit = (md: string, start: number, end: number, typing: boolean) => {
    const current = field()
    current.render(md)
    current.setSelectionRange(start, end)
    record({ md, caret: end }, typing)
    if (md !== value) onChangeRef.current(md, end)
  }

  // 마운트: 어댑터를 만들고 처음 값을 그린다.
  useLayoutEffect(() => {
    const current = new RichField(rootRef.current!)
    fieldInstance.current = current
    current.render(value)
    history.current = { entries: [{ md: value, caret: value.length }], index: 0, typedAt: 0 }
    return () => current.dispose()
    // 처음 한 번만. 이후 값 변경은 아래 효과가 맞춘다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 툴바 등 바깥에서 오는 편집
  useLayoutEffect(() => {
    field().onEdit = (md, start, end) => commit(md, start, end, false)
  })

  useLayoutEffect(() => {
    const current = fieldInstance.current
    if (!fieldRef || !current) return
    fieldRef(current)
    return () => fieldRef(null)
  }, [fieldRef])

  // 바깥에서 값이 바뀌면(블록 합치기, 단축키 변환, AI 삽입…) 다시 그린다. 커서는 화면 위치를 유지한다.
  useLayoutEffect(() => {
    const current = field()
    if (value === current.value || composingRef.current) return
    const [start, end] = current.plainSelection()
    current.render(value)
    current.setPlainSelection(start, end)
    record({ md: value, caret: value.length }, false)
  }, [value])

  // 브라우저 자체 서식·실행 취소는 쓰지 않는다. (DOM 이 우리 모델과 어긋난다)
  // React 의 onBeforeInput 은 inputType 을 주지 않으므로 네이티브 이벤트로 받는다.
  const travelRef = useRef<(step: -1 | 1) => void>(() => {})
  useEffect(() => {
    const root = rootRef.current!
    const handleBeforeInput = (event: InputEvent) => {
      if (event.inputType.startsWith('format')) event.preventDefault()
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        event.preventDefault()
        travelRef.current(event.inputType === 'historyUndo' ? -1 : 1)
      }
    }
    root.addEventListener('beforeinput', handleBeforeInput)
    return () => root.removeEventListener('beforeinput', handleBeforeInput)
  }, [])

  useEffect(() => {
    const remember = () => fieldInstance.current?.rememberSelection()
    document.addEventListener('selectionchange', remember)
    return () => document.removeEventListener('selectionchange', remember)
  }, [])

  /**
   * 브라우저가 바꾼 DOM 을 읽어 마크다운으로 올린다.
   * @param typed 방금 글자를 쳤는지. 이때만 `**굵게**` 자동 서식을 적용한다. (지우다가 바뀌면 곤란하다)
   */
  const readDom = (typed: boolean) => {
    const current = field()
    let spans = readSpans(rootRef.current!)
    let [, plainCaret] = current.plainSelection()
    if (typed && !composingRef.current) {
      const formatted = autoFormat(spans, plainCaret)
      if (formatted) {
        spans = formatted.spans
        plainCaret = formatted.caret
      }
    }
    const { md, map } = serializeInline(spans)
    // 커서 바로 앞 글자 뒤. (슬래시 메뉴가 text[caret - 1] 을 본다)
    const caret = plainCaret <= 0 ? 0 : (map[plainCaret - 1] ?? md.length - 1) + 1

    if (composingRef.current) {
      current.sync(md)
    } else if (current.render(md)) {
      current.setSelectionRange(caret, caret)
    }
    record({ md, caret }, true)
    if (md !== value) onChangeRef.current(md, caret)
  }

  const insertText = (text: string) => {
    const current = field()
    const [start, end] = current.selection()
    const edit = insertInline(current.value, start, end, text)
    commit(edit.md, edit.start, edit.end, false)
  }

  const travel = (step: -1 | 1) => {
    const state = history.current
    const target = state.entries[state.index + step]
    if (!target) return
    state.index += step
    state.typedAt = 0
    const current = field()
    current.render(target.md)
    current.setSelectionRange(target.caret, target.caret)
    if (target.md !== value) onChangeRef.current(target.md, target.caret)
  }

  useEffect(() => {
    travelRef.current = travel
  })

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // 한글 조합을 확정하는 Enter 등은 에디터 단축키로 보지 않는다.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return

    const mod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (mod && !event.altKey && (key === 'z' || key === 'y')) {
      event.preventDefault()
      travel(key === 'y' || event.shiftKey ? 1 : -1)
      return
    }

    onKeyDown?.(event)
    if (event.defaultPrevented) return

    // 에디터가 처리하지 않은 Enter(표 셀, Shift+Enter 등)는 줄바꿈 글자로 넣는다.
    if (event.key === 'Enter') {
      event.preventDefault()
      insertText('\n')
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    onPaste?.(event)
    if (event.defaultPrevented) return
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
    if (text) insertText(text)
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return
    const anchor = (event.target as HTMLElement).closest('a')
    const href = anchor?.dataset.href
    if (href && isSafeHref(href)) {
      event.preventDefault()
      window.open(href, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      ref={rootRef}
      className={`rich-input${className ? ` ${className}` : ''}`}
      contentEditable="plaintext-only" //div를 편집 가능하게 만듭니다.
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      spellCheck={false}
      data-placeholder={placeholder || undefined}
      data-cell={cellKey}
      onInput={(event) => readDom((event.nativeEvent as InputEvent).inputType === 'insertText')}
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onCompositionEnd={() => {
        composingRef.current = false
        readDom(true)
      }}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onDrop={(event) => event.preventDefault()}
      onClick={handleClick}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  )
}
