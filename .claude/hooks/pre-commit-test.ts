// PreToolUse(Bash) 훅: git commit 직전에 테스트를 돌리고 실패하면 커밋을 막는다.
import { spawnSync } from 'node:child_process';
import { isGitCommit } from './is-git-commit';

const input = JSON.parse(await Bun.stdin.text());
const command: string = input?.tool_input?.command ?? '';

if (!isGitCommit(command)) process.exit(0);

const result = spawnSync('bun', ['run', 'test'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (result.status === 0) process.exit(0);

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.split('\n').slice(-40).join('\n');
console.error(`테스트가 실패해 커밋을 차단했습니다. 모두 통과시킨 뒤 다시 커밋하세요.\n\n${output}`);
process.exit(2);
