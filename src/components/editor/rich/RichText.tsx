import './richText.scss'

import { Fragment, type ReactNode } from 'react'
import { isSafeHref } from '../../../lib/editableField'
import { parseInline } from '../../../lib/inlineMarkdown'
import { colorClass } from '../../../lib/textColors'

/**
 * 인라인 마크다운(**굵게**, *기울임*, ++밑줄++, `코드`, ~~취소선~~, [링크](url), {color:red}색{/color})을
 * React 엘리먼트로 변환한다. 편집기(RichInput)와 같은 파서·태그 구성을 쓰므로 두 화면이 같게 보인다.
 * innerHTML 을 쓰지 않으므로 XSS 위험이 없다.
 */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((run, index) => {
        let node: ReactNode = run.text
        if (run.marks.includes('code')) node = <code className="inline-code">{node}</code>
        if (run.marks.includes('strike')) node = <s>{node}</s>
        if (run.marks.includes('underline')) node = <u>{node}</u>
        if (run.marks.includes('italic')) node = <em>{node}</em>
        if (run.marks.includes('bold')) node = <strong>{node}</strong>
        if (run.bg) node = <span className={colorClass('bg', run.bg)}>{node}</span>
        if (run.color) node = <span className={colorClass('color', run.color)}>{node}</span>
        if (run.href && isSafeHref(run.href)) {
          node = (
            <a className="rt-link" href={run.href} target="_blank" rel="noreferrer noopener">
              {node}
            </a>
          )
        }
        return <Fragment key={index}>{node}</Fragment>
      })}
    </>
  )
}
