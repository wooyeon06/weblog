/** 코드 블록에서 고를 수 있는 언어. value 는 Prism 언어 이름이고, 빈 값은 강조 없는 일반 텍스트다. */
export const CODE_LANGUAGES = [
  { value: '', label: '일반 텍스트' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'markup', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'java', label: 'Java' },
] as const

/** 마크다운 펜스(```js 등)에서 흔히 쓰는 별칭 → Prism 언어 이름 */
const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
}

/** 별칭·대소문자를 정리해 Prism 언어 이름으로 바꾼다. 지원하지 않는 언어는 빈 값(일반 텍스트). */
export function normalizeLang(lang?: string): string {
  const key = lang?.trim().toLowerCase() ?? ''
  const value = ALIASES[key] ?? key
  return CODE_LANGUAGES.some((item) => item.value === value) ? value : ''
}

/** 마크다운 펜스에 쓸 언어 이름. markup 은 다른 도구들이 알아보도록 html 로 쓴다. */
export function fenceLang(lang?: string): string {
  const value = normalizeLang(lang)
  return value === 'markup' ? 'html' : value
}