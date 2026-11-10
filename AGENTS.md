# AGENTS.md

## Operational Commands

- 패키지 매니저는 bun 고정. npm/yarn/pnpm 사용 금지.
- 개발 서버(API + Vite 동시): `bun run dev`
- API 서버만: `bun run server` (포트 3002)
- 테스트 전체: `bun run test` (vitest run). `bun test`는 bun 내장 러너를 호출하므로 사용 금지.
- 단일 파일 테스트: `bun run test server/generator.test.ts`
- 린트: `bun run lint`
- 빌드 검증(타입체크 포함): `bun run build`
- 작업 완료 전 `bun run test`, `bun run lint`, `bun run build`를 모두 통과시킨다.

## Golden Rules

### Immutable

- API 키를 응답, 로그, 에러 메시지에 노출하지 않는다. `/api/config`는 키 존재 여부(boolean)만 반환한다 (`server/index.ts:150-153`). 키 값 자체를 클라이언트로 내리는 변경 금지.
- Google 호출은 API 키가 URL 쿼리에 포함된다 (`server/index.ts:99`). 이 URL이나 fetch 에러 객체를 로깅하거나 응답에 싣지 않는다.
- `.env`는 커밋 금지 (`.gitignore`). 키는 코드에 하드코딩하지 않는다.
- 민감 파일(`.env`, `.env.*`, `*credential*`, `*secret*`, `*.pem`, `*.key`, SSH/AWS/gcloud 설정 등)은 읽기·수정·생성을 하지 않는다. `.claude/settings.json`의 `permissions.deny`로 Read/Edit/Write/Bash 접근이 차단되어 있으며, 이 deny 항목을 삭제하거나 완화하지 않는다. 우회(`cat`, `grep`, `printenv` 등 셸 경유, 다른 경로로 복사)도 금지한다. 환경 변수 설정이 필요하면 사용자에게 직접 하도록 안내한다.
- Vite 프록시 대상 포트와 서버 포트는 3002로 일치해야 한다 (`vite.config.ts:11`, `server/index.ts:139`). 한쪽만 바꾸지 않는다.

### Do's and Don'ts

- Do: 새 서버 로직은 부수효과 없는 순수 함수로 `server/generator.ts` 또는 `server/fallback.ts` 같은 별도 모듈에 두고 테스트를 함께 작성한다. `server/index.ts`는 `Bun.serve` 부수효과 때문에 테스트 대상이 아니다 (`server/generator.ts:1-2`).
- Do: AI 응답 후처리는 `stripCodeFences` -> `ensureRenderCall` 순서를 유지한다 (`server/index.ts:188`).
- Don't: `SYSTEM_PROMPT`의 제약(import 금지, `render()` 호출, TypeScript 문법 금지)을 완화하지 않는다 (`server/index.ts:11-12,20`). 미리보기는 react-live `noInline` 모드라 위반 시 렌더가 깨진다 (`src/components/LivePreview.tsx:71`).
- Don't: 프롬프트 지시와 후처리 중 한쪽만 제거하지 않는다. 같은 위험(코드펜스, 누락된 `render()`)을 프롬프트(`server/index.ts:12,16`)와 후처리(`server/generator.ts`) 양쪽에서 막는 이중 방어 구조다.
- Don't: provider 간 비대칭을 모르고 수정하지 않는다. Google 경로에만 `MAX_TOKENS` 잘림 검사와 모델 폴백이 있다 (`server/index.ts:123,135`). Anthropic 경로에는 없다 (`server/index.ts:68-96`). 의도된 차이인지 확인 후 변경한다.
- Don't: 서버 에러 상태 매핑이 에러 메시지 문자열 매칭에 의존함을 잊지 않는다 (`server/index.ts:194,201`). 외부 API 에러를 새로 throw할 때 상태 코드(503, 429)를 메시지에 포함해야 사용자용 메시지로 변환된다.

## Standards and References

- 기술 스택 및 실행 방법: `README.md` 참조.
- 커밋 메시지: 한국어 `타입: 요약` (feat, fix, refactor, chore). 요약은 한 줄, 마침표 없음. 상세 절차는 `.claude/skills/commit/SKILL.md`.
- 응답 언어와 UI 문구는 한국어.

## Context Map

- **[서버/AI 프록시 수정](./server/AGENTS.md)** — Bun 서버, provider 호출, 응답 정규화 작업 시.
- **[프론트엔드 수정](./src/AGENTS.md)** — React 컴포넌트, 훅, 미리보기, 컴포넌트 테스트 작업 시.

## Maintenance Policy

- 규칙과 코드 사이에 괴리를 발견하면 해당 AGENTS.md 업데이트를 사용자에게 제안한다.
- 인용된 파일·라인이 이동하면 근거 참조를 함께 갱신한다.
