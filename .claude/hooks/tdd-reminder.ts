const CODE_FILE = /\.(ts|tsx|js|jsx)$/;
const EXEMPT = /(\.(test|spec)\.|\.config\.|\.d\.ts$|\/types\/)/;

const REMINDER = `[TDD 리마인더] .claude/rules/tdd.md (Rigid, 예외 없음)
- 프로덕션 코드보다 테스트를 먼저 쓴다. 하나의 동작 = 하나의 테스트.
- RED: 테스트를 실제로 실행해 "기능 미구현"으로 실패하는 것을 확인한다. import 실패나 오타는 RED가 아니다.
- GREEN: 테스트를 통과시키는 최소한의 코드만 쓴다 (YAGNI). 신규/기존 테스트 전체 통과를 실행해 확인한다.
- REFACTOR: 새 동작 없이 정리만 하고 green을 유지한다.
- 이 수정 전에 실패하는 테스트를 먼저 실행해 보았는가? 아니라면 지금 수정을 멈추고 테스트부터 작성한다.
- 테스트보다 먼저 쓴 프로덕션 코드는 삭제하고 RED부터 다시 시작한다. "나중에 테스트 추가", "너무 단순함"은 변명이다.`;

export function buildTddReminder(filePath: string): string | null {
  const path = filePath.replaceAll('\\', '/');
  if (!CODE_FILE.test(path) || EXEMPT.test(path)) return null;
  return REMINDER;
}
