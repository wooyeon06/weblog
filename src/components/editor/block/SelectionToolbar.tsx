import './SelectionToolbar.scss'

import type { ReactNode, RefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { richFieldOf, type RichField } from '../../../lib/editableField'
import {
  clearMarks,
  isMarkActive,
  setWrap,
  toggleMark,
  wrapValue,
  type InlineEdit,
  type Mark,
} from '../../../lib/inlineMarkdown'
import {
  TEXT_COLORS,
  colorClass,
  loadRecentColors,
  pushRecentColor,
  type ColorKind,
  type RecentColor,
} from '../../../lib/textColors'

type Target = {
  field: RichField
  /** 마크다운 기준 선택 구간 */
  start: number
  end: number
  rect: { left: number; top: number; bottom: number }
}

type Panel = 'none' | 'link' | 'color'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl+'

const MARK_BUTTONS: { mark: Mark; label: string; shortcut: string; icon: ReactNode }[] = [
  { mark: 'bold', label: '굵게', shortcut: `${MOD}B`, icon: <b>B</b> },
  { mark: 'italic', label: '기울임꼴', shortcut: `${MOD}I`, icon: <i>I</i> },
  { mark: 'underline', label: '밑줄', shortcut: `${MOD}U`, icon: <u>U</u> },
  { mark: 'strike', label: '취소선', shortcut: `${MOD}Shift+S`, icon: <s>S</s> },
  { mark: 'code', label: '인라인 코드', shortcut: `${MOD}E`, icon: <span className="selection-toolbar__mono">{'</>'}</span> },
]

const LinkIcon = (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L10 5" />
    <path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1" />
  </svg>
)

const GAP = 8
const MARGIN = 8

/** 서식을 붙일 수 있는 입력칸(contentEditable)의 선택을 읽는다. 코드 블록(textarea)은 제외된다. */
function readTarget(container: HTMLElement | null): Target | null {
  const field = richFieldOf(document.activeElement)
  if (!field || !container?.contains(field.root)) return null
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  if (!selection.toString().trim()) return null
  const range = selection.getRangeAt(0)
  const first = range.getClientRects()[0] ?? range.getBoundingClientRect()
  const [start, end] = field.selection()
  return { field, start, end, rect: { left: first.left, top: first.top, bottom: first.bottom } }
}

/**
 * 노션처럼 본문 텍스트를 드래그(또는 Shift+방향키)로 선택하면 위에 뜨는 서식 툴바.
 * 일반 블록과 표 셀 모두에서 동작한다.
 */
export function SelectionToolbar({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const selectingRef = useRef(false)
  const [target, setTarget] = useState<Target | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [panel, setPanel] = useState<Panel>('none')
  const [linkUrl, setLinkUrl] = useState('')
  const [recent, setRecent] = useState<RecentColor[]>(loadRecentColors)

  const panelRef = useRef(panel)
  useEffect(() => {
    panelRef.current = panel
  }, [panel])

  const hide = useCallback(() => {
    setTarget(null)
    setPanel('none')
  }, [])

  const update = useCallback(() => {
    // 링크 입력칸에 포커스가 가 있는 동안에는 원래 선택을 유지한다.
    if (toolbarRef.current?.contains(document.activeElement)) return
    const next = selectingRef.current ? null : readTarget(containerRef.current)
    if (next) setTarget(next)
    else hide()
  }, [containerRef, hide])

  // 선택 추적: 마우스로 끄는 중에는 숨기고, 놓았을 때 띄운다.
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (toolbarRef.current?.contains(event.target as Node)) return
      setPanel('none')
      if (containerRef.current?.contains(event.target as Node)) {
        selectingRef.current = true
        setTarget(null)
      }
    }
    const handlePointerUp = () => {
      if (!selectingRef.current) return
      selectingRef.current = false
      requestAnimationFrame(update)
    }
    const handleSelectionChange = () => {
      if (panelRef.current !== 'link') update()
    }
    const handleViewportChange = () => {
      if (!selectingRef.current) update()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointerup', handlePointerUp, true)
    document.addEventListener('selectionchange', handleSelectionChange)
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('selectionchange', handleSelectionChange)
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [containerRef, update])

  // 선택 영역 첫 줄 위에 띄우고, 공간이 없으면 아래로 내린다. (링크 입력칸은 폭이 달라 다시 잰다)
  const linkOpen = panel === 'link'
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!target || !toolbar) {
      setPosition(null)
      return
    }
    const { width, height } = toolbar.getBoundingClientRect()
    let top = target.rect.top - height - GAP
    if (top < MARGIN) top = target.rect.bottom + GAP
    const left = Math.min(Math.max(MARGIN, target.rect.left), window.innerWidth - width - MARGIN)
    setPosition({ left, top })
  }, [target, linkOpen])

  const run = useCallback(
    (make: (md: string, start: number, end: number) => InlineEdit | null) => {
      if (!target) return
      const { field, start, end } = target
      const edit = make(field.value, start, end)
      if (!edit) return
      field.focus()
      field.edit(edit.md, edit.start, edit.end)
      // 새 DOM 기준으로 활성 상태와 위치를 다시 잰다.
      requestAnimationFrame(update)
    },
    [target, update],
  )

  const toggle = useCallback(
    (mark: Mark) => run((md, start, end) => toggleMark(md, start, end, mark)),
    [run],
  )

  const openLink = useCallback(() => {
    setLinkUrl(target ? wrapValue(target.field.value, target.start, target.end, 'href') ?? '' : '')
    setPanel('link')
    requestAnimationFrame(() => linkInputRef.current?.focus())
  }, [target])

  const submitLink = () => {
    const url = linkUrl
    setPanel('none')
    run((md, start, end) => setWrap(md, start, end, 'href', url))
  }

  const cancelLink = () => {
    setPanel('none')
    target?.field.focus()
  }

  const applyColor = (kind: ColorKind, key: string) => {
    run((md, start, end) => setWrap(md, start, end, kind, key === 'default' ? undefined : key))
    if (key !== 'default') setRecent(pushRecentColor({ kind, key }))
    setPanel('none')
  }

  // 단축키: 선택 영역이 있을 때만 가로챈다.
  useEffect(() => {
    if (!target) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement !== target.field.root) return
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      let mark: Mark | null = null
      if (key === 'b' && !event.shiftKey) mark = 'bold'
      else if (key === 'i' && !event.shiftKey) mark = 'italic'
      else if (key === 'u' && !event.shiftKey) mark = 'underline'
      else if (key === 'e' && !event.shiftKey) mark = 'code'
      else if (key === 's' && event.shiftKey) mark = 'strike'
      else if (key === 'k' && !event.shiftKey) {
        event.preventDefault()
        openLink()
        return
      }
      if (!mark) return
      event.preventDefault()
      toggle(mark)
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [target, toggle, openLink])

  if (!target) return null

  const { field, start, end } = target
  const md = field.value
  const currentColor = wrapValue(md, start, end, 'color')
  const currentBg = wrapValue(md, start, end, 'bg')
  const hasLink = !!wrapValue(md, start, end, 'href')

  const colorSwatch = (kind: ColorKind, key: string, label: string) => {
    const active = (kind === 'color' ? currentColor : currentBg) === (key === 'default' ? undefined : key)
    return (
      <button
        key={`${kind}-${key}`}
        type="button"
        className={`color-menu__swatch ${colorClass(kind, key)}${active ? ' color-menu__swatch--active' : ''}`}
        title={`${label} ${kind === 'color' ? '텍스트' : '배경'}`}
        aria-label={`${label} ${kind === 'color' ? '텍스트' : '배경'}`}
        aria-pressed={active}
        onClick={() => applyColor(kind, key)}
      >
        {kind === 'color' ? 'A' : ''}
      </button>
    )
  }

  const labelOf = (key: string) => TEXT_COLORS.find((color) => color.key === key)?.label ?? key

  return (
    <div
      ref={toolbarRef}
      className="selection-toolbar"
      style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}
      role="toolbar"
      aria-label="텍스트 서식"
      // 버튼을 눌러도 입력칸의 포커스와 선택이 풀리지 않게 한다.
      onMouseDown={(event) => {
        if (event.target !== linkInputRef.current) event.preventDefault()
      }}
    >
      {panel === 'link' ? (
        <form
          className="selection-toolbar__link"
          onSubmit={(event) => {
            event.preventDefault()
            submitLink()
          }}
        >
          <input
            ref={linkInputRef}
            className="selection-toolbar__link-input"
            type="text"
            placeholder="링크 붙여넣기…"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelLink()
              }
            }}
          />
          <button type="submit" className="selection-toolbar__link-submit">
            {linkUrl.trim() || !hasLink ? '연결' : '해제'}
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            className={`selection-toolbar__btn selection-toolbar__color${panel === 'color' ? ' selection-toolbar__btn--open' : ''}`}
            title="텍스트 색상"
            aria-label="텍스트 색상"
            aria-expanded={panel === 'color'}
            onClick={() => setPanel(panel === 'color' ? 'none' : 'color')}
          >
            <span className={`selection-toolbar__color-chip ${colorClass('color', currentColor)} ${colorClass('bg', currentBg)}`}>
              A
            </span>
          </button>
          <span className="selection-toolbar__sep" aria-hidden />
          <button
            type="button"
            className={`selection-toolbar__btn${hasLink ? ' selection-toolbar__btn--active' : ''}`}
            title={`링크 (${MOD}K)`}
            aria-label="링크"
            onClick={openLink}
          >
            {LinkIcon}
          </button>
          {MARK_BUTTONS.map(({ mark, label, shortcut, icon }) => {
            const active = isMarkActive(md, start, end, mark)
            return (
              <button
                key={mark}
                type="button"
                className={`selection-toolbar__btn${active ? ' selection-toolbar__btn--active' : ''}`}
                title={`${label} (${shortcut})`}
                aria-label={label}
                aria-pressed={active}
                onClick={() => toggle(mark)}
              >
                {icon}
              </button>
            )
          })}
          <span className="selection-toolbar__sep" aria-hidden />
          <button
            type="button"
            className="selection-toolbar__btn selection-toolbar__btn--clear"
            title="서식 지우기"
            aria-label="서식 지우기"
            onClick={() => run(clearMarks)}
          >
            T<sub>x</sub>
          </button>
        </>
      )}

      {panel === 'color' && (
        <div className="color-menu" role="dialog" aria-label="색상">
          {recent.length > 0 && (
            <section>
              <h4 className="color-menu__title">최근 사용</h4>
              <div className="color-menu__grid">
                {recent.map(({ kind, key }) => colorSwatch(kind, key, labelOf(key)))}
              </div>
            </section>
          )}
          <section>
            <h4 className="color-menu__title">텍스트 색상</h4>
            <div className="color-menu__grid">
              {TEXT_COLORS.map(({ key, label }) => colorSwatch('color', key, label))}
            </div>
          </section>
          <section>
            <h4 className="color-menu__title">배경 색상</h4>
            <div className="color-menu__grid">
              {TEXT_COLORS.map(({ key, label }) => colorSwatch('bg', key, label))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
