import type { PropsWithChildren, ReactNode } from "react";

type Props = PropsWithChildren<{
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}>;

export function ShellCard({ title, subtitle, actions, children }: Props) {
  return (
    <section className="shell-card">
      <header className="shell-card__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
