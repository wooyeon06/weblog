import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useBlockUtils } from "../../../hooks/useBlockUtils";
import { useBlockDrag } from "../../../hooks/useDragBlockRow";
import { BlockType, type Block } from "../../../types";

/** 드래그로 볼지 클릭으로 볼지 가르는 거리 (useDragItem 의 임계값과 맞춘다) */
const CLICK_SLOP = 4

/**
 * BlockMenu 는 블록의 옵션 메뉴를 표시하는 컴포넌트입니다.
 * 블록의 이동, 복제, 삭제 등의 기능을 제공합니다.
 * @returns 
 */
export default function BlockMenu({ block }: { block: Block }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const pressRef = useRef<{ x: number; y: number; wasOpen: boolean } | null>(null)

    const { moveBlock, duplicateBlock, deleteBlock, setTable } = useBlockUtils()
    const { startReorder } = useBlockDrag()

    /**
     * ⋮⋮ 는 "클릭하면 옵션 메뉴, 끌면 순서 변경"이다.
     * 누르는 순간 일단 메뉴를 닫아 드래그 중에 메뉴가 떠다니지 않게 하고,
     * 거의 움직이지 않은 경우(= 그냥 클릭)에만 누르기 직전 상태를 기준으로 토글한다.
     */
    const handlePressHandle = (event: PointerEvent) => {
        event.stopPropagation()
        pressRef.current = { x: event.clientX, y: event.clientY, wasOpen: menuOpen }
        setMenuOpen(false)
        startReorder(event, block.id)
    }

    const handleClickHandle = (event: React.MouseEvent) => {
        const press = pressRef.current
        pressRef.current = null
        if (!press) return
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) >= CLICK_SLOP) return
        setMenuOpen(!press.wasOpen)
    }

    /** 메뉴를 닫고 동작을 실행한다. */
    const run = (action: () => void) => () => {
        setMenuOpen(false)
        action()
    }

    /**
     * 헤더 행을 토글하는 함수
     * @returns 
     */
    const toggleHeaderRow = () => {
        if (!block.table) return
        setTable(block.id, { ...block.table, headerRow: !block.table.headerRow })
        setMenuOpen(false)
    }
    /**
     * 헤더 열을 토글하는 함수
     * @returns 
     */
    const toggleHeaderColumn = () => {
        if (!block.table) return
        setTable(block.id, { ...block.table, headerColumn: !block.table.headerColumn })
        setMenuOpen(false)
    }

    useEffect(() => {
        if (!menuOpen) return
        const close = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
        }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [menuOpen])

    return (
        <div className="block__menu-wrap" ref={menuRef}>
            <button
                type="button"
                className="block__gutter-btn block__drag-handle"
                title="드래그해서 이동 · 클릭해서 옵션"
                aria-label="블록 옵션"
                aria-expanded={menuOpen}
                onClick={handleClickHandle}
                onPointerDown={handlePressHandle}
            >
                ⋮⋮
            </button>
            {menuOpen && (
                <div className="block__menu" role="menu">
                    <button type="button" role="menuitem" onClick={run(() => moveBlock(block.id, -1))}>
                        위로 이동
                    </button>
                    <button type="button" role="menuitem" onClick={run(() => moveBlock(block.id, 1))}>
                        아래로 이동
                    </button>
                    <button type="button" role="menuitem" onClick={run(() => duplicateBlock(block.id))}>
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
                        onClick={run(() => deleteBlock(block.id))}
                    >
                        삭제
                    </button>
                </div>
            )}
        </div>
    );
}