import { useState, useCallback, useEffect } from 'react';
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

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
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
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setStreamingComponent(null);
      setIsLoading(false);
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
