# src/AGENTS.md

## Module Context

React 19 + Vite 프론트엔드. 프롬프트를 `/api/generate`로 보내고, 반환된 코드를 react-live로 미리보기 및 코드 뷰로 표시한다. 서버 코드(`server/`)를 직접 import하지 않는다.

## Tech Stack and Constraints

- 미리보기는 `react-live`의 `LiveProvider noInline` 사용 (`components/LivePreview.tsx:71`). 생성 코드는 `render(...)` 호출을 전제로 한다.
- API 호출은 상대 경로 `/api/*`만 사용한다. Vite 프록시가 3002로 전달하므로 호스트를 하드코딩하지 않는다 (`hooks/useComponentGenerator.ts:28`).

## Implementation Patterns

- 서버 통신과 상태는 `hooks/useComponentGenerator.ts`에 모은다. 컴포넌트에서 직접 fetch하지 않는다.
- 공용 타입은 `types/index.ts`에 둔다.
- 컴포넌트와 테스트는 같은 디렉토리에 `Name.tsx`, `Name.test.tsx`로 둔다.

## Testing Strategy

- `bun run test src/` 로 프론트엔드 테스트만 실행한다.
- 테스트는 Testing Library + jsdom. `afterEach`의 `cleanup`은 `test/setup.ts`가 전역 처리하므로 테스트마다 반복하지 않는다 (`test/setup.ts:6-8`).
- 테스트가 있는 대상은 `PromptInput`, `utils/validatePrompt.ts`, `utils/storage.ts`다. 나머지 컴포넌트와 훅은 테스트 경계 밖이므로, 로직을 추가하면 테스트를 함께 작성한다.
- localStorage 접근 로직은 `utils/storage.ts`의 순수 함수로 두고 `storage.test.ts`로 검증한다. 훅/컴포넌트에서 `localStorage`를 직접 호출하지 않는다.

## Local Golden Rules

- Don't: API 키를 `localStorage`/`sessionStorage`에 저장하지 않는다. 키는 `App.tsx`의 메모리 state로만 보유하고 provider 변경 시 비운다. 생성 코드를 실행하는 구조라 XSS 시 키 탈취 위험이 크다.
- Do: 새로고침 후 유지되는 상태는 provider, 프롬프트 히스토리(최대 20개), 생성된 컴포넌트 목록 3가지뿐이며 `utils/storage.ts`의 `STORAGE_KEYS`(`rcg:*`)로만 저장한다. 새 항목을 저장 대상에 추가할 때 민감 정보인지 먼저 확인한다.
- Do: apiKey 입력이 없으면 요청 본문에서 `apiKey` 필드를 생략해 서버의 `.env` 키를 사용하게 한다 (`hooks/useComponentGenerator.ts:31`).
- Do: 미리보기 새로고침은 `key`를 바꿔 리마운트하는 방식을 유지한다 (`components/ComponentCard.tsx:149`). 애니메이션 컴포넌트 재실행이 목적이다.
- Don't: 서버 에러 응답의 `error` 필드를 가공 없이 사용자에게 표시하는 흐름을 깨지 않는다 (`hooks/useComponentGenerator.ts:37`). 서버가 사용자용 한국어 메시지를 만든다.
