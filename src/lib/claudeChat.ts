/**
 * Anthropic Claude 공급자. 공식 SDK(@anthropic-ai/sdk)로 브라우저에서 바로 호출한다.
 * (Gemini·Groq·OpenRouter 는 lib/ai.ts)
 */
import Anthropic from '@anthropic-ai/sdk'
import { AiError, INVALID_KEY_MESSAGE } from './aiError'

/** 한 번의 답변 최대 길이. 블로그 글 한 편은 충분히 담는다. */
const MAX_TOKENS = 16000

type ClaudeStreamArgs = {
  apiKey: string
  model: string
  system: string
  turns: Array<{ role: 'user' | 'assistant'; content: string }>
  signal?: AbortSignal
  onDelta: (chunk: string) => void
}

/** SDK 오류 → 화면에 보여 줄 AiError. 구체적인 오류부터 확인한다. */
function toAiError(error: unknown): unknown {
  // 사용자가 멈춘 것은 그대로 넘긴다. (AiAssistant 가 signal.aborted 로 따로 처리한다)
  if (error instanceof Anthropic.APIUserAbortError) return error
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiError(INVALID_KEY_MESSAGE, error.status)
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError('사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.', 429)
  }
  if (error instanceof Anthropic.APIError) {
    const detail = (error.error as { error?: { message?: string } } | undefined)?.error?.message ?? error.message
    if (/credit balance/i.test(detail)) {
      return new AiError('크레딧이 부족합니다. Anthropic 콘솔에서 크레딧을 충전해 주세요.', error.status)
    }
    return new AiError(detail.slice(0, 300) || `요청이 실패했습니다 (${error.status ?? '네트워크'})`, error.status)
  }
  return error
}

export async function streamClaude({ apiKey, model, system, turns, signal, onDelta }: ClaudeStreamArgs): Promise<void> {
  // 사용자가 직접 넣은 키를 자기 브라우저에서 쓰는 구조라 브라우저 호출을 허용한다. (다른 공급자와 같은 방식)
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  // 빈 메시지는 API 가 거부하므로 뺀다.
  const messages: Anthropic.MessageParam[] = turns
    .filter((turn) => turn.content.trim())
    .map((turn) => ({ role: turn.role, content: turn.content }))

  try {
    const stream = client.messages.stream(
      {
        model,
        max_tokens: MAX_TOKENS,
        // 글쓰기 도우미 대화는 깊은 추론이 필요 없으므로 노력 수준을 낮춰 비용과 응답 시간을 줄인다.
        output_config: { effort: 'low' },
        system,
        messages,
      },
      { signal },
    )

    for await (const event of stream) {
      // 사고 과정(thinking)은 화면에 보이지 않고, 답변 글자만 이어 붙인다.
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') onDelta(event.delta.text)
    }

    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') {
      throw new AiError('Claude 가 이 요청에는 답하지 않았습니다. 질문을 바꿔서 다시 시도해 주세요.')
    }
    if (final.stop_reason === 'max_tokens') {
      onDelta('\n\n_(답변이 길어 중간에 끊겼습니다. "이어서 써 줘"라고 요청해 주세요.)_')
    }
  } catch (error) {
    throw toAiError(error)
  }
}
