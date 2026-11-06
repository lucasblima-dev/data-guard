import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <p className="data text-2xs uppercase tracking-wider text-accent-ink">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tighter">{title}</h1>
        <p className="max-w-lg text-sm text-fg-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
