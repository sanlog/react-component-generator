import { describe, it, expect, vi } from 'vitest';
import {
  createCodeEventStream,
  createCodeStreamProcessor,
  createSSEParser,
  extractAnthropicText,
  extractGoogleChunk,
  encodeLine,
} from './stream';

describe('createSSEParser', () => {
  it('완성된 이벤트의 data 페이로드를 반환한다', () => {
    const parser = createSSEParser();
    expect(parser.feed('event: x\ndata: {"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it('청크 경계에서 잘린 이벤트는 다음 청크와 합쳐 처리한다', () => {
    const parser = createSSEParser();
    expect(parser.feed('data: {"a"')).toEqual([]);
    expect(parser.feed(':1}\n\ndata: 2\n\n')).toEqual(['{"a":1}', '2']);
  });

  it('CRLF 개행도 처리한다', () => {
    const parser = createSSEParser();
    expect(parser.feed('data: hi\r\n\r\n')).toEqual(['hi']);
  });
});

describe('extractAnthropicText', () => {
  it('text_delta 이벤트에서 텍스트를 꺼낸다', () => {
    const data = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'const' },
    });
    expect(extractAnthropicText(data)).toBe('const');
  });

  it('텍스트가 없는 이벤트는 빈 문자열을 반환한다', () => {
    expect(extractAnthropicText(JSON.stringify({ type: 'message_start' }))).toBe('');
  });

  it('overloaded_error는 503 상태 코드를 포함한 에러로 던진다', () => {
    const data = JSON.stringify({ type: 'error', error: { type: 'overloaded_error' } });
    expect(() => extractAnthropicText(data)).toThrow('Claude API error: 503');
  });

  it('rate_limit_error는 429 상태 코드를 포함한 에러로 던진다', () => {
    const data = JSON.stringify({ type: 'error', error: { type: 'rate_limit_error' } });
    expect(() => extractAnthropicText(data)).toThrow('Claude API error: 429');
  });
});

describe('extractGoogleChunk', () => {
  it('parts 텍스트를 이어 붙이고 finishReason을 반환한다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] }, finishReason: 'STOP' }],
    });
    expect(extractGoogleChunk(data)).toEqual({ text: 'ab', finishReason: 'STOP' });
  });

  it('candidates가 없으면 빈 텍스트를 반환한다', () => {
    expect(extractGoogleChunk('{}')).toEqual({ text: '', finishReason: undefined });
  });
});

const sse = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;
const anthropicText = (text: string) =>
  sse({ type: 'content_block_delta', delta: { type: 'text_delta', text } });
const googleChunk = (text: string, finishReason?: string) =>
  sse({ candidates: [{ content: { parts: [{ text }] }, finishReason }] });

