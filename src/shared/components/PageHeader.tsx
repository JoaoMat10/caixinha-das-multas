import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description: ReactNode;
  eyebrow?: ReactNode;
  titleId?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  titleId,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
      <h1 className="page-title" id={titleId}>
        {title}
      </h1>
      <p className="page-description">{description}</p>
    </header>
  );
}
