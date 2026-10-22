import type { ReactNode } from 'react'
import { BlockDragContext, useDragBlockRow } from './useDragBlockRow'

/** 블록 드래그 상태를 에디터 전체에 하나만 만들어 내려준다. EditorContext 를 쓰므로 EditorProvider 안에 둔다. */
export function BlockDragProvider({ children }: { children: ReactNode }) {
  const drag = useDragBlockRow()
  return <BlockDragContext.Provider value={drag}>{children}</BlockDragContext.Provider>
}
