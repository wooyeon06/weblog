import type { KeyboardEvent } from "react"
import { RichInput } from "../RichInput"

type TableCellInputProps = {
  value: string
  cellKey: string
  isHeader: boolean
  placeholder: string
  onChange: (text: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onFocus?: () => void
  onBlur?: () => void
}

/** 표 셀 입력칸. 본문 블록과 같이 서식을 바로 보여준다. 높이는 내용에 맞춰 저절로 늘어난다. */
export default function TableCellInput({
  value,
  cellKey,
  isHeader,
  placeholder,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
}: TableCellInputProps) {
  return (
    <RichInput
      value={value}
      cellKey={cellKey}
      className={`table-block__input${isHeader ? ' table-block__input--header' : ''}`}
      placeholder={placeholder}
      onChange={(text) => onChange(text)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  )
}
