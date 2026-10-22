import './richText.scss'

import { useContext, useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'
import { readSpans, RichField } from '../../../lib/editableField'
import { autoFormat, serializeInline } from '../../../lib/inlineMarkdown'
import useRichInputEventHandler from './useRichInputEventHandler'
import useRichInputHandler from './useRichInputUtils'
import { RichInputContext, type RichInputProps } from './RichInput'


/**
 * 서식을 바로 보여주는 한 줄(블록) 입력칸. 값은 인라인 마크다운 문자열이다.
 *
 * - 사용자가 치는 글자는 브라우저가 DOM 에 넣고, input 때마다 DOM → 마크다운으로 읽어 올린다.
 * - 다시 파싱한 결과가 지금 DOM 과 다르면(예: `**굵게**` 를 직접 친 경우) 그 결과로 다시 그린다.
 * - IME(한글) 조합 중에는 DOM 을 절대 건드리지 않고, 조합이 끝난 뒤 정리한다.
 * - 줄바꿈·붙여넣기는 브라우저에 맡기지 않고 직접 넣는다. (DOM 에 <div>·서식 HTML 이 섞이지 않게)
 */
export function RichInputImpl({
  value,
  className,
  placeholder,
  cellKey,
  onFocus,
  onBlur,
  fieldRef,
}: RichInputProps) {

  const {field, fieldInstanceRef, onChangeRef, historyRef} = useContext(RichInputContext);

  const rootRef = useRef<HTMLDivElement>(null)
  /*
  ㅎ 입력     → compositionstart   (조합 시작)   화면: ㅎ  (밑줄 표시)
  ㅏ 입력     → compositionupdate                화면: 하
  ㄴ 입력     → compositionupdate                화면: 한
  스페이스 등 → compositionend     (조합 확정)   화면: 한
  */
  const composingRef = useRef(false)

  // 마운트: 어댑터를 만들고 처음 값을 그린다.
  // ⚠ 아래 훅들의 layout effect(field().onEdit 설정 등)보다 먼저 실행돼야 하므로 훅 호출보다 위에 둔다.
  //   (layout effect 는 선언 순서대로 실행된다)
  useLayoutEffect(() => {
      const current = new RichField(rootRef.current!)
      fieldInstanceRef.current = current
      current.render(value)
      historyRef.current ={ entries: [{ md: value, caret: value.length }], index: 0, typedAt: 0 }
      return () => current.dispose()
      // 처음 한 번만. 이후 값 변경은 아래 효과가 맞춘다.
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { handleKeyDown, handlePaste, handleClick } = useRichInputEventHandler();
  const { record, travel } = useRichInputHandler();

  /**
   * 브라우저 실행 취소(historyUndo/Redo)를 우리 기록으로 되돌린다.
   * beforeinput 리스너는 마운트 때 한 번만 등록되지만, useEffectEvent 로 감싸면 항상 최신 travel(최신 value)을 부른다.
   */
  const onHistory = useEffectEvent((step: -1 | 1) => travel(step))

  useLayoutEffect(() => {
    const current = fieldInstanceRef.current
    if (!fieldRef || !current) return
    fieldRef(current)
    return () => fieldRef(null)
  }, [fieldRef, fieldInstanceRef])

  // 바깥에서 값이 바뀌면(블록 합치기, 단축키 변환, AI 삽입…) 다시 그린다. 커서는 화면 위치를 유지한다.
  // value 가 바뀔 때만 실행하고, field·record 는 useEffectEvent 로 항상 최신 것을 쓴다.
  const applyValue = useEffectEvent((next: string) => {
    const current = field()
    if (next === current.value || composingRef.current) return
    const [start, end] = current.plainSelection()
    current.render(next)
    current.setPlainSelection(start, end)
    record({ md: next, caret: next.length }, false)
  })
  useLayoutEffect(() => applyValue(value), [value])

  // 브라우저 자체 서식·실행 취소는 쓰지 않는다. (DOM 이 우리 모델과 어긋난다)
  // React 의 onBeforeInput 은 inputType 을 주지 않으므로 네이티브 이벤트로 받는다.
  useEffect(() => {
    const root = rootRef.current!
    const handleBeforeInput = (event: InputEvent) => {
      if (event.inputType.startsWith('format')) event.preventDefault()
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        event.preventDefault()
        onHistory(event.inputType === 'historyUndo' ? -1 : 1)
      }
    }
    root.addEventListener('beforeinput', handleBeforeInput)
    return () => root.removeEventListener('beforeinput', handleBeforeInput)
  }, [])

  /**
   * 커서가 바뀌면 RichField 에 알려준다. (툴바가 커서 위치를 본다)
   */
  useEffect(() => {
    const remember = () => fieldInstanceRef.current?.rememberSelection()
    document.addEventListener('selectionchange', remember)
    return () => document.removeEventListener('selectionchange', remember)
  }, [fieldInstanceRef])

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
