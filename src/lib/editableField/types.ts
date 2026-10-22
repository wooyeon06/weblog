/**
 * 에디터가 입력칸을 다루는 공통 인터페이스. 위치는 모두 "마크다운 문자열" 기준이다.
 * - 코드 블록은 textarea 를 그대로 쓴다. (HTMLTextAreaElement 가 이 모양을 그대로 만족한다)
 * - 나머지 블록·표 셀은 서식을 바로 보여주는 contentEditable(RichField)이다.
 */
export interface EditableField {
  readonly value: string
  readonly selectionStart: number
  readonly selectionEnd: number
  setSelectionRange(start: number, end: number): void
  focus(): void
  blur(): void
  getBoundingClientRect(): DOMRect
}

/** 서식 툴바 등 바깥에서 본문과 선택을 바꿀 때 RichInput 이 받는 함수 */
export type EditListener = (md: string, start: number, end: number) => void
