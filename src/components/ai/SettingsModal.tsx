import { useEffect, useState } from 'react'
import type { AiProvider, AiSettings } from '../../types'
import { PROVIDERS, providerInfo } from '../../lib/ai'

type SettingsModalProps = {
  settings: AiSettings
  onSave: (settings: AiSettings) => void
  onClose: () => void
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState<AiSettings>(settings)
  const info = providerInfo(draft.provider)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const changeProvider = (provider: AiProvider) => {
    setDraft({ ...draft, provider, model: providerInfo(provider).models[0] })
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="AI 설정"
      >
        <h2 className="modal__title">AI 설정</h2>
        <p className="modal__lead">
          무료로 API 키를 받을 수 있는 제공자 중 하나를 고르세요. 키는 이 브라우저 탭의
          localStorage 에만 저장되고 서버로 전송되지 않습니다.
        </p>

        <label className="field">
          <span className="field__label">제공자</span>
          <div className="provider-grid">
            {PROVIDERS.map((provider) => (
              <button
                type="button"
                key={provider.id}
                className={`provider-card${draft.provider === provider.id ? ' provider-card--on' : ''}`}
                onClick={() => changeProvider(provider.id)}
              >
                <span className="provider-card__name">{provider.label}</span>
                <span className="provider-card__note">{provider.note}</span>
              </button>
            ))}
          </div>
        </label>

        <label className="field">
          <span className="field__label">API 키</span>
          <input
            className="input"
            type="password"
            autoComplete="off"
            placeholder={draft.provider === 'gemini' ? 'AIza...' : 'sk-...'}
            value={draft.apiKey}
            onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
          />
          <a className="field__link" href={info.keyUrl} target="_blank" rel="noreferrer noopener">
            {info.label} 키 발급 페이지 열기 ↗
          </a>
        </label>

        <label className="field">
          <span className="field__label">모델</span>
          <input
            className="input"
            list="model-options"
            value={draft.model}
            onChange={(event) => setDraft({ ...draft, model: event.target.value })}
          />
          <datalist id="model-options">
            {info.models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
          <span className="field__hint">추천: {info.models.join(' · ')}</span>
        </label>

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onSave({ ...draft, apiKey: draft.apiKey.trim(), model: draft.model.trim() })
              onClose()
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
