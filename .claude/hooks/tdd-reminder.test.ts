import { describe, it, expect } from 'vitest';
import { buildTddReminder } from './tdd-reminder';

describe('buildTddReminder', () => {
  it('프로덕션 코드 파일에는 TDD 리마인더를 반환한다', () => {
    const reminder = buildTddReminder('server/generator.ts');

    expect(reminder).toContain('RED');
    expect(reminder).toContain('.claude/rules/tdd.md');
  });

  it('Windows 경로 구분자(백슬래시)도 프로덕션 코드로 인식한다', () => {
    expect(buildTddReminder('C:\\proj\\src\\App.tsx')).not.toBeNull();
  });

  it('Windows 경로의 타입 정의 파일도 리마인더를 주지 않는다', () => {
    expect(buildTddReminder('C:\\proj\\src\\types\\api.ts')).toBeNull();
  });

  it('테스트 파일에는 리마인더를 주지 않는다', () => {
    expect(buildTddReminder('server/generator.test.ts')).toBeNull();
    expect(buildTddReminder('src/App.spec.tsx')).toBeNull();
  });

  it('코드가 아닌 파일(md, json)에는 리마인더를 주지 않는다', () => {
    expect(buildTddReminder('AGENTS.md')).toBeNull();
    expect(buildTddReminder('.claude/settings.json')).toBeNull();
  });

  it('설정 파일에는 리마인더를 주지 않는다', () => {
    expect(buildTddReminder('vite.config.ts')).toBeNull();
    expect(buildTddReminder('eslint.config.js')).toBeNull();
  });

  it('타입 정의 파일에는 리마인더를 주지 않는다', () => {
    expect(buildTddReminder('src/types/api.ts')).toBeNull();
    expect(buildTddReminder('src/env.d.ts')).toBeNull();
  });
});
