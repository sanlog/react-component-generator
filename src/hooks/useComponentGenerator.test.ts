import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

function ndjsonResponse(...lines: object[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      lines.forEach((line) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`)));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe('useComponentGenerator 스트리밍', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('스트림이 완료되면 최종 코드를 components에 추가하고 streamingComponent를 비운다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ndjsonResponse(
          { type: 'delta', code: 'const App' },
          { type: 'done', code: 'const App = () => null;\n\nrender(<App />);' },
        ),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('버튼', undefined, 'anthropic'));

    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].code).toBe('const App = () => null;\n\nrender(<App />);');
    expect(result.current.streamingComponent).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('스트림 중 에러가 나면 에러를 표시하고 컴포넌트를 추가하지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ndjsonResponse(
          { type: 'delta', code: 'const App' },
          { type: 'error', error: '응답이 중간에 끊겼습니다. 다시 시도해주세요.' },
        ),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('버튼', undefined, 'anthropic'));

    expect(result.current.error).toBe('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
    expect(result.current.components).toHaveLength(0);
    expect(result.current.streamingComponent).toBeNull();
  });

  it('연결 단계 실패는 서버가 준 한국어 에러 메시지를 그대로 표시한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 }),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('버튼', undefined, 'google'));

    expect(result.current.error).toBe('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    expect(result.current.components).toHaveLength(0);
  });
});
