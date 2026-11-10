import type { GeneratedComponent, Provider } from '../types';

// API 키는 의도적으로 저장하지 않는다 (src/AGENTS.md Local Golden Rules).
export const STORAGE_KEYS = {
  provider: 'rcg:provider',
  history: 'rcg:history',
  components: 'rcg:components',
} as const;

export const MAX_HISTORY = 20;

const DEFAULT_PROVIDER: Provider = 'google';

function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 용량 초과나 저장소 차단 시에도 앱은 계속 동작해야 한다.
  }
}

export function loadProvider(): Provider {
  const value = readJSON(STORAGE_KEYS.provider);
  return value === 'anthropic' || value === 'google' ? value : DEFAULT_PROVIDER;
}

export function loadHistory(): string[] {
  const value = readJSON(STORAGE_KEYS.history);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function loadComponents(): GeneratedComponent[] {
  const value = readJSON(STORAGE_KEYS.components);
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.id !== 'string' ||
      typeof item.prompt !== 'string' ||
      typeof item.code !== 'string'
    ) {
      return [];
    }
    const createdAt = new Date(item.createdAt);
    if (Number.isNaN(createdAt.getTime())) return [];
    return [{ id: item.id, prompt: item.prompt, code: item.code, createdAt }];
  });
}

export function addPromptToHistory(history: string[], prompt: string): string[] {
  return [prompt, ...history.filter((p) => p !== prompt)].slice(0, MAX_HISTORY);
}