describe('createCodeStreamProcessor (anthropic)', () => {
  it('텍스트 조각마다 코드펜스를 제거한 누적 코드를 delta로 내보낸다', () => {
    const processor = createCodeStreamProcessor('anthropic');
    expect(processor.feed(anthropicText('```jsx\nconst A'))).toEqual([
      { type: 'delta', code: 'const A' },
    ]);
    expect(processor.feed(anthropicText(' = 1;'))).toEqual([
      { type: 'delta', code: 'const A = 1;' },
    ]);
  });

  it('message_stop 이후 finish하면 render 호출을 보정한 done을 내보낸다', () => {
    const processor = createCodeStreamProcessor('anthropic');
    processor.feed(anthropicText('const App = () => null;'));
    processor.feed(sse({ type: 'message_stop' }));
    expect(processor.finish()).toEqual([
      { type: 'done', code: 'const App = () => null;\n\nrender(<App />);' },
    ]);
  });

  it('message_stop 없이 끝나면 에러를 내보낸다', () => {
    const processor = createCodeStreamProcessor('anthropic');
    processor.feed(anthropicText('const A'));
    expect(processor.finish()).toEqual([
      { type: 'error', error: '응답이 중간에 끊겼습니다. 다시 시도해주세요.' },
    ]);
  });

  it('overloaded_error 이벤트는 사용자용 한국어 메시지로 변환한다', () => {
    const processor = createCodeStreamProcessor('anthropic');
    expect(processor.feed(sse({ type: 'error', error: { type: 'overloaded_error' } }))).toEqual([
      { type: 'error', error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' },
    ]);
  });

  it('에러 이후에는 더 이상 이벤트를 내보내지 않는다', () => {
    const processor = createCodeStreamProcessor('anthropic');
    processor.feed(sse({ type: 'error', error: { type: 'overloaded_error' } }));
    expect(processor.feed(anthropicText('x'))).toEqual([]);
    expect(processor.finish()).toEqual([]);
  });

  it('텍스트가 비어 있으면 에러를 내보낸다', () => {
    const processor = createCodeStreamProcessor('anthropic');
    processor.feed(sse({ type: 'message_stop' }));
    expect(processor.finish()).toEqual([
      { type: 'error', error: '생성된 코드가 비어 있습니다. 다시 시도해주세요.' },
    ]);
  });
});

describe('createCodeStreamProcessor (google)', () => {
  it('finishReason STOP 이후 finish하면 done을 내보낸다', () => {
    const processor = createCodeStreamProcessor('google');
    expect(processor.feed(googleChunk('const App = () => null;', 'STOP'))).toEqual([
      { type: 'delta', code: 'const App = () => null;' },
    ]);
    expect(processor.finish()).toEqual([
      { type: 'done', code: 'const App = () => null;\n\nrender(<App />);' },
    ]);
  });

  it('MAX_TOKENS는 잘림 에러를 내보낸다', () => {
    const processor = createCodeStreamProcessor('google');
    expect(processor.feed(googleChunk('const A', 'MAX_TOKENS'))).toEqual([
      { type: 'error', error: '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.' },
    ]);
  });

  it('에러 청크는 상태 코드를 매핑한 한국어 메시지로 내보낸다', () => {
    const processor = createCodeStreamProcessor('google');
    expect(processor.feed(sse({ error: { code: 429 } }))).toEqual([
      { type: 'error', error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    ]);
  });

  it('STOP 외의 비정상 finishReason은 에러를 내보낸다', () => {
    const processor = createCodeStreamProcessor('google');
    expect(processor.feed(googleChunk('', 'SAFETY'))).toEqual([
      { type: 'error', error: '생성이 중단되었습니다. 다른 요청으로 다시 시도해주세요.' },
    ]);
  });

  it('finishReason 없이 끝나면 에러를 내보낸다', () => {
    const processor = createCodeStreamProcessor('google');
    processor.feed(googleChunk('const A'));
    expect(processor.finish()).toEqual([
      { type: 'error', error: '응답이 중간에 끊겼습니다. 다시 시도해주세요.' },
    ]);
  });
});

const encoder = new TextEncoder();

function upstreamOf(chunks: Uint8Array[], onCancel?: () => void): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
    cancel() {
      onCancel?.();
    },
  });
}

async function readEvents(stream: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('createCodeEventStream', () => {
  it('upstream SSE를 delta와 done NDJSON 이벤트로 변환한다', async () => {
    const upstream = upstreamOf([
      encoder.encode(anthropicText('const App = () => null;')),
      encoder.encode(sse({ type: 'message_stop' })),
    ]);

    expect(await readEvents(createCodeEventStream(upstream, 'anthropic'))).toEqual([
      { type: 'delta', code: 'const App = () => null;' },
      { type: 'done', code: 'const App = () => null;\n\nrender(<App />);' },
    ]);
  });

  it('한글 멀티바이트 문자가 청크 경계에서 잘려도 깨지지 않는다', async () => {
    const bytes = encoder.encode(anthropicText('가'));
    const split = bytes.indexOf(0xea) + 1; // '가'(EA B0 80)의 첫 바이트 뒤에서 자른다
    const upstream = upstreamOf([
      bytes.slice(0, split),
      bytes.slice(split),
      encoder.encode(sse({ type: 'message_stop' })),
    ]);

    const events = (await readEvents(createCodeEventStream(upstream, 'anthropic'))) as Array<{
      type: string;
      code?: string;
    }>;

    expect(events[0]).toEqual({ type: 'delta', code: '가' });
  });

  it('upstream 읽기가 실패하면 내부 메시지를 숨긴 error 이벤트를 보낸다', async () => {
    const upstream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('socket hang up at 10.0.0.1');
      },
    });

    expect(await readEvents(createCodeEventStream(upstream, 'anthropic'))).toEqual([
      { type: 'error', error: '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
    ]);
  });

  it('클라이언트가 취소하면 upstream 읽기도 취소한다', async () => {
    const onCancel = vi.fn();
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(anthropicText('const')));
      },
      cancel: onCancel,
    });

    const reader = createCodeEventStream(upstream, 'anthropic').getReader();
    await reader.read();
    await reader.cancel();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('encodeLine', () => {
  it('JSON을 개행으로 끝내 한 줄로 직렬화한다', () => {
    expect(encodeLine({ type: 'delta', code: 'x' })).toBe('{"type":"delta","code":"x"}\n');
  });
});
