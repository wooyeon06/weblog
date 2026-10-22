/**
 * 코드 블록 문법 강조용 Prism 설정.
 * prism-react-renderer 에 기본 포함된 언어(js, ts, jsx, tsx, css, html, json, sql 등) 외에
 * 자주 쓰는 언어를 추가로 등록한다.
 */
import { Prism } from 'prism-react-renderer'

// prismjs 언어 파일은 전역 Prism 에 문법을 등록하므로, 전역 설정 뒤에 불러온다.
// (정적 import 는 끌어올려져 먼저 실행되므로 dynamic import 를 쓴다.)
;(globalThis as { Prism?: typeof Prism }).Prism = Prism
await import('prismjs/components/prism-bash')
await import('prismjs/components/prism-java')
await import('prismjs/components/prism-scss')

export { Prism }
