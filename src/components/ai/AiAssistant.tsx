import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AiSettings, ChatMessage, Post } from '../../types'
import { AiError, providerInfo, streamChat } from '../../lib/ai'
import type { AiTurn } from '../../lib/ai'
import { blocksToMarkdown, markdownToBlocks } from '../../lib/blocks'
import { uid } from '../../lib/id'
import { PostView } from '../editor/PostView'

type QuickAction = {
  label: string
  prompt: string
  /** 선택 영역이 있으면 그 부분만 대상으로 한다. */
  useSelection?: boolean
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: '이어서 쓰기',
    prompt:
      '지금까지 쓴 글의 흐름과 어투를 이어서 2~3문단을 더 써줘. 이미 쓴 내용은 반복하지 말고 새로 추가할 부분만 출력해.',
  },
  {
    label: '개요 만들기',
    prompt:
      '이 주제로 블로그 글의 개요를 만들어줘. ## 소제목 4~6개와 각 소제목 아래에 다룰 내용을 불릿으로 정리해줘.',
  },
  {
    label: '다듬기',
    prompt: '아래 글을 자연스럽고 간결하게 다듬어줘. 의미는 유지하고, 다듬은 결과만 출력해.',
    useSelection: true,
  },
  { label: '3줄 요약', prompt: '이 글을 핵심만 3줄로 요약해줘. 각 줄은 불릿으로.' },
  { label: '제목 추천', prompt: '이 글에 어울리는 제목 5개를 번호 목록으로 제안해줘.' },
  {
    label: '태그 추천',
    prompt: '이 글에 어울리는 태그 6개를 제안해줘. `#` 없이 쉼표로 구분한 한 줄로만 출력해.',
  },
]

type AiAssistantProps = {
  settings: AiSettings
  onOpenSettings: () => void
  /** 편집 중인 글. 목록 화면에서는 null. */
  post: Post | null
  onInsert: ((markdown: string) => void) | null
  getSelection: (() => string) | null
}

function AssistantBody({ content }: { content: string }) {
  const blocks = useMemo(() => markdownToBlocks(content), [content])
  return <PostView blocks={blocks} />
}

