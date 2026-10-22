import { useContext, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from "react";
import { insertInline } from "../../../lib/inlineMarkdown";
import { RichInputContext } from "./RichInput";
import useRichInputHandler from "./useRichInputUtils";
import { isInternalHref, isSafeHref } from "../../../lib/editableField";
import { navigate, parseHash } from "../../../lib/router";
import { Key } from "../../../lib/keys";

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
            (event.key === Key.ArrowLeft || event.key === Key.ArrowRight) &&
            !mod && !event.shiftKey && !event.altKey &&
            window.getSelection()?.isCollapsed
        ) {
            const direction = event.key === Key.ArrowLeft ? 'left' : 'right'
            if (field().skipCaretAnchor(direction) || field().exitFormatting(true, direction)) {
                event.preventDefault()
                return
            }
        }

        onKeyDown?.(event)
        if (event.defaultPrevented) return

        // 에디터가 처리하지 않은 Enter(표 셀, Shift+Enter 등)는 줄바꿈 글자로 넣는다.
        if (event.key === Key.Enter) {
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

    /**
     * 링크를 누르면 연다. (노션과 같이 그냥 클릭으로)
     * 드래그로 글자를 선택한 경우는 링크 글자를 고치려는 것이므로 열지 않는다.
     */
    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        const anchor = (event.target as HTMLElement).closest('a')
        const href = anchor?.dataset.href
        if (!href || !isSafeHref(href)) return
        if (!window.getSelection()?.isCollapsed) return
        event.preventDefault()
        // 앱 안 페이지 링크(#/p/...)는 지금 탭에서 이동한다.
        if (isInternalHref(href)) navigate(parseHash(href))
        else window.open(href, '_blank', 'noopener,noreferrer')
    }


    return {
        handleKeyDown,
        handlePaste,
        handleClick,
    }




}