import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TableData } from "../../../types";
import type { EditableField } from "../../../lib/editableField";

export type Axis = 'row' | 'col'
export type MenuTarget = Axis | 'corner'

/** 표는 가로 스크롤 컨테이너 안에 있어 메뉴가 잘리므로, 손잡이 좌표를 받아 fixed 로 띄운다. */
export type MenuState = { target: MenuTarget; index: number; x: number; y: number }

export type TableProviderType = {
    table : TableData;
    setMenu: React.Dispatch<React.SetStateAction<MenuState | null>>;
    registerFirstCell?: (element: EditableField | null) => void;
    onChange : (table: TableData) => void;
    onFocus?: () => void
    menu: MenuState | null;
    colorMenuFor : Axis | null
    setColorMenuFor : React.Dispatch<React.SetStateAction<Axis | null>>;
    tableRef: React.RefObject<TableData>;
    onChangeRef: React.RefObject<(table: TableData) => void>;
    frameRef: React.RefObject<HTMLDivElement | null>;
    pendingCellRef: React.RefObject<CellPos | null>;
}

export type TableBlockProps = {
  table: TableData
  onChange: (table: TableData) => void
  /** 셀에 포커스가 들어오면 블록을 활성 상태로 만든다. */
  onFocus?: () => void
  /** 첫 셀을 에디터의 포커스 대상으로 등록한다. (/표 직후 바로 입력할 수 있게) */
  registerFirstCell?: (element: EditableField | null) => void
}

export type CellPos = { row: number; column: number }

export const TableContext = createContext<TableProviderType>({} as TableProviderType);

export const TableProvider = ({children, table, onChange, registerFirstCell, onFocus} 
    : TableBlockProps & {children : ReactNode}) => {

    /** 드래그·리사이즈 도중 최신 값을 읽기 위한 사본 */
    const tableRef = useRef(table);

    /* onChangeRef를 만드는 이유 : 리렌더 이후에도 오래 살아있는 클로저(콜백/이벤트 핸들러)는, 
    자신이 "만들어진 시점"의 props·상태 값을 그대로 캡처해서 갖고 있고, 
    그 뒤에 리렌더가 일어나서 실제 값이 바뀌어도 그 클로저 안의 값은 자동으로 따라가지 않는다. 
    즉, ref는 신선한 상태를 유지하기 위함 */
    const onChangeRef = useRef(onChange);
    
    /** 행/열을 추가한 뒤 커서를 옮길 셀 */
    const pendingCellRef = useRef<CellPos | null>(null)
  
    const frameRef = useRef<HTMLDivElement>(null)
    
    const [menu, setMenu] = useState<MenuState | null>(null)

    /** 메뉴 안에서 펼쳐진 색상 선택 아코디언. 메뉴가 바뀌면(닫히거나 다른 행/열로) 접는다. */
    const [colorMenuFor, setColorMenuFor] = useState<Axis | null>(null)
    useEffect(() => setColorMenuFor(null), [menu])
    

    useEffect(() => {
        tableRef.current = table
        onChangeRef.current = onChange
    });

    const value = useMemo<TableProviderType>(() => ({
        tableRef, onChangeRef, frameRef, pendingCellRef,
        menu, setMenu, table,
        colorMenuFor, setColorMenuFor,
        onChange, registerFirstCell, onFocus,
    }), [menu, table, onChange, registerFirstCell, onFocus])

    return (
        <TableContext.Provider value={value}>
            {children}
        </TableContext.Provider>
    )
}

