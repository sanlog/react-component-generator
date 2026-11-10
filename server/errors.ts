// 외부 API 에러 메시지를 사용자용 한국어 메시지와 HTTP 상태로 변환하는 순수 함수.
// 상태 코드(503, 429)가 메시지에 포함되어 있어야 변환된다.

export const TRUNCATED_MESSAGE = '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.';
export const INTERRUPTED_MESSAGE = '생성이 중단되었습니다. 다른 요청으로 다시 시도해주세요.';
export const CUT_OFF_MESSAGE = '응답이 중간에 끊겼습니다. 다시 시도해주세요.';
export const EMPTY_MESSAGE = '생성된 코드가 비어 있습니다. 다시 시도해주세요.';
const GENERIC_MESSAGE = '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

// 서버가 직접 만든 안내 메시지와 provider 상태 코드 에러만 사용자에게 그대로 보여준다.
// 그 외 예외(SyntaxError, 네트워크 에러 등)는 내부 정보가 섞일 수 있어 일반 문구로 바꾼다.
const KNOWN_MESSAGES = new Set([TRUNCATED_MESSAGE, INTERRUPTED_MESSAGE, CUT_OFF_MESSAGE, EMPTY_MESSAGE]);
const PROVIDER_ERROR = /^(Claude|Gemini) API error: \w+$/;

export function toUserError(message: string): { status: number; error: string } {
  if (message.includes('503')) {
    return { status: 503, error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' };
  }
  if (message.includes('429')) {
    return { status: 429, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' };
  }
  if (KNOWN_MESSAGES.has(message) || PROVIDER_ERROR.test(message)) {
    return { status: 500, error: message };
  }
  return { status: 500, error: GENERIC_MESSAGE };
}
