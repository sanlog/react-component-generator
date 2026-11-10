// 외부 API 에러 메시지를 사용자용 한국어 메시지와 HTTP 상태로 변환하는 순수 함수.
// 상태 코드(503, 429)가 메시지에 포함되어 있어야 변환된다.
export function toUserError(message: string): { status: number; error: string } {
  if (message.includes('503')) {
    return { status: 503, error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' };
  }
  if (message.includes('429')) {
    return { status: 429, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' };
  }
  return { status: 500, error: message };
}
