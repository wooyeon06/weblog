/**
 * 코드 블록 포맷터.
 * Prettier·sql-formatter 는 무거우므로 처음 포맷할 때 그 언어에 필요한 것만 불러온다.
 */
import type { Plugin } from 'prettier'
import { normalizeLang } from './codeLanguages'

/** Prettier 로 포맷하는 언어(Prism 언어 이름) → Prettier 파서 */
const PRETTIER_PARSERS: Record<string, string> = {
  javascript: 'babel',
  jsx: 'babel',
  json: 'json',
  typescript: 'typescript',
  tsx: 'typescript',
  css: 'css',
  scss: 'scss',
  markup: 'html',
}

/** 파서에 필요한 Prettier 플러그인을 불러온다. */
async function loadPlugins(parser: string): Promise<Plugin[]> {
  const estree = () => import('prettier/plugins/estree')
  const plugins = await (() => {
    switch (parser) {
      case 'babel':
      case 'json':
        return Promise.all([import('prettier/plugins/babel'), estree()])
      case 'typescript':
        return Promise.all([import('prettier/plugins/typescript'), estree()])
      case 'css':
      case 'scss':
        return Promise.all([import('prettier/plugins/postcss')])
      default:
        // html 안의 <script>·<style> 도 함께 포맷하도록 js·css 플러그인도 넣는다.
        return Promise.all([
          import('prettier/plugins/html'),
          import('prettier/plugins/babel'),
          estree(),
          import('prettier/plugins/postcss'),
        ])
    }
  })()
  return plugins as Plugin[]
}

/** 이 언어를 포맷할 수 있는지 */
export function canFormat(lang?: string): boolean {
  const language = normalizeLang(lang)
  return language === 'sql' || language in PRETTIER_PARSERS
}

/**
 * 코드를 언어에 맞게 포맷한다. 문법 오류가 있으면 예외를 던진다.
 * 포맷터가 붙이는 끝 줄바꿈은 뗀다. (코드 블록은 끝 줄바꿈 없이 저장한다)
 */
export async function formatCode(code: string, lang?: string): Promise<string> {
  const language = normalizeLang(lang)

  if (language === 'sql') {
    const { format } = await import('sql-formatter')
    return format(code, { language: 'sql' }).trimEnd()
  }

  const parser = PRETTIER_PARSERS[language]
  if (!parser) throw new Error('포맷을 지원하지 않는 언어입니다.')

  const [{ format }, plugins] = await Promise.all([import('prettier/standalone'), loadPlugins(parser)])
  const formatted = await format(code, { parser, plugins })
  return formatted.trimEnd()
}
