/**
 * KeyboardEvent.key 값 상수.
 * DOM 타입에서 key는 string이라 오타를 잡아 주지 않으므로 여기 정의된 값으로 비교한다.
 */
export const Key = {
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Escape: 'Escape',
} as const

export type Key = typeof Key[keyof typeof Key]
