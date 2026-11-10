import { describe, it, expect } from 'vitest';
import { isGitCommit } from './is-git-commit';

describe('isGitCommit', () => {
  it('단순 git commit을 감지한다', () => {
    expect(isGitCommit('git commit -m "feat: 추가"')).toBe(true);
  });

  it('git -C <경로> commit처럼 옵션이 끼어도 감지한다', () => {
    expect(isGitCommit('git -C ../repo commit -m x')).toBe(true);
  });

  it('&&, ; 로 연결된 명령 뒤쪽의 git commit을 감지한다', () => {
    expect(isGitCommit('git add . && git commit -m x')).toBe(true);
    expect(isGitCommit('git add .; git commit -m x')).toBe(true);
  });

  it('git commit이 아닌 git 명령은 감지하지 않는다', () => {
    expect(isGitCommit('git status')).toBe(false);
    expect(isGitCommit('git log --grep commit')).toBe(false);
  });

  it('commit-tree 같은 다른 서브커맨드는 감지하지 않는다', () => {
    expect(isGitCommit('git commit-tree abc123')).toBe(false);
  });

  it('git과 무관한 명령은 감지하지 않는다', () => {
    expect(isGitCommit('bun run test')).toBe(false);
  });
});
