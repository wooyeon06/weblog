import { useContext } from "react"
import { BlockRowContext, type BlockAction } from "./block/BlockRow"
import { BlockType } from "../../types"

export default function BlockMenu({
  setMenuOpen
}: {
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
}
) {
  const { block, onAction, onTableChange } = useContext(BlockRowContext)

  const runAction = (action: BlockAction) => {
    setMenuOpen(false)
    onAction(block.id, action)
  }

  const toggleHeaderRow = () => {
    if (!block.table) return
    onTableChange(block.id, { ...block.table, headerRow: !block.table.headerRow })
    setMenuOpen(false)
  }

  const toggleHeaderColumn = () => {
    if (!block.table) return
    onTableChange(block.id, { ...block.table, headerColumn: !block.table.headerColumn })
    setMenuOpen(false)
  }

  return (
    <div className="block__menu" role="menu">
      <button type="button" role="menuitem" onClick={() => runAction('moveUp')}>
        위로 이동
      </button>
      <button type="button" role="menuitem" onClick={() => runAction('moveDown')}>
        아래로 이동
      </button>
      <button type="button" role="menuitem" onClick={() => runAction('duplicate')}>
        복제
      </button>
      {block.type === BlockType.TABLE && block.table && (
        <>
          <button type="button" role="menuitemcheckbox" aria-checked={block.table.headerRow} onClick={toggleHeaderRow}>
            {block.table.headerRow ? '✓ ' : ''}머리글 행
          </button>
          <button type="button" role="menuitemcheckbox" aria-checked={block.table.headerColumn} onClick={toggleHeaderColumn}>
            {block.table.headerColumn ? '✓ ' : ''}머리글 열
          </button>
        </>
      )}
      <button
        type="button"
        role="menuitem"
        className="block__menu-danger"
        onClick={() => runAction('delete')}
      >
        삭제
      </button>
    </div>
  )
}