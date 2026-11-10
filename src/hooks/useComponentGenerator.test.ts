import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

const encoder = new TextEncoder();

function ndjsonResponse(...lines: object[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      lines.forEach((line) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`)));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

/** 테스트가 직접 이벤트를 밀어 넣을 수 있는 스트리밍 응답. */
function controllableResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: new Response(body, { status: 200 }),
    push: (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
    close: () => controller.close(),
  };
}

/** signal이 abort되면 AbortError로 reject하는 fetch 구현. */
const abortableFetch = (_url: string, init: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });

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

  it('스트리밍 엔드포인트에 prompt, apiKey, provider와 abort signal을 담아 요청한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ndjsonResponse({ type: 'done', code: 'x' }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('버튼', 'sk-test', 'google'));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/generate/stream',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ prompt: '버튼', apiKey: 'sk-test', provider: 'google' }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('생성 중 코드는 streamingComponent로 노출되고 완료 후 같은 id로 확정된다', async () => {
    const stream = controllableResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    const { result } = renderHook(() => useComponentGenerator());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.generate('버튼', undefined, 'anthropic');
    });
    await act(async () => {
      stream.push({ type: 'delta', code: 'const' });
    });
    await waitFor(() => expect(result.current.streamingComponent?.code).toBe('const'));
    const streamingId = result.current.streamingComponent!.id;

    await act(async () => {
      stream.push({ type: 'done', code: 'const App = () => null;\n\nrender(<App />);' });
      stream.close();
      await pending;
    });

    expect(result.current.components[0].id).toBe(streamingId);
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

describe('useComponentGenerator 취소', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('언마운트하면 진행 중인 요청을 abort하고 에러로 표시하지 않는다', async () => {
    const fetchMock = vi.fn(abortableFetch);
    vi.stubGlobal('fetch', fetchMock);
    const { result, unmount } = renderHook(() => useComponentGenerator());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.generate('버튼', undefined, 'anthropic');
    });
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;

    unmount();

    await expect(pending).resolves.toBeUndefined();
    expect(signal.aborted).toBe(true);
  });

  it('새 생성을 시작하면 이전 요청을 abort하고, 이전 요청의 정리가 새 요청 상태를 지우지 않는다', async () => {
    const second = controllableResponse();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(abortableFetch)
      .mockResolvedValueOnce(second.response);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useComponentGenerator());

    let first!: Promise<void>;
    let next!: Promise<void>;
    act(() => {
      first = result.current.generate('첫 번째', undefined, 'anthropic');
    });
    act(() => {
      next = result.current.generate('두 번째', undefined, 'anthropic');
    });

    await act(async () => {
      await first;
    });

    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      second.push({ type: 'done', code: 'const App = () => null;\n\nrender(<App />);' });
      second.close();
      await next;
    });

    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].prompt).toBe('두 번째');
    expect(result.current.isLoading).toBe(false);
  });
});
