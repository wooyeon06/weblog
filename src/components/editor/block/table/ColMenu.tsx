import { useContext, useEffect, useState } from "react";
import { useTableEventHandler } from "../../../../hooks/useTableEventHandler";
import { clearColumn, COLUMN_ROW_COLORS, duplicateColumn, insertColumn, removeColumn, setColumnColor } from "../../../../lib/table";
import { TableContext, type Axis } from "../table/TableContextProvider";
import { IconArrowLeft, IconArrowRight, IconChevronRight, IconColor, IconCopy, IconEraser, IconHeader, IconTrash } from "../table/TableMenuIcons";

export default function ColMenu() {

    const { table, menu } = useContext(TableContext);
    const { columns, headerColumn } = table;
    const { apply } = useTableEventHandler();
    /** 메뉴 안에서 펼쳐진 색상 선택 아코디언. 메뉴가 바뀌면(닫히거나 다른 행/열로) 접는다. */
    const [colorMenuFor, setColorMenuFor] = useState<Axis | null>(null)
    useEffect(() => setColorMenuFor(null), [menu])

    if(!menu) return;
    return (<>
        {menu.index === 0 &&
            <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={headerColumn}
                onClick={() => apply({ ...table, headerColumn: !headerColumn })}
            >
                <span className="table-block__menu-icon"><IconHeader /></span>
                머리글 열
                <span className={`table-block__switch${headerColumn ? ' table-block__switch--on' : ''}`}>
                    <span className="table-block__switch-thumb" />
                </span>
            </button>
        }
        <button
            type="button"
            aria-expanded={colorMenuFor === 'col'}
            onClick={() => setColorMenuFor((prev) => (prev === 'col' ? null : 'col'))}
        >
            <span className="table-block__menu-icon"><IconColor /></span>
            색
            <span className="table-block__menu-chevron"><IconChevronRight /></span>
        </button>
        {colorMenuFor === 'col' && (
            <div className="table-block__menu-colors">
                {COLUMN_ROW_COLORS.map((c) => {
                    const active = (columns[menu.index].color ?? 'default') === c.key
                    return (
                        <button
                            key={c.key}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            title={c.label}
                            className={`table-block__color-swatch${active ? ' table-block__color-swatch--on' : ''}`}
                            style={{ background: c.value ?? 'var(--surface)' }}
                            onClick={() => apply(setColumnColor(table, menu.index, c.key === 'default' ? undefined : c.key))}
                        />
                    )
                })}
            </div>
        )}

        <div className="table-block__menu-sep" />

        <button type="button" role="menuitem" onClick={() => apply(insertColumn(table, menu.index), { row: 0, column: menu.index })}>
            <span className="table-block__menu-icon"><IconArrowLeft /></span>
            왼쪽에 삽입
        </button>
        <button type="button" role="menuitem" onClick={() => apply(insertColumn(table, menu.index + 1), { row: 0, column: menu.index + 1 })}>
            <span className="table-block__menu-icon"><IconArrowRight /></span>
            오른쪽에 삽입
        </button>
        <button type="button" role="menuitem" onClick={() => apply(duplicateColumn(table, menu.index))}>
            <span className="table-block__menu-icon"><IconCopy /></span>
            복제
            <span className="table-block__menu-shortcut">Ctrl+D</span>
        </button>
        <button type="button" role="menuitem" onClick={() => apply(clearColumn(table, menu.index))}>
            <span className="table-block__menu-icon"><IconEraser /></span>
            콘텐츠 삭제
        </button>
        <button
            type="button"
            role="menuitem"
            className="table-block__menu-danger"
            disabled={columns.length <= 1}
            onClick={() => apply(removeColumn(table, menu.index))}
        >
            <span className="table-block__menu-icon"><IconTrash /></span>
            삭제
        </button>
    </>)
}