import { useContext, useLayoutEffect } from "react"
import { RichInputContext, type Snapshot } from "./RichInput"

/** 이 시간 안에 이어서 친 글자는 실행 취소 한 번에 함께 되돌린다. */
const HISTORY_MERGE_MS = 1000
const HISTORY_LIMIT = 200


export default function useRichInputUtils() {
    // history 는 Provider 에 하나만 있다. 이 훅을 여러 곳에서 불러도 같은 기록을 쓴다.
    const {onChangeRef, field, value, historyRef} = useContext(RichInputContext);

    /**
     * 히스토리를 기록한다.
     * @param snapshot 
     * @param typing 
     * @returns 
     */
    const record = (snapshot: Snapshot, typing: boolean) => {
        const state = historyRef.current
        const now = Date.now()
        const top = state.entries[state.index]

        if (top?.md === snapshot.md) return

        state.entries = state.entries.slice(0, state.index + 1)
        
        // 이어서 치는 글자는 마지막 기록을 덮어써서 한 번에 되돌린다.
        if (typing && state.index > 0 && now - state.typedAt < HISTORY_MERGE_MS) state.entries[state.index] = snapshot
        else state.entries.push(snapshot)

        if (state.entries.length > HISTORY_LIMIT) state.entries.shift()
        state.index = state.entries.length - 1
        state.typedAt = typing ? now : 0
    }

    /** 새 본문을 그리고, 선택을 맞추고, 위로 알린다. */
    const commit = (md: string, start: number, end: number, typing: boolean) => {
        const current = field()
        current.render(md); // dom 생성
        current.setSelectionRange(start, end) 
        record({ md, caret: end }, typing);  // history 기록
        if (md !== value) onChangeRef.current(md, end)
    }
    
    const travel = (step: -1 | 1) => {
        const state = historyRef.current
        const target = state.entries[state.index + step]
        if (!target) return
        state.index += step
        state.typedAt = 0
        const current = field()
        current.render(target.md)
        current.setSelectionRange(target.caret, target.caret)
        if (target.md !== value) onChangeRef.current(target.md, target.caret)
    }

    // 툴바 등 바깥에서 오는 편집
    useLayoutEffect(() => {
        field().onEdit = (md, start, end) => commit(md, start, end, false)
    })

    return {
        travel,
        commit,
        record
    }

}