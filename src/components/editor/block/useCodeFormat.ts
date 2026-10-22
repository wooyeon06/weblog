import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react'
import { canFormat, formatCode } from '../../../lib/codeFormat'

/** 오류 문구를 보여 주는 시간(ms) */
const ERROR_DURATION = 4000

/** Shift+Alt+F (VS Code "문서 서식"). Alt 를 누르면 key 값이 바뀌는 환경이 있어 물리 키(code)로 본다. */
const isFormatShortcut = (event: KeyboardEvent) =>
  event.shiftKey && event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyF'

/**
 * 코드 블록 textarea 에서 Shift+Alt+F 로 내용을 포맷한다.
 * @param onReplace execCommand 로 넣지 못했을 때 직접 바꿀 함수
 */
export function useCodeFormat(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  lang: string | undefined,
  onReplace: (text: string) => void,
) {
  const [formatError, setFormatError] = useState('')

  useEffect(() => {
    if (!formatError) return
    const timer = window.setTimeout(() => setFormatError(''), ERROR_DURATION)
    return () => window.clearTimeout(timer)
  }, [formatError])

  const format = async () => {
    const element = textareaRef.current
    if (!element) return
    if (!canFormat(lang)) {
      setFormatError('이 언어는 포맷을 지원하지 않아요.')
      return
    }

    const original = element.value
    let formatted: string
    try {
      formatted = await formatCode(original, lang)
    } catch (error) {
      // Prettier 오류는 코드 일부를 함께 담고 있으므로 첫 줄만 보여 준다.
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
      setFormatError(`포맷 실패: ${message}`)
      return
    }

    // 포맷하는 사이에 내용이 바뀌었으면 덮어쓰지 않는다.
    if (formatted === original || element.value !== original) return
    setFormatError('')

    // 사용자가 입력한 것처럼 넣어야 브라우저 실행 취소(Ctrl+Z)에 남는다. onChange 도 그대로 불린다.
    element.focus()
    element.select()
    if (!document.execCommand('insertText', false, formatted)) onReplace(formatted)
  }

  /** 포맷 단축키면 처리하고 true 를 돌려준다. */
  const handleFormatKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isFormatShortcut(event)) return false
    event.preventDefault()
    void format()
    return true
  }

  return { formatError, handleFormatKey }
}
