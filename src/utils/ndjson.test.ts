import { describe, it, expect } from 'vitest';
import { createNDJSONParser } from './ndjson';

describe('createNDJSONParser', () => {
  it('완성된 줄을 JSON 객체로 파싱한다', () => {
    const parser = createNDJSONParser();
    expect(parser.feed('{"type":"delta","code":"a"}\n')).toEqual([{ type: 'delta', code: 'a' }]);
  });

  it('줄 중간에서 잘린 청크는 다음 청크와 합쳐 처리한다', () => {
    const parser = createNDJSONParser();
    expect(parser.feed('{"type":"del')).toEqual([]);
    expect(parser.feed('ta"}\n{"type":"done"}\n')).toEqual([{ type: 'delta' }, { type: 'done' }]);
  });

  it('빈 줄은 무시한다', () => {
    const parser = createNDJSONParser();
    expect(parser.feed('\n{"a":1}\n\n')).toEqual([{ a: 1 }]);
  });
});
