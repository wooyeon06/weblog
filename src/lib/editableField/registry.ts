/** 화면의 contentEditable 요소(DOM)와 그 요소를 다루는 RichField 객체를 짝지어 둔다. */
import type { RichField } from './richField'
import type { EditableField } from './types'

/** 키는 입력칸 DOM 요소. 요소가 문서에서 사라지면 항목도 저절로 정리된다. (WeakMap) */
const registry = new WeakMap<Element, RichField>()

/** RichField 가 만들어질 때 자기를 등록한다. */
export function registerField(root: Element, field: RichField) {
  registry.set(root, field)
}

/** RichField 가 정리될 때 등록을 지운다. */
export function unregisterField(root: Element) {
  registry.delete(root)
}

/** DOM 요소 → 입력칸. 표 셀처럼 요소를 querySelector 로 찾는 곳에서 쓴다. */
export function fieldOf(element: Element | null | undefined): EditableField | null {
  if (!element) return null
  if (element instanceof HTMLTextAreaElement) return element
  return registry.get(element) ?? null
}

export function richFieldOf(element: Element | null | undefined): RichField | null {
  return element ? registry.get(element) ?? null : null
}