export function AiAssistant({
  settings,
  onOpenSettings,
  post,
  onInsert,
  getSelection,
}: AiAssistantProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [useContext, setUseContext] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const info = providerInfo(settings.provider)
  const hasKey = Boolean(settings.apiKey)

  useEffect(() => {
    if (!open) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isToggle = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j'
      if (isToggle) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    setMessages((list) =>
      list.map((message) => (message.pending ? { ...message, pending: false } : message)),
    )
  }, [])

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim()
      if (!prompt || streaming) return
      if (!hasKey) {
        onOpenSettings()
        return
      }

      const userMessage: ChatMessage = { id: uid('m_'), role: 'user', content: prompt }
      const replyId = uid('m_')
      const history: AiTurn[] = messages
        .filter((message) => !message.error && message.content.trim())
        .map((message) => ({ role: message.role, content: message.content }))

      setMessages((list) => [
        ...list,
        userMessage,
        { id: replyId, role: 'assistant', content: '', pending: true },
      ])
      setInput('')
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      const documentContext =
        useContext && post
          ? `제목: ${post.title || '(없음)'}\n태그: ${post.tags.join(', ') || '(없음)'}\n\n${blocksToMarkdown(
              post.blocks,
            )}`
          : undefined

      try {
        await streamChat({
          settings,
          turns: [...history, { role: 'user', content: prompt }],
          documentContext,
          signal: controller.signal,
          onDelta: (chunk) => {
            setMessages((list) =>
              list.map((message) =>
                message.id === replyId ? { ...message, content: message.content + chunk } : message,
              ),
            )
          },
        })
        setMessages((list) =>
          list.map((message) =>
            message.id === replyId
              ? {
                  ...message,
                  pending: false,
                  content: message.content || '(빈 응답이 돌아왔습니다. 다시 시도해 주세요.)',
                }
              : message,
          ),
        )
      } catch (error) {
        if (controller.signal.aborted) return
        const description =
          error instanceof AiError
            ? error.message
            : error instanceof Error
              ? `요청에 실패했습니다: ${error.message}`
              : '알 수 없는 오류가 발생했습니다.'
        setMessages((list) =>
          list.map((message) =>
            message.id === replyId
              ? { ...message, pending: false, error: true, content: description }
              : message,
          ),
        )
      } finally {
        abortRef.current = null
        setStreaming(false)
      }
    },
    [hasKey, messages, onOpenSettings, post, settings, streaming, useContext],
  )

  const runQuickAction = (action: QuickAction) => {
    const selection = action.useSelection ? getSelection?.().trim() : ''
    const prompt = selection ? `${action.prompt}\n\n"""\n${selection}\n"""` : action.prompt
    void send(prompt)
  }

  return (
    <>
      <button
        type="button"
        className={`ai-fab${open ? ' ai-fab--open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        title={open ? 'AI 도우미 닫기 (Ctrl+J)' : 'AI 도우미 열기 (Ctrl+J)'}
        aria-label="AI 도우미"
      >
        {open ? '×' : '✨'}
      </button>

      {open && (
        <aside className="ai-panel" aria-label="AI 도우미">
          <header className="ai-panel__head">
            <div>
              <strong>AI 도우미</strong>
              <span className="ai-panel__model">
                {info.label} · {settings.model}
              </span>
            </div>
            <div className="ai-panel__head-actions">
              <button
                type="button"
                className="icon-btn"
                title="새 대화"
                onClick={() => {
                  stop()
                  setMessages([])
                }}
              >
                ⟲
              </button>
              <button type="button" className="icon-btn" title="설정" onClick={onOpenSettings}>
                ⚙
              </button>
              <button
                type="button"
                className="icon-btn"
                title="닫기"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          {!hasKey && (
            <div className="ai-panel__setup">
              <p>
                아직 API 키가 없습니다. <strong>{info.label}</strong> 는 무료 티어로 사용할 수
                있습니다.
              </p>
              <button type="button" className="btn btn--primary" onClick={onOpenSettings}>
                API 키 등록하기
              </button>
            </div>
          )}

          <div className="ai-panel__messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="ai-empty">
                <p className="ai-empty__title">무엇을 도와드릴까요?</p>
                <p className="ai-empty__desc">
                  {post
                    ? '작성 중인 글 전체를 문맥으로 함께 보냅니다. 아래 버튼을 눌러 바로 시작해 보세요.'
                    : '글 편집 화면에서 열면 작성 중인 글을 문맥으로 사용합니다.'}
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`ai-msg ai-msg--${message.role}`}>
                <div
                  className={`ai-msg__bubble${message.error ? ' ai-msg__bubble--error' : ''}`}
                >
                  {message.role === 'user' || message.pending || message.error ? (
                    <div className="ai-msg__plain">
                      {message.content}
                      {message.pending && <span className="ai-caret" />}
                    </div>
                  ) : (
                    <AssistantBody content={message.content} />
                  )}
                </div>
                {message.role === 'assistant' && !message.pending && !message.error && (
                  <div className="ai-msg__actions">
                    {onInsert && (
                      <button
                        type="button"
                        className="chip"
                        onClick={() => onInsert(message.content)}
                      >
                        본문에 삽입
                      </button>
                    )}
                    <button
                      type="button"
                      className="chip"
                      onClick={() => void navigator.clipboard?.writeText(message.content)}
                    >
                      복사
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {post && (
            <div className="ai-panel__quick">
              {QUICK_ACTIONS.map((action) => (
                <button
                  type="button"
                  key={action.label}
                  className="chip"
                  disabled={streaming}
                  onClick={() => runQuickAction(action)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          <div className="ai-panel__composer">
            <textarea
              ref={inputRef}
              className="ai-input"
              rows={2}
              placeholder="AI에게 요청하기…  (Enter 전송, Shift+Enter 줄바꿈)"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send(input)
                }
              }}
            />
            <div className="ai-panel__composer-row">
              <label className="ai-context">
                <input
                  type="checkbox"
                  checked={useContext}
                  disabled={!post}
                  onChange={(event) => setUseContext(event.target.checked)}
                />
                글 문맥 포함
              </label>
              {streaming ? (
                <button type="button" className="btn btn--ghost" onClick={stop}>
                  ■ 중지
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!input.trim()}
                  onClick={() => void send(input)}
                >
                  전송
                </button>
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  )
}
