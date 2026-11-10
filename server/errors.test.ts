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

  it('그 외 메시지는 그대로 500으로 반환한다', () => {
    expect(toUserError('boom')).toEqual({ status: 500, error: 'boom' });
  });
});
