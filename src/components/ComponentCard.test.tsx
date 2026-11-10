import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentCard } from './ComponentCard';
import type { GeneratedComponent } from '../types';

vi.mock('./LivePreview', () => ({
  LivePreview: ({ code }: { code: string }) => <div data-testid="live-preview">{code}</div>,
}));

const component: GeneratedComponent = {
  id: '1',
  prompt: '버튼',
  code: 'const A = () => null;',
  createdAt: new Date('2026-01-01T00:00:00'),
};

const renderCard = (isStreaming?: boolean) => (
  <ComponentCard
    component={component}
    onRemove={() => {}}
    onRegenerate={() => {}}
    isLoading={false}
    isStreaming={isStreaming}
  />
);

describe('ComponentCard 탭 전환', () => {
  it('스트리밍이 아니면 미리보기 탭으로 시작한다', () => {
    render(renderCard());
    expect(screen.getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true');
  });

  it('스트리밍 중에는 코드 탭으로 시작해 생성 중인 코드를 보여준다', () => {
    render(renderCard(true));
    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('live-preview')).toBeNull();
  });

  it('스트리밍 중 코드가 갱신되어도 코드 탭을 유지하고 부분 코드를 표시한다', () => {
    const { rerender } = render(renderCard(true));
    rerender(
      <ComponentCard
        component={{ ...component, code: 'const Partial = 1;' }}
        onRemove={() => {}}
        onRegenerate={() => {}}
        isLoading={true}
        isStreaming={true}
      />,
    );
    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('const Partial = 1;')).toBeInTheDocument();
  });

  it('스트리밍이 끝나면 미리보기 탭으로 전환한다', () => {
    const { rerender } = render(renderCard(true));
    rerender(renderCard(false));
    expect(screen.getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('live-preview')).toBeInTheDocument();
  });
});
