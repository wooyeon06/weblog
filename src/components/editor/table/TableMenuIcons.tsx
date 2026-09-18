/** 표 메뉴에서 쓰는 작은 선 아이콘들. 아이콘 라이브러리 의존 없이 인라인 SVG로 그린다. */

const base = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }

export function IconHeader() {
  return (
    <svg {...base} aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M1.5 6h13" />
      <rect x="1.5" y="2.5" width="13" height="3.5" rx="1.2" fill="currentColor" stroke="none" opacity="0.3" />
    </svg>
  )
}

export function IconColor() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M8 1.8C5.2 4.6 3.3 7.1 3.3 9.4a4.7 4.7 0 0 0 9.4 0c0-2.3-1.9-4.8-4.7-7.6Z" />
    </svg>
  )
}

export function IconChevronRight() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconArrowLeft() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M5 8h6" strokeLinecap="round" />
      <path d="M9.5 3.5 5 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconArrowRight() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M5 8h6" strokeLinecap="round" />
      <path d="M6.5 3.5 11 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconArrowUp() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M8 12.5V4" strokeLinecap="round" />
      <path d="M4.5 7.5 8 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconArrowDown() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M8 3.5V12" strokeLinecap="round" />
      <path d="M4.5 8.5 8 12l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconCopy() {
  return (
    <svg {...base} aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.4" />
      <path d="M3.5 10.5v-6a1 1 0 0 1 1-1h6" />
    </svg>
  )
}

export function IconEraser() {
  return (
    <svg {...base} aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M6 6l4 4M10 6l-4 4" strokeLinecap="round" />
    </svg>
  )
}

export function IconTrash() {
  return (
    <svg {...base} aria-hidden="true">
      <path
        d="M3 4.5h10M6.5 4.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
