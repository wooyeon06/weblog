/**
 * 에디터 입력칸. 코드 블록은 textarea, 나머지 블록·표 셀은 서식을 바로 보여주는 contentEditable(RichField)이다.
 *
 * 파일 구성 (의존 방향: types·links ← dom ← richField → registry)
 *   types.ts      EditableField 인터페이스 (textarea·RichField 공통 모양)
 *   links.ts      링크 주소·글자 규칙 (DOM 없는 순수 함수, 읽기 화면도 쓴다)
 *   dom.ts        조각 ↔ DOM, 화면 글자 위치 ↔ DOM 위치, 커서 자리 글자
 *   registry.ts   DOM 요소 ↔ RichField 짝 (표 셀처럼 요소만 아는 곳에서 입력칸을 찾는다)
 *   richField.ts  RichField 본체
 *
 * 바깥에서는 이 index 만 import 한다. (`lib/editableField`)
 */

export type { EditableField, EditListener } from './types'
export { isInternalHref, isSafeHref, splitPageIcon } from './links'
export { readSpans } from './dom'
export { fieldOf, richFieldOf } from './registry'
export { RichField } from './richField'
