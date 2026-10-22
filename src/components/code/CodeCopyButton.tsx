import './CodeCopyButton.scss'

import { useEffect, useRef, useState } from 'react'
import { IconCopy } from '../editor/block/table/TableMenuIcons'

/** 복사가 끝났음을 보여 주는 시간(ms) */
const DONE_DURATION = 1500

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 코드 블록 내용을 클립보드에 복사하는 버튼. 복사 후 잠깐 "복사됨"으로 바뀐다. */
export function CodeCopyButton({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number>(undefined)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // 권한이 없거나 보안 컨텍스트(https)가 아니면 실패한다. 이때는 아무 표시도 하지 않는다.
      return
    }
    setCopied(true)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setCopied(false), DONE_DURATION)
  }

  return (
    <button
      type="button"
      className={`code-copy${copied ? ' code-copy--done' : ''}${className ? ` ${className}` : ''}`}
      title="코드 복사"
      aria-label={copied ? '복사됨' : '코드 복사'}
      // 편집기에서 누를 때 입력칸 포커스를 빼앗지 않는다.
      onMouseDown={(event) => event.preventDefault()}
      onClick={copy}
    >
      {copied ? <IconCheck /> : <IconCopy />}
      <span>{copied ? '복사됨' : '복사'}</span>
    </button>
  )
}
