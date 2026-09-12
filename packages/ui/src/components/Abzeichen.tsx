import type { ReactNode } from 'react';

/** Generische, kleine Statuspille. */
export function Abzeichen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className ?? ''}`}
    >
      {children}
    </span>
  );
}
