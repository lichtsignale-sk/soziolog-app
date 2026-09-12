import type { ReactNode } from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';

/** Einheitlicher Leerzustand: Icon + Titel + Hinweis + optionale Aktion. */
export function LeerZustand({
  titel,
  hinweis,
  Icon = Inbox,
  aktion,
}: {
  titel: string;
  hinweis?: string;
  Icon?: LucideIcon;
  aktion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-primaer-soft text-primaer">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="font-serif text-lg font-semibold text-text">{titel}</p>
      {hinweis && <p className="mt-1 max-w-sm text-sm text-leise">{hinweis}</p>}
      {aktion && <div className="mt-4">{aktion}</div>}
    </div>
  );
}
