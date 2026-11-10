// provider 스트리밍 응답(SSE)을 파싱하고 클라이언트용 NDJSON 라인을 만드는 순수 함수들.
// 부수효과가 없어 단위 테스트가 가능하다.
import { stripCodeFences, ensureRenderCall } from './generator';
import {
  CUT_OFF_MESSAGE,
  EMPTY_MESSAGE,
  INTERRUPTED_MESSAGE,
  TRUNCATED_MESSAGE,
  toUserError,
} from './errors';

/** SSE 텍스트를 청크 단위로 받아 완성된 이벤트의 data 페이로드만 돌려준다. */
export function createSSEParser(): { feed: (chunk: string) => string[] } {
  let buffer = '';

  return {
    feed(chunk) {
      buffer += chunk;
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      const payloads: string[] = [];
      for (const event of events) {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data) payloads.push(data);
      }
      return payloads;
    },
  };
}

/** Anthropic 스트리밍 이벤트에서 텍스트 조각을 꺼낸다. error 이벤트는 던진다. */
export function extractAnthropicText(data: string): string {
  const event = JSON.parse(data) as {
    type: string;
    delta?: { type?: string; text?: string };
    error?: { type?: string };
  };

  if (event.type === 'error') {
    // 상태 코드를 메시지에 담아야 toUserError가 사용자용 메시지로 변환한다.
    const type = event.error?.type;
    const code = type === 'overloaded_error' ? '503' : type === 'rate_limit_error' ? '429' : type;
    throw new Error(`Claude API error: ${code ?? 'unknown'}`);
  }
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return event.delta.text ?? '';
  }
  return '';
}

/** Google 스트리밍 청크에서 텍스트 조각과 종료 사유를 꺼낸다. */
export function extractGoogleChunk(data: string): { text: string; finishReason?: string } {
  const chunk = JSON.parse(data) as {
    error?: { code?: number };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  if (chunk.error) {
    throw new Error(`Gemini API error: ${chunk.error.code ?? 'unknown'}`);
  }

  const candidate = chunk.candidates?.[0];
  return {
    text: candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '',
    finishReason: candidate?.finishReason,
  };
}

export type CodeStreamEvent =
  | { type: 'delta'; code: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

/**
 * provider SSE 청크를 받아 클라이언트용 이벤트(delta/done/error)로 변환한다.
 * 에러는 사용자용 한국어 메시지로 변환하며, 에러 이후에는 더 이상 이벤트를 내보내지 않는다.
 * 후처리 순서는 stripCodeFences -> ensureRenderCall을 유지한다.
 */
export function createCodeStreamProcessor(provider: 'anthropic' | 'google'): {
  feed: (chunk: string) => CodeStreamEvent[];
  finish: () => CodeStreamEvent[];
} {
  const parser = createSSEParser();
  let text = '';
  let completed = false;
  let failed = false;

  const fail = (message: string): CodeStreamEvent[] => {
    failed = true;
    return [{ type: 'error', error: toUserError(message).error }];
  };

  return {
    feed(chunk) {
      if (failed) return [];
      const events: CodeStreamEvent[] = [];

      try {
        for (const data of parser.feed(chunk)) {
          let piece: string;

          if (provider === 'google') {
            const parsed = extractGoogleChunk(data);
            piece = parsed.text;
            text += piece;
            // 잘림 검사는 Google 경로에만 있다. Anthropic에는 없는 의도된 비대칭이다 (AGENTS.md).
            if (parsed.finishReason === 'MAX_TOKENS') throw new Error(TRUNCATED_MESSAGE);
            if (parsed.finishReason && parsed.finishReason !== 'STOP') throw new Error(INTERRUPTED_MESSAGE);
            if (parsed.finishReason === 'STOP') completed = true;
          } else {
            if ((JSON.parse(data) as { type?: string }).type === 'message_stop') completed = true;
            piece = extractAnthropicText(data);
            text += piece;
          }

          if (piece) events.push({ type: 'delta', code: stripCodeFences(text) });
        }
      } catch (err) {
        return [...events, ...fail(err instanceof Error ? err.message : 'Unknown error')];
      }

      return events;
    },

    finish() {
      if (failed) return [];
      if (!completed) return fail(CUT_OFF_MESSAGE);
      if (!text.trim()) return fail(EMPTY_MESSAGE);
      return [{ type: 'done', code: ensureRenderCall(stripCodeFences(text)) }];
    },
  };
}

/**
 * upstream SSE 바이트 스트림을 클라이언트용 NDJSON 바이트 스트림으로 변환한다.
 * 클라이언트가 취소하면 upstream 읽기도 취소해 토큰 소모를 막는다.
 */
export function createCodeEventStream(
  upstream: ReadableStream<Uint8Array>,
  provider: 'anthropic' | 'google',
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.getReader();
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (events: CodeStreamEvent[]) => {
        for (const event of events) controller.enqueue(encoder.encode(encodeLine(event)));
      };
      const processor = createCodeStreamProcessor(provider);

      try {
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          send(processor.feed(decoder.decode(value, { stream: true })));
        }
        if (!cancelled) send(processor.finish());
      } catch (err) {
        // upstream 읽기 실패. 클라이언트가 이미 떠났다면 보낼 곳이 없다.
        if (!cancelled) {
          send([{ type: 'error', error: toUserError(err instanceof Error ? err.message : '').error }]);
        }
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
      return reader.cancel();
    },
  });
}

/** 클라이언트로 보낼 이벤트를 NDJSON 한 줄로 직렬화한다. */
export function encodeLine(event: unknown): string {
  return `${JSON.stringify(event)}\n`;
}
