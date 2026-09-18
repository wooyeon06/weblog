import { useContext, useState } from "react"
import type { Post } from "../../types"
import { EditorContext } from "../../pages/EditorPage";

export default function Tag({ post }: { post: Post }) {
    const [tagDraft, setTagDraft] = useState('')
    const { patch } = useContext(EditorContext);

    const addTag = () => {
        const tag = tagDraft.trim().replace(/^#/, '')
        if (!tag || post.tags.includes(tag)) {
            setTagDraft('')
            return
        }
        patch({ tags: [...post.tags, tag] }, post)
        setTagDraft('')
    }

    return (
        <div className="tag-row">
            {post.tags.map((tag) => (
                <button
                    type="button"
                    className="tag tag--removable"
                    key={tag}
                    onClick={() => patch({ tags: post.tags.filter((value) => value !== tag) })}
                    title="태그 삭제"
                >
                    #{tag} <span aria-hidden>×</span>
                </button>
            ))}
            <input
                className="tag-input"
                placeholder="태그 추가"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onBlur={addTag}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault()
                        addTag()
                    }
                    if (event.key === 'Backspace' && !tagDraft && post.tags.length > 0) {
                        patch({ tags: post.tags.slice(0, -1) })
                    }
                }}
            />
        </div>
    )
}