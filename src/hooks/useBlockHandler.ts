import { useCallback, useContext, useMemo, useRef, type ClipboardEvent, type KeyboardEvent } from "react"
import { filterSlashItems, type SlashItem } from "../components/editor/slashItems"
import { isListType, markdownToBlocks, matchShortcut, MAX_INDENT, newBlock } from "../lib/blocks"
import { newTable } from "../lib/table"
import { EditorContext } from "../pages/EditorPage"

function anchorOf(element: HTMLTextAreaElement | null) {
  if (!element) return { left: 200, top: 200, bottom: 220 }
  const rect = element.getBoundingClientRect()
  return { left: rect.left, top: rect.top, bottom: rect.bottom }
}

export default function useBlockHandler() {
  const { slash, slashIndex, setActiveId, setSlash, setSlashIndex, patch, commitBlocks, 
    inputs, activePost : post } = useContext(EditorContext);
  

  //=============================== Focus [S] ===============================
  const pendingFocus = useRef<{ id: string; caret: number } | null>(null);
  const focusBlock = useCallback((id: string, caret: number) => {
    pendingFocus.current = { id, caret }
  }, [])
  //=============================== Focus [E] ===============================

  //=============================== Slash [S] ===============================
  const slashItems = useMemo(() => (slash ? filterSlashItems(slash.query) : []), [slash]);
  const closeSlash = useCallback(() => {
    setSlash(null)
    setSlashIndex(0)
  }, []);
  //=============================== Slash [E] ===============================

  /**
   * 블록 타입 변경
   * @param item 변경할 블록의 인덱스
   */
  const applySlashItem = useCallback(
    (item: SlashItem) => {
      if (!slash || !post) return
      const index = post.blocks.findIndex((block) => block.id === slash.blockId)
      if (index < 0) return closeSlash()
      const current = post.blocks[index]
      const text = current.text
      const nextText = text.slice(0, slash.start) + text.slice(slash.start + 1 + slash.query.length)
      const blocks = post.blocks.slice()

      if (item.type === 'divider' || item.type === 'table') {
        // 본문을 담지 않는 블록이므로 남은 텍스트는 뒤따르는 새 블록으로 넘긴다.
        blocks[index] = { ...current, type: item.type, text: '', checked: undefined }
        if (item.type === 'table') blocks[index].table = newTable()
        const next = newBlock('text', nextText, current.indent)
        blocks.splice(index + 1, 0, next)
        // 표는 첫 셀이 포커스 대상으로 등록돼 있어 바로 입력할 수 있다.
        focusBlock(item.type === 'table' ? current.id : next.id, 0)
      } else {
        blocks[index] = {
          ...current,
          type: item.type,
          text: nextText,
          checked: item.type === 'todo' ? false : undefined,
        }
        focusBlock(current.id, slash.start)
      }

      closeSlash()
      commitBlocks(blocks)
    },
    [closeSlash, commitBlocks, focusBlock, post?.blocks, slash],
  )

  /**
   * 블록 들여쓰기 변경
   * @param index 변경할 블록의 인덱스
   * @param delta 들여쓰기 단계 변경량 (1 또는 -1)
   */
  const setIndent = useCallback(
    (index: number, delta: number) => {
      if(!post) return;
      const blocks = post.blocks.slice()
      const current = blocks[index]
      const indent = Math.max(0, Math.min(MAX_INDENT, current.indent + delta))
      if (indent === current.indent) return
      blocks[index] = { ...current, indent }
      commitBlocks(blocks)
    },
    [commitBlocks, post?.blocks],
  )

  /**
   * 키보드 이벤트 처리
   * 
   * 1. 슬래시 메뉴가 열려 있으면 메뉴 이동, 선택, 닫기
   * 2. Enter, Backspace, Delete, Tab, ArrowUp, ArrowDown 처리
   * 3. 코드 블록은 Enter 로 줄바꿈, Ctrl/Cmd+Enter 로 탈출
   * 
   * @param event
   * @param id 블록 아이디
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>, id: string) => {
      if(!post) return;
      const index = post.blocks.findIndex((block) => block.id === id)
      if (index < 0) return
      const current = post.blocks[index]
      const target = event.currentTarget
      const caret = target.selectionStart
      const hasSelection = target.selectionStart !== target.selectionEnd //두 값이 다르면, 사용자가 텍스트를 드래그해서 선택한 상태라는 뜻입니다.

      // 슬래시 메뉴가 열려 있으면 먼저 처리
      if (slash && slash.blockId === id && slashItems.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setSlashIndex((value) => (value + 1) % slashItems.length)
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setSlashIndex((value) => (value - 1 + slashItems.length) % slashItems.length)
          return
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault()
          applySlashItem(slashItems[Math.min(slashIndex, slashItems.length - 1)])
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          closeSlash()
          return
        }
      }

      if (event.key === 'Escape') { //ESC
        target.blur()
        return
      }

      if (event.key === 'Tab') { //Tab
        // code 타입 블록은 “코드 문맥”을 유지해야 하므로, 그냥 들여쓰기 단계가 아니라 실제 코드 안에 공백 2칸을 넣어야 합니다.
        if (current.type === 'code') {
          event.preventDefault()
          const text = `${current.text.slice(0, caret)}  ${current.text.slice(target.selectionEnd)}`
          const blocks = post.blocks.slice()
          blocks[index] = { ...current, text }
          focusBlock(id, caret + 2)
          commitBlocks(blocks)
          return
        }
        event.preventDefault()
        setIndent(index, event.shiftKey ? -1 : 1)
        focusBlock(id, caret)
        return
      }

      if (event.key === 'Enter') {
        // 코드 블록은 Enter 로 줄바꿈, Ctrl/Cmd+Enter 로 탈출
        // 코드 블록은 일반 엔터로 분리하지 않고, 코드 안에서만 줄바꿈을 넣는 형태로 유지
        if (current.type === 'code' && !(event.metaKey || event.ctrlKey)) return
        event.preventDefault()

        // 내용이 빈 목록 항목에서 Enter → 일반 텍스트로 전환
        if (isListType(current.type) && !current.text) {
          const blocks = post.blocks.slice()
          if (current.indent > 0) {
            //indent를 한 단계 줄여서 목록의 중첩 레벨을 낮춘다
            blocks[index] = { ...current, indent: current.indent - 1 }
          } else {
            //이 블록은 리스트 타입이 아니라 일반 텍스트로 바꿉니다.
            blocks[index] = { ...current, type: 'text', checked: undefined }
          }
          focusBlock(id, 0)
          commitBlocks(blocks)
          return
        }

        // 선택 영역이 있으면 그 부분은 지우고 나눈다.
        const before = current.text.slice(0, caret)
        const after = current.text.slice(target.selectionEnd)
        const nextType = isListType(current.type) ? current.type : 'text'
        const next = newBlock(nextType, after, current.indent)
        if (nextType === 'todo') next.checked = false

        const blocks = post.blocks.slice()
        blocks[index] = { ...current, text: before }
        blocks.splice(index + 1, 0, next)
        focusBlock(next.id, 0)
        commitBlocks(blocks)
        return
      }
      if (event.key === 'Backspace' && caret === 0 && !hasSelection) {
        if (current.indent > 0) {
          event.preventDefault()
          setIndent(index, -1)
          focusBlock(id, 0)
          return
        }
        if (current.type !== 'text') {
          event.preventDefault()
          const blocks = post.blocks.slice()
          blocks[index] = { ...current, type: 'text', checked: undefined }
          focusBlock(id, 0)
          commitBlocks(blocks)
          return
        }
        if (index > 0) {
          event.preventDefault()
          const blocks = post.blocks.slice()
          const previous = blocks[index - 1]
          if (previous.type === 'divider' || previous.type === 'image') {
            blocks.splice(index - 1, 1)
            focusBlock(id, 0)
            commitBlocks(blocks)
            return
          }
          // 표는 text 가 본문이 아니므로 합치면 내용이 깨진다. 그냥 두고 아무것도 하지 않는다.
          if (previous.type === 'table') return

          const caretAfterMerge = previous.text.length
          blocks[index - 1] = { ...previous, text: previous.text + current.text }
          blocks.splice(index, 1)
          focusBlock(previous.id, caretAfterMerge)
          commitBlocks(blocks)
        }
        return
      }

      if (
        event.key === 'Delete' &&
        caret === current.text.length &&
        !hasSelection &&
        index < post.blocks.length - 1
      ) {
        const next = post.blocks[index + 1]
        if (next.type === 'divider') {
          event.preventDefault()
          const blocks = post.blocks.slice()
          blocks.splice(index + 1, 1)
          commitBlocks(blocks)
          return
        }
        if (next.type === 'text' || next.type === current.type) {
          event.preventDefault()
          const blocks = post.blocks.slice()
          blocks[index] = { ...current, text: current.text + next.text }
          blocks.splice(index + 1, 1)
          focusBlock(id, caret)
          commitBlocks(blocks)
        }
        return
      }

      if (event.key === 'ArrowUp' && caret === 0 && index > 0) {
        event.preventDefault()
        const previous = post.blocks[index - 1]
        focusBlock(previous.id, previous.text.length)
        setActiveId(previous.id)
        return
      }

      if (
        event.key === 'ArrowDown' &&
        caret === current.text.length &&
        index < post.blocks.length - 1
      ) {
        event.preventDefault()
        const next = post.blocks[index + 1]
        focusBlock(next.id, 0)
        setActiveId(next.id)
      }

      if (
        event.altKey && 
        (
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown' 
        ) &&
        current.type === 'text' &&
        current.text
      ) {
        event.preventDefault();
        const index = post.blocks.findIndex((block) => block.id === id);
        if(index <= 0) return;

        const blocks = post.blocks.slice()
        const current = blocks[index]
        const copy = { ...current, id: newBlock().id } // 새 id로 복제

        if( event.key === 'ArrowUp') {
          // Alt + ↑ : 현재 블록 위에 복사본 삽입
          blocks.splice(index, 0, copy);
        } else if( event.key === 'ArrowDown') {
          // Alt + ↓ : 현재 블록 아래에 복사본 삽입
          blocks.splice(index + 1, 0, copy);
        }
        focusBlock(copy.id, caret);
        setActiveId(copy.id);
        commitBlocks(blocks);
        return;
      }

    },
    [applySlashItem, closeSlash, commitBlocks, focusBlock, post?.blocks, setIndent, slash, slashIndex, slashItems],
  )

  /**
   * 이미지 붙여넣기
   * clipboard 인자 중 image/* 항목을 찾아 dataURL 로 변환해 현재 블록을 image 블록으로 바꾼다.
   */
  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>, id: string) => {

      const items = Array.from(event.clipboardData?.items ?? []);
      const types = [...event.clipboardData.types]
      
      const plainText = event.clipboardData.getData('text/plain')
      const html = event.clipboardData.getData('text/html')
      const markdown = event.clipboardData.getData('text/markdown')
      const image = items.find((item) => item.type.startsWith('image/'));

      console.log({ types, plainText, html, markdown })

      const file = image?.getAsFile()
      if (file) {
        event.preventDefault()

        const reader = new FileReader()
        reader.onload = () => {
          if(!post) return;

          const dataUrl = typeof reader.result === 'string' ? reader.result : ''
          if (!dataUrl) return

          const index = post.blocks.findIndex((block) => block.id === id)
          if (index < 0) return

          const blocks = post.blocks.slice()
          const current = blocks[index]
          blocks[index] = {
            ...current,
            type: 'image',
            text: dataUrl,
            checked: undefined,
          }
          focusBlock(id, 0)
          commitBlocks(blocks)
        }
        reader.readAsDataURL(file)
      } else if (plainText) {
        const pastedBlocks = markdownToBlocks(markdown || plainText)
        if (!pastedBlocks.some((block) => block.type === 'table')) return
        if (!post) return

        event.preventDefault()

        const index = post.blocks.findIndex((block) => block.id === id)
        if (index < 0) return

        const blocks = post.blocks.slice()
        blocks.splice(index, 1, ...pastedBlocks)
        commitBlocks(blocks)
      }
      
    },
    [commitBlocks, focusBlock, post?.blocks],
  )

  /**
   * 텍스트 변경 시
   * 1. 마크다운 단축키 (`# `, `- `, `1. ` ...) 활용 시
   *    - 해당 블록을 단축키에 맞는 타입으로 변경
   *    - 디바이더 경우 다음 블록을 새로 생성
   * 2. 슬래시 메뉴 열기 / 갱신 / 닫기
   * 3. 슬래시 메뉴 열기 조건
   */
  const handleTextChange = useCallback(
    (id: string, text: string, caret: number) => {
      if(!post) return;
      const index = post.blocks.findIndex((block) => block.id === id)
      if (index < 0) return

      const current = post.blocks[index];
      const blocks = post.blocks.slice();

      // 마크다운 단축키 (`# `, `- `, `1. ` ...)
      if (!slash && current.type === 'text') {
        const shortcut = matchShortcut(text)
        if (shortcut) {
          blocks[index] = {
            ...current,
            type: shortcut.type,
            text: '',
            checked: shortcut.checked, //TODO ??
          }
          if (shortcut.type === 'divider') {
            const next = newBlock('text', '', current.indent)
            blocks.splice(index + 1, 0, next)
            focusBlock(next.id, 0)
          } else {
            focusBlock(id, 0)
          }
          commitBlocks(blocks)
          return
        }
      }

      blocks[index] = { ...current, text }
      commitBlocks(blocks)

      // 슬래시 메뉴 열기 / 갱신 / 닫기
      if (slash && slash.blockId === id) {
        const query = text.slice(slash.start + 1, caret)
        /*
        1. caret <= slash.start
          커서가 / 위치보다 왼쪽으로 돌아가면 메뉴를 닫습니다.
        2. text[slash.start] !== '/'
        / 문자가 사라졌거나 바뀌어버리면 메뉴를 닫습니다.
        3. /\s/.test(query)
          쿼리 문자열 안에 공백이 들어오면 메뉴를 닫습니다.
        4. query.length > 20
          너무 길면 메뉴를 닫습니다.
        */
        if (caret <= slash.start || text[slash.start] !== '/' || /\s/.test(query) || query.length > 20) {
          closeSlash()
        } else if (query !== slash.query) {
          setSlash({ ...slash, query })
          setSlashIndex(0)
        }
        return
      }

      // 슬래시 메뉴 열기 조건
      const isSingleInsert = text.length === current.text.length + 1
      /*
      !slash : 아직 슬래시 메뉴가 열려 있지 않다
      isSingleInsert : 방금 한 글자만 입력됐다
      caret > 0 : 커서가 텍스트 시작보다 오른쪽에 있다
      text[caret - 1] === '/' : 방금 입력한 마지막 문자가 /다
       */
      if (!slash && isSingleInsert && caret > 0 && text[caret - 1] === '/') {
        const before = caret >= 2 ? text[caret - 2] : ''
        if (!before || /\s/.test(before)) {
          setSlash({
            blockId: id,
            start: caret - 1,
            query: '',
            anchor: anchorOf(inputs.current.get(id) ?? null),
          })
          setSlashIndex(0)
        }
      }
    },
    [closeSlash, commitBlocks, focusBlock, post?.blocks, slash],
  )


  return {
    slashItems,
    pendingFocus, focusBlock,
    commitBlocks, patch,
    handleTextChange, handleKeyDown,
    handlePaste,
    closeSlash, applySlashItem,
  }
}
