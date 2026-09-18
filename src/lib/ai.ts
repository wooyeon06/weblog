import type { AiProvider, AiSettings, ChatRole } from '../types'

export type AiTurn = { role: ChatRole; content: string }

export type ProviderInfo = {
  id: AiProvider
  label: string
  /** 무료 사용 방식 안내 */
  note: string
  keyUrl: string
  models: string[]
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    note: '무료 티어 제공 · 신용카드 없이 API 키 발급 가능 (권장)',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: ['gemini-3.6-flash', 'gemini-3.6-flash-lite', 'gemini-3.0-flash'],
  },
  {
    id: 'groq',
    label: 'Groq',
    note: '무료 티어 제공 · 응답이 매우 빠름',
    keyUrl: 'https://console.groq.com/keys',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    note: '모델 이름이 :free 로 끝나는 무료 모델 사용 가능',
    keyUrl: 'https://openrouter.ai/keys',
    models: ['deepseek/deepseek-chat-v3.1:free', 'meta-llama/llama-3.3-70b-instruct:free'],
  },
]

export function providerInfo(id: AiProvider): ProviderInfo {
  return PROVIDERS.find((provider) => provider.id === id) ?? PROVIDERS[0]
}

export const SYSTEM_PROMPT = `당신은 한국어 블로그 글쓰기를 돕는 편집자입니다.

규칙:
- 답변은 그대로 블로그 본문에 붙여넣을 수 있게 작성합니다.
- 서식은 마크다운을 사용합니다 (##, -, 1., >, \`\`\`).
- "무엇을 도와드릴까요" 같은 인사말이나 사족은 붙이지 않고 결과만 씁니다.
- 사용자가 쓴 글의 어투와 문체를 유지합니다.
- 사실을 모르면 추측하지 말고 표시합니다.`

export class AiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AiError'
    this.status = status
  }
}

type StreamArgs = {
  settings: AiSettings
  turns: AiTurn[]
  /** 현재 작성 중인 글 문맥 */
  documentContext?: string
  signal?: AbortSignal
  onDelta: (chunk: string) => void
}

/** SSE 응답 본문을 한 줄씩 읽어 data: 페이로드만 넘겨준다. */
async function readSse(
  response: Response,
  onData: (payload: string) => void,
): Promise<void> {
  const body = response.body
  if (!body) throw new AiError('응답 본문을 읽을 수 없습니다.')
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      onData(payload)
    }
  }
  const tail = buffer.trim()
  if (tail.startsWith('data:')) {
    const payload = tail.slice(5).trim()
    if (payload && payload !== '[DONE]') onData(payload)
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  let text: string
  try {
    text = await response.text()
  } catch {
    return response.statusText
  }
  try {
    const json = JSON.parse(text) as { error?: { message?: string } | string }
    const error = json.error
    if (typeof error === 'string') return error
    return error?.message ?? text
  } catch {
    return text
  }
}

async function toAiError(response: Response, provider: AiProvider): Promise<AiError> {
  const detail = await readErrorDetail(response)

  if (response.status === 401 || response.status === 403) {
    return new AiError('API 키가 올바르지 않습니다. 설정에서 키를 다시 확인해 주세요.', response.status)
  }
  if (response.status === 400 && provider === 'gemini' && /API key/i.test(detail)) {
    return new AiError('API 키가 올바르지 않습니다. 설정에서 키를 다시 확인해 주세요.', 400)
  }
  if (response.status === 429) {
    return new AiError('무료 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.', 429)
  }
  return new AiError(detail.slice(0, 300) || `요청이 실패했습니다 (${response.status})`, response.status)
}

function buildSystemPrompt(documentContext?: string): string {
  if (!documentContext?.trim()) return SYSTEM_PROMPT
  return `${SYSTEM_PROMPT}

--- 사용자가 지금 작성 중인 글 ---
${documentContext.slice(0, 12_000)}
--- 문맥 끝 ---`
}

type GeminiContent = { role: 'user' | 'model'; parts: Array<{ text: string }> }

/** Gemini 는 user / model 이 번갈아 나오는 것을 기대하므로 연속된 같은 역할을 합친다. */
function toGeminiContents(turns: AiTurn[]): GeminiContent[] {
  const contents: GeminiContent[] = []
  for (const turn of turns) {
    const role = turn.role === 'assistant' ? 'model' : 'user'
    const last = contents[contents.length - 1]
    if (last && last.role === role) {
      last.parts[0].text += `\n\n${turn.content}`
    } else {
      contents.push({ role, parts: [{ text: turn.content }] })
    }
  }
  return contents
}

type GeminiChunk = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> }
    finishReason?: string
  }>
  error?: { message?: string }
}

async function streamGemini(args: StreamArgs): Promise<void> {
  const { settings, turns, documentContext, signal, onDelta } = args
  const model = settings.model || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:streamGenerateContent?alt=sse`

  const generationConfig: Record<string, unknown> = {
    temperature: 0.8,
    maxOutputTokens: 4096,
  }
  // 2.5 계열은 기본으로 사고 과정을 사용하므로, 응답 속도를 위해 최소화한다.
  if (model.includes('2.5')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 }
  }

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': settings.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(documentContext) }] },
      contents: toGeminiContents(turns),
      generationConfig,
    }),
  })

  if (!response.ok) throw await toAiError(response, 'gemini')

  await readSse(response, (payload) => {
    let chunk: GeminiChunk
    try {
      chunk = JSON.parse(payload) as GeminiChunk
    } catch {
      return
    }
    if (chunk.error?.message) throw new AiError(chunk.error.message)
    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (part.thought) continue
      if (part.text) onDelta(part.text)
    }
  })
}

type OpenAiChunk = {
  choices?: Array<{ delta?: { content?: string | null } }>
  error?: { message?: string }
}

const OPENAI_COMPATIBLE_URLS: Record<'groq' | 'openrouter', string> = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
}

async function streamOpenAiCompatible(
  args: StreamArgs,
  provider: 'groq' | 'openrouter',
): Promise<void> {
  const { settings, turns, documentContext, signal, onDelta } = args
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.apiKey}`,
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin
    headers['X-Title'] = 'weblog'
  }

  const response = await fetch(OPENAI_COMPATIBLE_URLS[provider], {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      temperature: 0.8,
      messages: [
        { role: 'system', content: buildSystemPrompt(documentContext) },
        ...turns.map((turn) => ({ role: turn.role, content: turn.content })),
      ],
    }),
  })

  if (!response.ok) throw await toAiError(response, provider)

  await readSse(response, (payload) => {
    let chunk: OpenAiChunk
    try {
      chunk = JSON.parse(payload) as OpenAiChunk
    } catch {
      return
    }
    if (chunk.error?.message) throw new AiError(chunk.error.message)
    const delta = chunk.choices?.[0]?.delta?.content
    if (delta) onDelta(delta)
  })
}

export async function streamChat(args: StreamArgs): Promise<void> {
  if (!args.settings.apiKey.trim()) {
    throw new AiError('먼저 설정에서 API 키를 입력해 주세요.')
  }
  if (args.settings.provider === 'gemini') return streamGemini(args)
  return streamOpenAiCompatible(args, args.settings.provider)
}
