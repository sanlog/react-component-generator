import { describe, it, expect } from 'vitest';
import {
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

describe('encodeLine', () => {
  it('JSON을 개행으로 끝내 한 줄로 직렬화한다', () => {
    expect(encodeLine({ type: 'delta', code: 'x' })).toBe('{"type":"delta","code":"x"}\n');
  });
});
