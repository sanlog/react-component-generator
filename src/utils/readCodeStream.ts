import { createNDJSONParser } from './ndjson';

type StreamEvent =
  | { type: 'delta'; code: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

/** 서버의 NDJSON 스트림을 읽으며 누적 코드를 onDelta로 알리고, 최종 코드를 반환한다. */
export async function readCodeStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (code: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createNDJSONParser();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      for (const event of parser.feed(decoder.decode(value, { stream: true })) as StreamEvent[]) {
        if (event.type === 'delta') onDelta(event.code);
        else if (event.type === 'done') return event.code;
        else throw new Error(event.error);
      }
    }

    throw new Error('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
  } finally {
    // 정상 종료, 에러, 중단 어느 경우에도 연결을 붙잡고 있지 않도록 읽기를 취소한다.
    reader.cancel().catch(() => {});
  }
}
