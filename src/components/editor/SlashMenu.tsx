import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SlashItem } from '../../lib/slashItems'

type SlashMenuProps = {
  items: SlashItem[]
  anchor: { left: number; top: number; bottom: number }
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (item: SlashItem) => void
  onClose: () => void
}

export function SlashMenu({
  items,
  anchor,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  onClose,
}: SlashMenuProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: anchor.left, top: anchor.bottom + 6 })

  useLayoutEffect(() => {
    const element = listRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const margin = 12
    let left = anchor.left
    let top = anchor.bottom + 6
    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - rect.width - margin)
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, anchor.top - rect.height - 6)
    }
    setPosition({ left, top })
  }, [anchor, items.length])

  useLayoutEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!listRef.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [onClose])

  if (items.length === 0) return null

  return (
    <div
      className="slash-menu"
      ref={listRef}
      style={{ left: position.left, top: position.top }}
      role="listbox"
      aria-label="블록 타입"
    >
      <div className="slash-menu__title">블록 삽입</div>
      {items.map((item, index) => (
        <button
          type="button"
          key={item.type}
          className="slash-menu__item"
          data-active={index === activeIndex}
          role="option"
          aria-selected={index === activeIndex}
          onMouseEnter={() => onActiveIndexChange(index)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(item)}
        >
          <span className="slash-menu__icon">{item.icon}</span>
          <span className="slash-menu__text">
            <span className="slash-menu__label">{item.label}</span>
            <span className="slash-menu__hint">{item.hint}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
