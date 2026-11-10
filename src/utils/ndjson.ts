// 서버가 보내는 NDJSON 스트림을 청크 단위로 받아 완성된 줄만 JSON으로 파싱한다.
export function createNDJSONParser(): { feed: (chunk: string) => unknown[] } {
  let buffer = '';

  return {
    feed(chunk) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      return lines.filter((line) => line.trim()).map((line) => JSON.parse(line));
    },
  };
}
