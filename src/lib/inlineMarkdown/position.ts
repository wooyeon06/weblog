/** 위치 변환: 화면 글자 위치 ↔ 마크다운 위치 */

import { parseInline } from './parse'
import type { Run } from './types'

export function plainLength(runs: Run[]) {
  const last = runs[runs.length - 1]
  return last ? last.plainStart + last.text.length : 0
}

/** 서식 기호를 뺀 글자만 */
export function plainText(md: string) {
  return parseInline(md).map((run) => run.text).join('')
}

/** 마크다운 위치 → 화면 글자 위치. 기호 안쪽을 가리키면 가까운 글자 경계로 붙인다. */
export function mdToPlain(runs: Run[], md: number): number {
  for (const run of runs) {
    for (let k = 0; k < run.text.length; k += 1) {
      // 글자 앞(또는 이스케이프 `\` 와 글자 사이)
      if (md < run.ends[k]) return run.plainStart + k
    }
    if (md === run.ends[run.ends.length - 1]) return run.plainStart + run.text.length
  }
  return plainLength(runs)
}

/**
 * 화면 글자 위치 → 마크다운 위치.
 * `edges` 가 true 면 처음/끝은 항상 0 / md.length 다. (블록 합치기·방향키 이동이 이 값을 비교한다)
 * 조각 경계에서는 `bias` 가 'before' 면 앞 조각 안쪽(**ab|**), 'after' 면 뒤 조각 안쪽(**|cd**)을 가리킨다.
 */
export function plainToMd(
  runs: Run[],
  md: string,
  plain: number,
  bias: 'before' | 'after' = 'before',
  edges = true,
): number {
  const total = plainLength(runs)
  if (edges && plain <= 0) return 0
  if (edges && plain >= total) return md.length
  for (const run of runs) {
    const k = plain - run.plainStart
    if (bias === 'before' && k > 0 && k <= run.text.length) return run.ends[k - 1]
    if (bias === 'after' && k >= 0 && k < run.text.length) return run.starts[k]
  }
  return plain <= 0 ? 0 : md.length
}
