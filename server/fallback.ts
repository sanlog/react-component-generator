// 모델 목록을 순서대로 시도하고, 실패하면 다음 모델로 폴백한다.
// 첫 성공 결과를 반환하고, 모두 실패하면 마지막 에러를 던진다.
export async function withModelFallback<T>(
  models: string[],
  attempt: (model: string) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (models.length === 0) {
    throw new Error('시도할 모델이 없습니다.');
  }

  let lastError: unknown;
  for (const model of models) {
    try {
      return await attempt(model);
    } catch (err) {
      lastError = err;
      // 클라이언트가 떠났다면 다음 모델을 호출해 토큰을 쓰지 않는다.
      if (signal?.aborted) break;
    }
  }
  throw lastError;
}
