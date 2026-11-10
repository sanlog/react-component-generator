import { useState, useCallback, useEffect, useRef } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import { STORAGE_KEYS, loadComponents, saveJSON } from '../utils/storage';
import { readCodeStream } from '../utils/readCodeStream';

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  /** 생성 중인 컴포넌트. 코드가 스트리밍으로 채워지며 완료되면 null이 되고 components에 확정된다. */
  streamingComponent: GeneratedComponent | null;
  isLoading: boolean;
  error: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = useState<GeneratedComponent[]>(loadComponents);
  const [streamingComponent, setStreamingComponent] = useState<GeneratedComponent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.components, components);
  }, [components]);

  const abortRef = useRef<AbortController | null>(null);

  // 언마운트 시 진행 중인 요청을 중단해 서버가 upstream 호출을 멈추게 한다.
  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    // 새 생성을 시작하면 이전 요청은 중단한다.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const draft: GeneratedComponent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      prompt,
      code: '',
      createdAt: new Date(),
    };

    try {
      const res = await fetch('/api/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate component');
      }

      setStreamingComponent(draft);
      const code = await readCodeStream(res.body, (partial) => {
        setStreamingComponent({ ...draft, code: partial });
      });

      // 같은 id로 확정해 카드가 리마운트되지 않고 코드 탭 -> 미리보기 탭으로 전환된다.
      setComponents((prev) => [{ ...draft, code }, ...prev]);
    } catch (err) {
      // 사용자가 시작한 중단(새 생성, 언마운트)은 에러로 보여주지 않는다.
      if (!controller.signal.aborted) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      }
    } finally {
      // 이미 다른 요청으로 교체됐다면 그 요청의 상태를 지우지 않는다.
      if (abortRef.current === controller) {
        setStreamingComponent(null);
        setIsLoading(false);
      }
    }
  }, []);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, []);

  return { components, streamingComponent, isLoading, error, generate, removeComponent, clearAll };
}
