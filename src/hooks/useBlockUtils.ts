import { useCallback, useContext } from "react"
import type { SlashItem } from "../lib/slashItems"
import { MAX_INDENT, newBlock } from "../lib/blocks"
import { newTable } from "../lib/table"
import { EditorContext } from "../pages/EditorPage"
import type { TableData } from "../types"

/**
 * 블록 편집에 쓰는 유틸성 기능. 이벤트와 상관없이 어디서든 호출한다.
 * (슬래시 메뉴 항목 적용, 들여쓰기, 이동·복제·삭제·추가, 체크, 표 데이터)
 * 포커스 예약·슬래시 메뉴 상태는 EditorContext 에 있다.
 */
export function useBlockUtils() {
  const { slash, closeSlash, focusBlock, commitBlocks, activePost : post } = useContext(EditorContext);

  /**
   * 블록 타입 변경
   * @param item 변경할 블록의 인덱스
   */
  const applySlashItem = useCallback(
    (item: SlashItem) => {
      if (!slash || !post) return
      const index = post.blocks.findIndex((block) => block.id === slash.blockId)
      if (index < 0) return closeSlash()
      const current = post.blocks[index]
      const text = current.text
      const nextText = text.slice(0, slash.start) + text.slice(slash.start + 1 + slash.query.length)
      const blocks = post.blocks.slice()

      if (item.type === 'divider' || item.type === 'table') {
        // 본문을 담지 않는 블록이므로 남은 텍스트는 뒤따르는 새 블록으로 넘긴다.
        blocks[index] = { ...current, type: item.type, text: '', checked: undefined }
        if (item.type === 'table') blocks[index].table = newTable()
        const next = newBlock('text', nextText, current.indent)
        blocks.splice(index + 1, 0, next)
        // 표는 첫 셀이 포커스 대상으로 등록돼 있어 바로 입력할 수 있다.
        focusBlock(item.type === 'table' ? current.id : next.id, 0)
      } else {
        blocks[index] = {
          ...current,
          type: item.type,
          text: nextText,
          checked: item.type === 'todo' ? false : undefined,
        }
        focusBlock(current.id, slash.start)
      }

      closeSlash()
      commitBlocks(blocks)
    },
    [closeSlash, commitBlocks, focusBlock, post, slash],
  )

  /**
   * 블록 들여쓰기 변경
   * @param index 변경할 블록의 인덱스
   * @param delta 들여쓰기 단계 변경량 (1 또는 -1)
   */
  const setIndent = useCallback(
    (index: number, delta: number) => {
      if(!post) return;
      const blocks = post.blocks.slice()
      const current = blocks[index]
      const indent = Math.max(0, Math.min(MAX_INDENT, current.indent + delta))
      if (indent === current.indent) return
      blocks[index] = { ...current, indent }
      commitBlocks(blocks)
    },
    [commitBlocks, post],
  )

  /**
   * 블록을 한 칸 위/아래로 옮긴다.
   * @param delta -1 이면 위로, 1 이면 아래로
   */
  const moveBlock = useCallback(
    (id: string, delta: -1 | 1) => {
      if (!post) return
      const index = post.blocks.findIndex((block) => block.id === id)
      const target = index + delta
      if (index < 0 || target < 0 || target >= post.blocks.length) return
      const blocks = post.blocks.slice() // [...post.blocks] 얕은 복사
      ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
      commitBlocks(blocks)
    },
    [commitBlocks, post],
  )

  /**
   * 블록을 새 id 로 복제한다.
   * @param where 복사본을 넣을 위치 (현재 블록 위/아래)
   * @param caret 주면 복사본의 이 위치로 포커스한다.
   * @returns 복사본. 블록이 없으면 null
   */
  const duplicateBlock = useCallback(
    (id: string, where: 'above' | 'below' = 'below', caret?: number) => {
      if (!post) return null
      const index = post.blocks.findIndex((block) => block.id === id)
      if (index < 0) return null
      const blocks = post.blocks.slice()
      const copy = { ...blocks[index], id: newBlock().id }
      blocks.splice(where === 'above' ? index : index + 1, 0, copy)
      if (caret !== undefined) focusBlock(copy.id, caret)
      commitBlocks(blocks)
      return copy
    },
    [commitBlocks, focusBlock, post],
  )

  /** 블록을 지우고 바로 앞(없으면 뒤) 블록 끝으로 포커스한다. */
  const deleteBlock = useCallback(
    (id: string) => {
      if (!post) return
      const index = post.blocks.findIndex((block) => block.id === id)
      if (index < 0) return
      const blocks = post.blocks.slice()
      blocks.splice(index, 1)
      const focusTarget = blocks[index - 1] ?? blocks[index]
      if (focusTarget) focusBlock(focusTarget.id, focusTarget.text.length)
      commitBlocks(blocks)
    },
    [commitBlocks, focusBlock, post],
  )

  /** 블록 아래에 같은 들여쓰기의 빈 텍스트 블록을 넣고 포커스한다. */
  const addBlockBelow = useCallback(
    (id: string) => {
      if (!post) return
      const index = post.blocks.findIndex((block) => block.id === id)
      if (index < 0) return
      const blocks = post.blocks.slice()
      const next = newBlock('text', '', blocks[index].indent)
      blocks.splice(index + 1, 0, next)
      focusBlock(next.id, 0)
      commitBlocks(blocks)
    },
    [commitBlocks, focusBlock, post],
  )

  /** 할 일 블록의 체크 상태를 뒤집는다. */
  const toggleCheck = useCallback(
    (id: string) => {
      if (!post) return
      commitBlocks(post.blocks.map((block) => (block.id === id ? { ...block, checked: !block.checked } : block)))
    },
    [commitBlocks, post],
  )

  /** 표 블록의 데이터를 바꾼다. */
  const setTable = useCallback(
    (id: string, table: TableData) => {
      if (!post) return
      commitBlocks(post.blocks.map((block) => (block.id === id ? { ...block, table } : block)))
    },
    [commitBlocks, post],
  )

  return {
    applySlashItem,
    setIndent,
    moveBlock, duplicateBlock, deleteBlock, addBlockBelow,
    toggleCheck, setTable,
  }
}
