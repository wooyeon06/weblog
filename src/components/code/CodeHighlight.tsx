import './CodeHighlight.scss'

import { Fragment } from 'react'
import { Highlight, type PrismTheme } from 'prism-react-renderer'
import { normalizeLang } from '../../lib/codeLanguages'
import { Prism } from '../../lib/prism'

/** 색은 테마의 인라인 스타일 대신 CodeHighlight.scss 의 토큰 클래스로 입힌다. (다크 모드를 CSS 변수로 맞추기 위해) */
const NO_THEME: PrismTheme = { plain: {}, styles: [] }

/**
 * Prism 토큰 종류(tag, string ...)에 tok- 접두사를 붙인 클래스.
 * 그대로 쓰면 App.css 의 .tag(글 태그 칩) 같은 전역 스타일과 이름이 겹친다.
 */
const tokenClass = (types: string[]) => types.map((type) => `tok-${type}`).join(' ')

/**
 * 코드 글자를 언어에 맞춰 색칠한 span 들로 그린다. 감싸는 <pre>·<code> 는 쓰는 쪽에서 둔다.
 * 지원하지 않는 언어는 글자 그대로 둔다.
 */
export function CodeHighlight({ code, lang }: { code: string; lang?: string }) {
  const language = normalizeLang(lang)
  if (!language) return <>{code}</>

  return (
    <Highlight prism={Prism} theme={NO_THEME} code={code} language={language}>
      {({ tokens }) =>
        tokens.map((line, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 && '\n'}
            {/* 빈 줄은 '\n' 토큰 하나로 오는데, 줄바꿈은 위에서 넣으므로 건너뛴다. */}
            {line.map((token, tokenIndex) =>
              token.empty ? null : (
                <span key={tokenIndex} className={tokenClass(token.types)}>
                  {token.content}
                </span>
              ),
            )}
          </Fragment>
        ))
      }
    </Highlight>
  )
}
