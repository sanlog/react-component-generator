import { describe, it, expect } from 'vitest';
import { validatePrompt, MAX_PROMPT_LENGTH } from './validatePrompt';

describe('validatePrompt', () => {
  it('최대 길이는 500자다', () => {
    expect(MAX_PROMPT_LENGTH).toBe(500);
  });

  it('500자 이하면 유효하다', () => {
    expect(validatePrompt('a'.repeat(500))).toEqual({ valid: true, length: 500 });
  });

  it('500자를 넘으면 유효하지 않고 에러 메시지를 반환한다', () => {
    const result = validatePrompt('a'.repeat(501));
    expect(result.valid).toBe(false);
    expect(result.length).toBe(501);
    expect(result.error).toBe('프롬프트는 500자 이하로 입력해주세요.');
  });

  it('빈 문자열도 길이 검증에서는 유효하다', () => {
    expect(validatePrompt('')).toEqual({ valid: true, length: 0 });
  });
});
