import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { AiAssistant } from './components/ai/AiAssistant'
import { SettingsModal } from './components/ai/SettingsModal'
import type { EditorHandle } from './components/editor/Editor'
import usePosts from './hooks/usePostHandler'
import { useRoute } from './lib/router'
import { loadSettings, saveSettings } from './lib/storage'
import { EditorPage } from './pages/EditorPage'
import { ListPage } from './pages/ListPage'
import type { AiSettings } from './types'

export default function App() {
  const [settings, setSettings] = useState<AiSettings>(() => loadSettings())
  const route = useRoute()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const editorRef = useRef<EditorHandle>(null)

  // 글 상태는 앱 전체에 하나여야 하므로 훅은 여기서만 호출하고 페이지로 내려준다.
  const { saveState, posts, createPost, deletePost, activePost } = usePosts()

  const insertFromAi = useCallback((markdown: string) => {
    editorRef.current?.insertMarkdown(markdown)
  }, [])

  const getSelection = useCallback(() => editorRef.current?.getSelectedText() ?? '', [])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  return (
    <div className="app">
      {route.name === 'editor' ? (
        <EditorPage
          ref={editorRef}
          post={activePost}
          saveState={saveState}
        />
      ) : (
        <ListPage
          posts={posts}
          onCreate={createPost}
          onDelete={deletePost}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      <AiAssistant
        settings={settings}
        onOpenSettings={() => setSettingsOpen(true)}
        post={activePost}
        onInsert={activePost ? insertFromAi : null}
        getSelection={activePost ? getSelection : null}
      />

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
