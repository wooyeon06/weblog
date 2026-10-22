import { useContext, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from "react";
import { insertInline } from "../../../lib/inlineMarkdown";
import { RichInputContext } from "./RichInput";
import useRichInputHandler from "./useRichInputUtils";
import { isSafeHref } from "../../../lib/editableField";

export default function useRichInputEventHandler() {
    const { field, onKeyDown, onPaste } = useContext(RichInputContext);
    const { commit, travel } = useRichInputHandler();


    const insertText = (text: string) => {
        const current = field()
        const [start, end] = current.selection()
        const edit = insertInline(current.value, start, end, text)
        commit(edit.md, edit.start, edit.end, false)
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        // 한글 조합을 확정하는 Enter 등은 에디터 단축키로 보지 않는다.
        if (event.nativeEvent.isComposing || event.keyCode === 229) return

        const mod = event.ctrlKey || event.metaKey
        const key = event.key.toLowerCase()
        if (mod && !event.altKey && (key === 'z' || key === 'y')) {
            event.preventDefault()
            travel(key === 'y' || event.shiftKey ? 1 : -1)
            return
        }

        if (
            (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
            !mod && !event.shiftKey && !event.altKey &&
            window.getSelection()?.isCollapsed
        ) {
            const direction = event.key === 'ArrowLeft' ? 'left' : 'right'
            if (field().skipCaretAnchor(direction) || field().exitFormatting(true, direction)) {
                event.preventDefault()
                return
            }
        }

        onKeyDown?.(event)
        if (event.defaultPrevented) return

        // 에디터가 처리하지 않은 Enter(표 셀, Shift+Enter 등)는 줄바꿈 글자로 넣는다.
        if (event.key === 'Enter') {
            event.preventDefault()
            insertText('\n')
        }
    }

    const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
        onPaste?.(event)
        if (event.defaultPrevented) return
        event.preventDefault()
        const text = event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
        if (text) insertText(text)
    }

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        if (!(event.ctrlKey || event.metaKey)) return
        const anchor = (event.target as HTMLElement).closest('a')
        const href = anchor?.dataset.href
        if (href && isSafeHref(href)) {
            event.preventDefault()
            window.open(href, '_blank', 'noopener,noreferrer')
        }
    }


    return {
        handleKeyDown,
        handlePaste,
        handleClick,
    }




}