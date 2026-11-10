import { useId } from 'react';
import type { ReactNode } from 'react';

interface WindowProps {
  title: ReactNode;
  /** 타이틀바 오른쪽에 붙는 보조 정보 */
  meta?: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
  children: ReactNode;
}

export function Window({ title, meta, as: Heading = 'h2', className = '', children }: WindowProps) {
  const titleId = useId();

  return (
    <section className={`win ${className}`.trim()} aria-labelledby={titleId}>
      <div className="win-title">
        <Heading id={titleId} className="win-title-text">
          {title}
        </Heading>
        {meta && <span className="win-title-meta">{meta}</span>}
      </div>
      <div className="win-body">{children}</div>
    </section>
  );
}
