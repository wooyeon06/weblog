import { useContext } from "react";
import { useTableEventHandler } from "../../../../hooks/useTableEventHandler";
import { clearRow, COLUMN_ROW_COLORS, duplicateRow, insertRow, removeRow, setRowColor } from "../../../../lib/table";
import { TableContext } from "./TableContextProvider";
import { IconArrowDown, IconArrowUp, IconChevronRight, IconColor, IconCopy, IconEraser, IconHeader, IconTrash } from "./TableMenuIcons";

export default function RowMenu() {
    
    const { table, menu, colorMenuFor, setColorMenuFor } = useContext(TableContext);
    const { rows, headerRow } = table;
    const { apply } = useTableEventHandler();

    if(!menu) return;
    return (<>
        {
            menu.index === 0 &&
            <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={headerRow}
                onClick={() => apply({ ...table, headerRow: !headerRow })}
            >
                <span className="table-block__menu-icon"><IconHeader /></span>
                머리글 행
                <span className={`table-block__switch${headerRow ? ' table-block__switch--on' : ''}`}>
                    <span className="table-block__switch-thumb" />
                </span>
            </button>
        }
        <button
            type="button"
            aria-expanded={colorMenuFor === 'row'}
            onClick={() => setColorMenuFor((prev) => (prev === 'row' ? null : 'row'))}
        >
            <span className="table-block__menu-icon"><IconColor /></span>
            색
            <span className="table-block__menu-chevron"><IconChevronRight /></span>
        </button>
        {colorMenuFor === 'row' && (
            <div className="table-block__menu-colors">
                {COLUMN_ROW_COLORS.map((c) => {
                    const active = (rows[menu.index].color ?? 'default') === c.key
                    return (
                        <button
                            key={c.key}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            title={c.label}
                            className={`table-block__color-swatch${active ? ' table-block__color-swatch--on' : ''}`}
                            style={{ background: c.value ?? 'var(--surface)' }}
                            onClick={() => apply(setRowColor(table, menu.index, c.key === 'default' ? undefined : c.key))}
                        />
                    )
                })}
            </div>
        )}

        <div className="table-block__menu-sep" />

        <button type="button" role="menuitem" onClick={() => apply(insertRow(table, menu.index), { row: menu.index, column: 0 })}>
            <span className="table-block__menu-icon"><IconArrowUp /></span>
            위에 삽입
        </button>
        <button type="button" role="menuitem" onClick={() => apply(insertRow(table, menu.index + 1), { row: menu.index + 1, column: 0 })}>
            <span className="table-block__menu-icon"><IconArrowDown /></span>
            아래에 삽입
        </button>
        <button type="button" role="menuitem" onClick={() => apply(duplicateRow(table, menu.index))}>
            <span className="table-block__menu-icon"><IconCopy/></span>
            복제
            <span className="table-block__menu-shortcut">Ctrl+D</span>
        </button>
        <button type="button" role="menuitem" onClick={() => apply(clearRow(table, menu.index))}>
            <span className="table-block__menu-icon"><IconEraser /></span>
            콘텐츠 삭제
        </button>
        <button
            type="button"
            role="menuitem"
            className="table-block__menu-danger"
            disabled={rows.length <= 1}
            onClick={() => apply(removeRow(table, menu.index))}
        >
            <span className="table-block__menu-icon"><IconTrash /></span>
            삭제
        </button>
    </>)
}