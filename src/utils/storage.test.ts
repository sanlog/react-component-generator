import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEYS,
  MAX_HISTORY,
  loadProvider,
  loadHistory,
  loadComponents,
  saveJSON,
  addPromptToHistory,
} from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('saveJSON', () => {
  it('값을 JSON으로 localStorage에 저장한다', () => {
    saveJSON(STORAGE_KEYS.provider, 'anthropic');
    expect(localStorage.getItem(STORAGE_KEYS.provider)).toBe('"anthropic"');
  });

  it('저장소가 예외를 던져도 에러를 전파하지 않는다', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    try {
      expect(() => saveJSON(STORAGE_KEYS.provider, 'google')).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe('loadProvider', () => {
  it('저장된 값이 없으면 google을 반환한다', () => {
    expect(loadProvider()).toBe('google');
  });

  it('저장된 provider를 복원한다', () => {
    localStorage.setItem(STORAGE_KEYS.provider, '"anthropic"');
    expect(loadProvider()).toBe('anthropic');
  });

  it('알 수 없는 값이면 google을 반환한다', () => {
    localStorage.setItem(STORAGE_KEYS.provider, '"openai"');
    expect(loadProvider()).toBe('google');
  });

  it('깨진 JSON이면 google을 반환한다', () => {
    localStorage.setItem(STORAGE_KEYS.provider, '{broken');
    expect(loadProvider()).toBe('google');
  });
});

describe('loadHistory', () => {
  it('저장된 값이 없으면 빈 배열을 반환한다', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('저장된 문자열 배열을 복원한다', () => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(['a', 'b']));
    expect(loadHistory()).toEqual(['a', 'b']);
  });

  it('문자열이 아닌 항목은 걸러낸다', () => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(['a', 1, null]));
    expect(loadHistory()).toEqual(['a']);
  });

  it('배열이 아니면 빈 배열을 반환한다', () => {
    localStorage.setItem(STORAGE_KEYS.history, '{"a":1}');
    expect(loadHistory()).toEqual([]);
  });
});

describe('loadComponents', () => {
  it('저장된 값이 없으면 빈 배열을 반환한다', () => {
    expect(loadComponents()).toEqual([]);
  });

  it('createdAt을 Date로 복원한다', () => {
    const date = new Date('2026-01-02T03:04:05.000Z');
    localStorage.setItem(
      STORAGE_KEYS.components,
      JSON.stringify([{ id: '1', prompt: 'p', code: 'c', createdAt: date }]),
    );
    const [restored] = loadComponents();
    expect(restored.createdAt).toBeInstanceOf(Date);
    expect(restored.createdAt.getTime()).toBe(date.getTime());
  });

  it('형식이 올바르지 않은 항목은 걸러낸다', () => {
    localStorage.setItem(
      STORAGE_KEYS.components,
      JSON.stringify([
        { id: '1', prompt: 'p', code: 'c', createdAt: '2026-01-02T00:00:00.000Z' },
        { id: 2, prompt: 'p' },
        null,
      ]),
    );
    expect(loadComponents().map((c) => c.id)).toEqual(['1']);
  });

  it('깨진 JSON이면 빈 배열을 반환한다', () => {
    localStorage.setItem(STORAGE_KEYS.components, '{broken');
    expect(loadComponents()).toEqual([]);
  });
});

describe('addPromptToHistory', () => {
  it('새 프롬프트를 맨 앞에 추가한다', () => {
    expect(addPromptToHistory(['a'], 'b')).toEqual(['b', 'a']);
  });

  it('중복 프롬프트는 기존 항목을 제거하고 맨 앞으로 옮긴다', () => {
    expect(addPromptToHistory(['a', 'b'], 'b')).toEqual(['b', 'a']);
  });

  it(`최대 ${MAX_HISTORY}개까지만 유지한다`, () => {
    const full = Array.from({ length: MAX_HISTORY }, (_, i) => `p${i}`);
    const next = addPromptToHistory(full, 'new');
    expect(next).toHaveLength(MAX_HISTORY);
    expect(next[0]).toBe('new');
    expect(next).not.toContain(`p${MAX_HISTORY - 1}`);
  });
});
