import './richText.scss'

import type { ClipboardEvent, KeyboardEvent } from 'react'
import { createContext, useEffect, useRef } from 'react'
import type { RichField } from '../../../lib/editableField'
import { RichInputImpl } from './RichInputImpl'

export type RichInputProps = {
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

export type RichInputContextType = {
  value: string,
  field: () => RichField,
  fieldInstanceRef : React.RefObject<RichField | null>,
  onChangeRef: React.RefObject<(md: string, caret: number) => void>
  /** 실행 취소 기록. 여러 훅이 같은 기록을 써야 하므로 Provider 에 하나만 둔다. */
  historyRef: React.RefObject<InputHistory>
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void
}

export type Snapshot = { md: string; caret: number }
export type InputHistory = { entries: Snapshot[]; index: number; typedAt: number }

export const RichInputContext = createContext<RichInputContextType>({} as RichInputContextType)

const RichInputProvider = ({children, value, onChange, onKeyDown, onPaste} 
  : RichInputProps & {children: React.ReactNode}) => {

  const fieldInstanceRef = useRef<RichField | null>(null)
  const field = () => fieldInstanceRef.current!

  const onChangeRef = useRef(onChange);

  // 마운트 때 RichInputImpl 이 처음 값으로 채운다.
  const historyRef = useRef<InputHistory>({ entries: [], index: -1, typedAt: 0 })

  useEffect(() => {
    onChangeRef.current = onChange
  })

  return (
    <RichInputContext.Provider value={{value, field, fieldInstanceRef, onChangeRef, historyRef, onKeyDown, onPaste}}>
      {children}
    </RichInputContext.Provider>
  )
}

export function RichInput(props : RichInputProps) {
  return (
    <RichInputProvider {...props}>
      <RichInputImpl {...props}/>
    </RichInputProvider>
  )
}
