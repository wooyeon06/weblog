/**
 * 블록 본문의 인라인 마크다운을 "서식이 붙은 글자 조각(run)" 목록으로 다룬다.
 *
 *   **굵게**  *기울임*  ++밑줄++  ~~취소선~~  `코드`  [링크](url)
 *   {color:red}글자색{/color}  {bg:yellow}배경색{/bg}
 *
 * - 저장 형식은 마크다운 문자열 그대로다. (블록 text)
 * - 편집기(RichInput)와 읽기 화면(RichText)이 같은 파서를 쓰므로 두 화면이 항상 같게 보인다.
 * - 사용자가 글자로 친 기호(`*` 등)는 `\*` 처럼 이스케이프해서 저장한다. 서식으로 오해되지 않는다.
 * - 조각의 각 글자가 마크다운 어디에 있는지 기억하므로 "화면 글자 위치 ↔ 마크다운 위치"를 오갈 수 있다.
 *
 * 파일 구성 (의존 방향: types ← parse ← serialize·position ← edit, types ← autoFormat)
 *   types.ts      타입·기호 표·조각 도우미
 *   parse.ts      마크다운 → Run[]
 *   serialize.ts  Span[] → 마크다운
 *   position.ts   화면 글자 위치 ↔ 마크다운 위치
 *   edit.ts       서식 토글·블록 나누기/합치기·글자 삽입
 *   autoFormat.ts 입력 중 자동 서식
 *
 * 바깥에서는 이 index 만 import 한다. (`lib/inlineMarkdown`)
 */

export { MARKS } from './types'
export type { Mark, Run, Span, WrapKind } from './types'
export { parseInline } from './parse'
export { normalizeSpans, runsMatchSpans, serializeInline } from './serialize'
export { mdToPlain, plainLength, plainText, plainToMd } from './position'
export {
  clearMarks,
  insertInline,
  isMarkActive,
  joinInline,
  setWrap,
  spansOf,
  splitInline,
  toggleMark,
  wrapValue,
} from './edit'
export type { InlineEdit } from './edit'
export { autoFormat } from './autoFormat'
