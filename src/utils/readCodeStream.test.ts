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

  it('한글 멀티바이트 문자가 청크 경계에서 잘려도 깨지지 않는다', async () => {
    const bytes = new TextEncoder().encode('{"type":"done","code":"가나다"}\n');
    const split = bytes.indexOf(0xea) + 1; // '가'(EA B0 80)의 첫 바이트 뒤에서 자른다
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, split));
        controller.enqueue(bytes.slice(split));
        controller.close();
      },
    });

    expect(await readCodeStream(body, () => {})).toBe('가나다');
  });

  it('done을 받으면 남은 스트림 읽기를 취소한다', async () => {
    const onCancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"type":"done","code":"x"}\n'));
      },
      cancel: onCancel,
    });

    await readCodeStream(body, () => {});

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('error 이벤트로 중단될 때도 스트림 읽기를 취소한다', async () => {
    const onCancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"type":"error","error":"실패"}\n'));
      },
      cancel: onCancel,
    });

    await expect(readCodeStream(body, () => {})).rejects.toThrow('실패');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('done 없이 스트림이 끝나면 에러를 던진다', async () => {
    const body = streamOf('{"type":"delta","code":"x"}\n');
    await expect(readCodeStream(body, () => {})).rejects.toThrow('응답이 중간에 끊겼습니다');
  });
});
