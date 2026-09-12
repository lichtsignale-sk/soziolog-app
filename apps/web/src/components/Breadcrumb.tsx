import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbGlied {
  label: string;
  /** Ziel-Route; fehlt sie, ist das Glied das aktuelle (nicht verlinkt). */
  zu?: string;
}

/**
 * Brotkrumen-Navigation („Domänen / Eltern / Name"). Das letzte Glied ist das
 * aktuelle und wird nicht verlinkt; Zwischenglieder sind Links.
 */
export function Breadcrumb({ glieder }: { glieder: BreadcrumbGlied[] }) {
  return (
    <nav aria-label="Brotkrumen" className="mb-2 flex items-center gap-1 text-sm text-leise">
      {glieder.map((g, i) => {
        const letztes = i === glieder.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && (
              <ChevronRight className="h-4 w-4 shrink-0 text-leise/70" aria-hidden="true" />
            )}
            {g.zu && !letztes ? (
              <Link to={g.zu} className="hover:text-text hover:underline">
                {g.label}
              </Link>
            ) : (
              <span className={letztes ? 'font-medium text-text' : undefined} aria-current={letztes ? 'page' : undefined}>
                {g.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
