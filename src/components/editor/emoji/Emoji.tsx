import { useContext, useEffect, useRef, useState } from "react"
import { EditorContext } from "../../../pages/EditorPage";
import type { Post } from "../../../types";
import { Key } from "../../../lib/keys";

/** 페이지 아이콘 후보. 한 줄에 8개씩 보이므로 주제별로 8개씩 묶는다. */
const EMOJIS = [
    // 폴더·정리
    '📁', '📂', '🗂️', '🗃️', '📋', '📌', '📎', '🔖',
    // 문서·공부
    '📝', '📄', '📚', '📖', '📓', '✏️', '🎓', '🧠',
    // 아이디어·작업
    '💡', '🚀', '🎯', '✅', '🔧', '🛠️', '💻', '🐛',
    // 일정·기록
    '📅', '⏰', '📊', '📈', '💰', '🏷️', '🔑', '🔍',
    // 생활·취미
    '☕', '🍽️', '🏃', '🎵', '🎬', '🎮', '📷', '✈️',
    // 자연·장식
    '🌱', '🌸', '🌙', '☀️', '🔥', '✨', '⭐', '🗺️',
    // 사람·감정
    '👋', '👓', '💬', '❤️', '😀', '🤔', '🙏', '🎉',
]

export default function Emoji({ post }: { post: Post }) {
    const { patch } = useContext(EditorContext);

    const [emojiOpen, setEmojiOpen] = useState(false)
    /** 아이콘 버튼 + 이모지 선택 창. 이 바깥을 누르면 선택 창을 닫는다. */
    const emojiRowRef = useRef<HTMLDivElement>(null)

    // 이모지 선택 창: 바깥을 누르거나 Esc 를 누르면 닫는다.
    useEffect(() => {
        if (!emojiOpen) return
        const handlePointerDown = (event: PointerEvent) => {
            if (!emojiRowRef.current?.contains(event.target as Node)) setEmojiOpen(false)
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === Key.Escape) setEmojiOpen(false)
        }
        document.addEventListener('pointerdown', handlePointerDown, true)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [emojiOpen])

    return (
        <div ref={emojiRowRef} className="editor__emoji-row">
            <button
                type="button"
                className="editor__emoji"
                onClick={() => setEmojiOpen((open) => !open)}
                aria-label="아이콘 변경"
            >
                {post.emoji}
            </button>
            {emojiOpen && (
                <div className="emoji-picker">
                    {EMOJIS.map((emoji) => (
                        <button
                            type="button"
                            key={emoji}
                            onClick={() => {
                                patch({ emoji })
                                setEmojiOpen(false)
                            }}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )


}