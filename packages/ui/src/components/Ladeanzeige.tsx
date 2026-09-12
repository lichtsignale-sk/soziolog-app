import { Loader2 } from 'lucide-react';

/** Spinner mit zugänglichem Statustext. */
export function Spinner({ text = 'Lädt …' }: { text?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-8 text-sm text-leise"
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

/** Skeleton-Platzhalter für ladende Inhalte (reduziert Layout-Sprünge). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-flaeche-3 ${className ?? ''}`}
      aria-hidden="true"
    />
  );
}
