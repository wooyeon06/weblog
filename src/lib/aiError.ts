/** AI 요청 실패. message 는 화면에 그대로 보여 줄 한국어 문구다. */
export class AiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AiError'
    this.status = status
  }
}

export const INVALID_KEY_MESSAGE = 'API 키가 올바르지 않습니다. 설정에서 키를 다시 확인해 주세요.'
