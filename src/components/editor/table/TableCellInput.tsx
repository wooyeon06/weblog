import { useLayoutEffect, useRef, type KeyboardEvent } from "react"

type TableCellInputProps = {
  value: string
  cellKey: string
  isHeader: boolean
  placeholder: string
  /** 열 너비가 바뀌면 줄바꿈이 달라지므로 높이를 다시 잰다. */
  width: number
  onChange: (text: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onFocus?: () => void
  onBlur?: () => void
}

export default function TableCellInput({
  value,
  cellKey,
  isHeader,
  placeholder,
  width,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
}: TableCellInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [value, width])

  return (
    <textarea
      ref={ref}
      data-cell={cellKey}
      className={`table-block__input${isHeader ? ' table-block__input--header' : ''}`}
      value={value}
      rows={1}
      spellCheck={false}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  )
}