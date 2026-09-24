# welog

노션처럼 글을 쓰고, 플로팅 버튼으로 언제든 AI와 대화하며 이어 쓸 수 있는 블로그 웹서비스입니다.
React 19 + TypeScript + Vite, 런타임 의존성은 `react` / `react-dom` 뿐입니다.

## 시작하기

```bash
pnpm install   # 또는 npm install
pnpm dev       # http://localhost:5173
```

AI 기능을 쓰려면 실행 후 **⚙ AI 설정** 에서 API 키를 등록하세요.

## 기능

### 1. 목록 화면

- 카드 그리드로 글 목록 표시 (아이콘, 발행/초안 배지, 발췌, 태그, 수정 시각, 글자 수)
- 제목·본문·태그 통합 검색, 상태 필터(전체/발행/초안), 태그 필터
- 새 글 쓰기 / 글 삭제
- 글을 열면 주소가 `#/p/:id` 로 바뀝니다. 브라우저 뒤로/앞으로가 그대로 동작하고,
  에디터 주소를 북마크하거나 새로고침해도 그 글이 다시 열립니다.

### 2. 블록 에디터 (노션 스타일)

의존성 없이 직접 구현했습니다. 블록 하나가 자동 높이 조절 `textarea` 라서 캐럿 동작이 안정적입니다.

| 조작 | 동작 |
| --- | --- |
| `/` | 블록 타입 메뉴 (↑↓ 이동, Enter 선택, 타이핑으로 검색) |
| `# ` `## ` `### ` | 제목 1/2/3 |
| `- ` `* ` | 글머리 목록 |
| `1. ` | 번호 목록 (번호는 자동 계산) |
| `> ` | 인용 |
| `[] ` `[x] ` | 할 일 (체크박스) |
| ` ``` ` | 코드 블록 |
| `---` | 구분선 |
| `Enter` | 캐럿 위치에서 블록 분할 (목록은 같은 타입 유지) |
| `Backspace` (줄 맨 앞) | 들여쓰기 해제 → 텍스트로 전환 → 위 블록과 병합 |
| `Tab` / `Shift+Tab` | 들여쓰기 (최대 3단계, 코드 블록에서는 공백 삽입) |
| `↑` `↓` | 블록 경계에서 이전/다음 블록으로 이동 |

- 블록 왼쪽 `+` / `⋮⋮` 로 블록 추가·위아래 이동·복제·삭제
- 인라인 마크다운(`**굵게**`, `*기울임*`, `` `코드` ``, `~~취소선~~`, `[링크](url)`)은 **👁 읽기** 모드에서 렌더링
  (`innerHTML` 을 쓰지 않고 React 엘리먼트로 변환하므로 XSS 위험 없음)
- 제목, 아이콘 이모지, 태그, 발행 상태 편집

### 3. AI 도우미

- 오른쪽 아래 **✨ 플로팅 버튼** (또는 `Ctrl/Cmd + J`) 으로 어느 화면에서든 대화창 열기
- 작성 중인 글 전체를 문맥으로 전달 (`글 문맥 포함` 체크박스로 해제 가능)
- 빠른 실행: 이어서 쓰기 · 개요 만들기 · 다듬기(선택 영역 우선) · 3줄 요약 · 제목 추천 · 태그 추천
- 응답 **스트리밍** 및 중지
- AI 답변 → **본문에 삽입** 을 누르면 마크다운이 에디터 블록으로 변환되어 커서 위치에 들어감

#### AI 제공자 (모두 무료 티어)

기본값은 **Google Gemini** 입니다. 신용카드 없이 키를 받을 수 있고 무료 한도가 가장 넉넉해서 선택했습니다.

| 제공자 | 기본 모델 | 키 발급 |
| --- | --- | --- |
| Google Gemini (기본) | `gemini-2.5-flash` | https://aistudio.google.com/apikey |
| Groq | `llama-3.3-70b-versatile` | https://console.groq.com/keys |
| OpenRouter | `deepseek/deepseek-chat-v3.1:free` | https://openrouter.ai/keys |

## 데이터 저장

요청대로 **브라우저 `localStorage`** 에 저장합니다 (`welog:posts`, `welog:ai-settings`).

- 탭을 닫으면 글과 API 키가 모두 사라집니다. 유지가 필요하면
  [src/lib/storage.ts](src/lib/storage.ts) 의 `localStorage` 를 `localStorage` 로 바꾸거나,
  같은 파일의 함수 본문만 서버 API 호출로 교체하면 됩니다. 저장 경로는 이 파일 한 곳뿐입니다.
- 새 탭에서 처음 열면 사용법이 담긴 예시 글이 하나 들어갑니다.

## 보안 참고

API 키를 브라우저에 두고 AI 제공자를 직접 호출하는 구조라 **로컬 개발/개인용에 적합**합니다.
여러 사용자에게 배포한다면 키를 서버에 두고 프록시 엔드포인트를 만든 뒤,
[src/lib/ai.ts](src/lib/ai.ts) 의 `streamChat` 이 그 엔드포인트를 호출하도록 바꾸세요.

## 구조

```
src/
├─ App.tsx                     라우트 스위치, AI 설정, 전역 플로팅 UI
├─ types.ts
├─ pages/
│  ├─ ListPage.tsx             `#/` 목록 화면
│  └─ EditorPage.tsx           `#/p/:id` 에디터 화면
├─ hooks/
│  └─ usePostHandle.ts         글 목록 상태 + 자동 저장 + 현재 글
├─ lib/
│  ├─ ai.ts                    제공자 어댑터, SSE 스트리밍, 시스템 프롬프트
│  ├─ router.ts                해시 라우터 (`#/`, `#/p/:id`)
│  ├─ blocks.ts                블록 헬퍼, 마크다운 단축키/직렬화/파싱
│  ├─ storage.ts               localStorage 저장소 (교체 지점)
│  └─ id.ts
└─ components/
   ├─ PostList.tsx             목록 화면
   ├─ RichText.tsx             인라인 마크다운 렌더러
   ├─ editor/
   │  ├─ Editor.tsx            에디터 셸, 키보드 처리, AI 삽입 API
   │  ├─ BlockRow.tsx          블록 하나
   │  ├─ SlashMenu.tsx         `/` 메뉴
   │  ├─ slashItems.ts
   │  └─ PostView.tsx          읽기 모드 렌더러
   └─ ai/
      ├─ AiAssistant.tsx       플로팅 버튼 + 대화 패널
      └─ SettingsModal.tsx     제공자 / API 키 / 모델 설정
```

## 스크립트

```bash
pnpm dev       # 개발 서버
pnpm build     # 타입체크 + 프로덕션 빌드
pnpm lint      # ESLint
pnpm preview   # 빌드 결과 미리보기
```
