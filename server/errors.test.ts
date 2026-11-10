import { describe, it, expect } from 'vitest';
import { toUserError } from './errors';

describe('toUserError', () => {
  it('503이 포함된 메시지는 과부하 안내와 503으로 변환한다', () => {
    expect(toUserError('Gemini API error: 503')).toEqual({
      status: 503,
      error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('429가 포함된 메시지는 요청 과다 안내와 429로 변환한다', () => {
    expect(toUserError('Claude API error: 429')).toEqual({
      status: 429,
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('provider API 에러(상태 코드 포함)는 그대로 500으로 반환한다', () => {
    expect(toUserError('Claude API error: 401')).toEqual({ status: 500, error: 'Claude API error: 401' });
  });

  it('서버가 만든 한국어 안내 메시지는 그대로 500으로 반환한다', () => {
    const message = '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.';
    expect(toUserError(message)).toEqual({ status: 500, error: message });
  });

  it('알 수 없는 내부 예외 메시지는 일반 문구로 바꿔 원문을 숨긴다', () => {
    expect(toUserError('Unexpected token < in JSON at position 0')).toEqual({
      status: 500,
      error: '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    });
  });
});
