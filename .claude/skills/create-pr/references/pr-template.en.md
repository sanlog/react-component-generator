# PR Body Template

Use this structure as-is. Replace the parenthesized guidance with real content. Write `N/A` for sections that do not apply.

```markdown
## Summary

(What this PR changes, in 1-3 sentences. Focus on what is different after the change.)

## Motivation

(Why it is needed: the problem solved, the requirement, related issues. Use `Closes #number` if an issue exists.)

## Key Changes

- (3-6 behavior-level changes the reviewer should know about. Do not list files.)

## Testing

- [ ] (Verification command run and its result. e.g. `bun run test` 22 passed)
- [ ] (Scenarios verified manually. Check only what was actually done.)

## Review Notes

(What the reviewer should look at closely, trade-offs, known limitations. `N/A` if none.)
```

## Writing guidelines

- Mark a checkbox `[x]` only if the check was actually performed. Otherwise leave it `[ ]` and add the reason.
- For UI changes, add a one-line description of the verified behavior under `Summary` or `Testing`. The user attaches screenshots.
- If there is a breaking change or migration, put it at the top of `Review Notes`.
