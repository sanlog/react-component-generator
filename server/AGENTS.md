# server/AGENTS.md

## Module Context

Bun 런타임에서 실행되는 AI provider 프록시 서버. 프론트엔드의 `/api/generate`, `/api/config` 요청을 받아 Anthropic 또는 Google API로 전달하고 응답 코드를 정규화한다.

## Tech Stack and Constraints

- 런타임은 Bun (`Bun.serve`, `process.env`). Node 전용 API로 바꾸지 않는다.
- HTTP 호출은 전역 `fetch`만 사용한다. SDK나 axios를 추가하지 않는다 (`server/index.ts:69,101`).
- 테스트는 vitest로 실행된다 (`vite.config.ts` include에 `server/**/*.test.ts`). 환경이 jsdom이므로 Bun 전용 API를 테스트에서 import하지 않는다.

## Implementation Patterns

- 순수 함수는 `generator.ts`(응답 정규화), `fallback.ts`(모델 폴백), `stream.ts`(SSE 파싱, 스트림 이벤트 변환), `errors.ts`(에러 메시지 -> 사용자용 메시지/상태 변환)에 두고 같은 이름의 `.test.ts`를 둔다.
- `/api/generate/stream`은 NDJSON(`delta`/`done`/`error`)으로 응답한다. 연결 단계 실패는 JSON 에러 응답, 스트림 도중 실패는 `error` 이벤트로 전달하며 둘 다 `toUserError`를 거친다. 이벤트 변환 로직은 `createCodeStreamProcessor`(이벤트 단위)와 `createCodeEventStream`(바이트 스트림, 취소 처리)에 두고 `index.ts`에는 넣지 않는다.
- 스트리밍 경로의 upstream `fetch`에는 `req.signal`을 연결하고 `withModelFallback`에도 signal을 넘긴다. 클라이언트가 떠난 뒤 다음 모델을 호출하면 토큰이 낭비된다.
- `toUserError`는 서버가 만든 안내 메시지와 `Claude|Gemini API error: <코드>` 형식만 원문을 노출하고 그 외 예외 메시지는 일반 문구로 바꾼다. 새 안내 메시지는 `errors.ts`의 `KNOWN_MESSAGES`에 등록한다.
- 새 Google 모델은 `GOOGLE_MODELS` 배열에 우선순위 순으로 추가한다 (`server/index.ts:5`). 폴백은 `withModelFallback`이 담당한다.
- 새 provider 추가 시 `Provider` 타입, `ENV_KEYS`, `resolveApiKey` 경로, `/api/generate` 분기를 함께 수정한다 (`server/index.ts:57-66,183-186`).

## Testing Strategy

- `bun run test server/` 로 서버 테스트만 실행한다.
- `index.ts`는 테스트하지 않는다. 검증이 필요한 로직은 모듈로 분리한 뒤 단위 테스트한다.

## Local Golden Rules

- Do: 모든 응답에 `CORS_HEADERS`를 포함한다. 새 Response 분기에서 누락하면 브라우저에서 실패한다 (`server/index.ts:51-55`).
- Do: `withModelFallback`은 모든 모델이 실패하면 마지막 에러를 던진다 (`server/fallback.ts`). 호출부에서 에러를 삼키지 않는다.
- Don't: 에러 메시지에 요청 URL이나 키를 포함하지 않는다 (`server/index.ts:112`는 상태 코드만 포함).
- Don't: `ensureRenderCall`의 `render(` 감지 정규식이나 `stripCodeFences` 정규식을 바꿀 때 테스트 갱신 없이 두지 않는다 (`server/generator.test.ts`).
