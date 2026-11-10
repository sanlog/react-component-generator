// PreToolUse(Edit|Write|MultiEdit) 훅: 코드 수정 직전에 TDD 규칙을 컨텍스트로 주입한다.
import { buildTddReminder } from './tdd-reminder';

const input = JSON.parse(await Bun.stdin.text());
const reminder = buildTddReminder(input?.tool_input?.file_path ?? '');

if (reminder) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: reminder },
    }),
  );
}
