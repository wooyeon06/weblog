import './richText.scss'

import { Fragment, type ReactNode } from 'react'
import { isInternalHref, isSafeHref, splitPageIcon } from '../../../lib/editableField'
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
        // 페이지 링크는 아이콘과 제목을 따로 감싸 제목에만 밑줄을 긋는다. (편집기 buildNodes 와 같은 구성)
        const icon = run.href && isInternalHref(run.href) && !run.marks.includes('code') ? splitPageIcon(run.text) : null
        if (icon) {
          node = (
            <>
              <span className="rt-link__icon">{icon[0]}</span>
              <span className="rt-link__title">{icon[1]}</span>
            </>
          )
        }
        if (run.marks.includes('code')) node = <code className="inline-code">{node}</code>
        if (run.marks.includes('strike')) node = <s>{node}</s>
        if (run.marks.includes('underline')) node = <u>{node}</u>
        if (run.marks.includes('italic')) node = <em>{node}</em>
        if (run.marks.includes('bold')) node = <strong>{node}</strong>
        if (run.bg) node = <span className={colorClass('bg', run.bg)}>{node}</span>
        if (run.color) node = <span className={colorClass('color', run.color)}>{node}</span>
        if (run.href && isSafeHref(run.href)) {
          node = (
            // 앱 안 페이지 링크(#/p/...)는 지금 탭에서 이동한다.
            <a
              className={isInternalHref(run.href) ? 'rt-link rt-link--page' : 'rt-link'}
              href={run.href}
              {...(isInternalHref(run.href) ? {} : { target: '_blank', rel: 'noreferrer noopener' })}
            >
              {node}
            </a>
          )
        }
        return <Fragment key={index}>{node}</Fragment>
      })}
    </>
  )
}
