import { describe, it, expect, vi } from 'vitest';
import { readCodeStream } from './readCodeStream';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

describe('readCodeStream', () => {
  it('delta마다 onDelta를 호출하고 done의 최종 코드를 반환한다', async () => {
    const onDelta = vi.fn();
    const body = streamOf(
      '{"type":"delta","code":"const"}\n{"type":"delta","code":"const A"}\n',
      '{"type":"done","code":"const A = 1;\\nrender(<A />);"}\n',
    );

    const code = await readCodeStream(body, onDelta);

    expect(onDelta.mock.calls).toEqual([['const'], ['const A']]);
    expect(code).toBe('const A = 1;\nrender(<A />);');
  });

  it('error 이벤트는 서버 메시지 그대로 던진다', async () => {
    const body = streamOf('{"type":"error","error":"생성된 코드가 너무 길어 잘렸습니다."}\n');
    await expect(readCodeStream(body, () => {})).rejects.toThrow('생성된 코드가 너무 길어 잘렸습니다.');
  });

  it('done 없이 스트림이 끝나면 에러를 던진다', async () => {
    const body = streamOf('{"type":"delta","code":"x"}\n');
    await expect(readCodeStream(body, () => {})).rejects.toThrow('응답이 중간에 끊겼습니다');
  });
});
