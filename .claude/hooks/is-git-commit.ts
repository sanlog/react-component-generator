const GIT_COMMIT = /\bgit\b(?:\s+-\S+(?:\s+(?!commit\b)[^\s-]\S*)?)*\s+commit(?![-\w])/;

export function isGitCommit(command: string): boolean {
  return GIT_COMMIT.test(command);
}
