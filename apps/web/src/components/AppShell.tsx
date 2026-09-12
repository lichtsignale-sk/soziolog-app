import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Folder,
  GanttChart,
  BarChart3,
  History,
  UserCircle,
  ShieldCheck,
  ChevronRight,
  Menu,
  X,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import type { DomaeneKnotenDTO } from '@soziolog/shared';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api-client';
import { Benachrichtigungszentrum } from './Benachrichtigungszentrum';

const SIDEBAR_DOMAENEN_KEY = 'soziolog:sidebar:domaenen-offen';

interface NavZiel {
  pfad: string;
  label: string;
  Icon: LucideIcon;
  nurAdmin?: boolean;
}

/** Obere Nav-Gruppe, ohne „Domänen" (die hat ihren eigenen aufklappbaren Eintrag). */
const NAV_OBEN: NavZiel[] = [
  { pfad: '/gesamt-log', label: 'Gesamt-Log', Icon: GanttChart },
  { pfad: '/korrekturen-log', label: 'Korrekturen-Log', Icon: History },
  { pfad: '/statistik', label: 'Statistik', Icon: BarChart3 },
];

/** Untere Nav-Gruppe, unten in der Sidebar mit Abstand von der Hauptnavigation getrennt. */
const NAV_UNTEN: NavZiel[] = [
  { pfad: '/konto', label: 'Mein Konto', Icon: UserCircle },
  { pfad: '/admin', label: 'Verwaltung', Icon: ShieldCheck, nurAdmin: true },
];

/** Aktives Item ist hellgrün hinterlegt (brand-soft), inaktive dezent. */
const NAV_LINK_KLASSE = (isActive: boolean) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-base font-medium ${
    isActive
      ? 'bg-primaer-soft text-primaer-softtext'
      : 'text-text hover:bg-flaeche-3'
  }`;

interface DomaeneBaumKnoten extends DomaeneKnotenDTO {
  kinder: DomaeneBaumKnoten[];
}

/** Baut aus der flachen Domänenliste eine Eltern-Kind-Baumstruktur (rekursiv). */
function baueDomaeneBaum(domaenen: DomaeneKnotenDTO[]): DomaeneBaumKnoten[] {
  const byId = new Map<string, DomaeneBaumKnoten>(
    domaenen.map((k) => [k.id, { ...k, kinder: [] }]),
  );
  const wurzeln: DomaeneBaumKnoten[] = [];
  for (const k of byId.values()) {
    const eltern = k.elternDomaeneId ? byId.get(k.elternDomaeneId) : undefined;
    if (eltern) eltern.kinder.push(k);
    else wurzeln.push(k);
  }
  return wurzeln;
}

/**
 * Ein Domäne-Knoten in der Sidebar-Baumliste: links Caret (Eltern, klappt die
 * Kinder auf/zu) oder Punkt-Marker (Blatt), rechts der Beschluss-Zähler.
 */
function DomaeneNavKnoten({
  knoten,
  onNavigieren,
}: {
  knoten: DomaeneBaumKnoten;
  onNavigieren?: () => void;
}) {
  const hatKinder = knoten.kinder.length > 0;
  const [offen, setOffen] = useState(true);
  return (
    <li>
      <div className="flex items-center gap-1">
        {hatKinder ? (
          <button
            type="button"
            onClick={() => setOffen((v) => !v)}
            aria-expanded={offen}
            aria-label={offen ? `${knoten.name} einklappen` : `${knoten.name} ausklappen`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-leise hover:bg-flaeche-3 hover:text-text"
          >
            <ChevronRight
              className={`h-4 w-4 transition-transform duration-150 ${offen ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
          </button>
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-leise/50" />
          </span>
        )}
        <NavLink
          to={`/domaenen/${knoten.id}`}
          onClick={onNavigieren}
          className={({ isActive }) =>
            `flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-base ${
              isActive
                ? 'bg-primaer-soft font-medium text-primaer-softtext'
                : 'text-leise hover:bg-flaeche-3 hover:text-text'
            }`
          }
        >
          <span className="truncate">{knoten.name}</span>
          <span className="ziffern-tabellarisch shrink-0 text-sm text-leise">
            {knoten.anzahlBeschluesse}
          </span>
        </NavLink>
      </div>
      {hatKinder && offen && (
        <ul className="ml-6 mt-0.5 space-y-0.5">
          {knoten.kinder.map((kind) => (
            <DomaeneNavKnoten key={kind.id} knoten={kind} onNavigieren={onNavigieren} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** „Domänen"-Eintrag mit Toggle-Pfeil; ausgeklappt zeigt er alle (aktiven) Domänen als Baum. */
function DomaenenNavEintrag({
  domaenen,
  onNavigieren,
}: {
  domaenen: DomaeneKnotenDTO[] | null;
  onNavigieren?: () => void;
}) {
  const [offen, setOffen] = useState(
    () => localStorage.getItem(SIDEBAR_DOMAENEN_KEY) === 'true',
  );
  // Archivierte Domänen erscheinen nicht in der Navigation.
  const baum = useMemo(
    () => (domaenen ? baueDomaeneBaum(domaenen.filter((d) => !d.archiviert)) : []),
    [domaenen],
  );

  function toggle() {
    setOffen((v) => {
      const neu = !v;
      localStorage.setItem(SIDEBAR_DOMAENEN_KEY, String(neu));
      return neu;
    });
  }

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <NavLink
          to="/"
          end
          onClick={onNavigieren}
          className={({ isActive }) => `flex-1 ${NAV_LINK_KLASSE(isActive)}`}
        >
          <Folder className="h-5 w-5 shrink-0" aria-hidden="true" />
          Domänen
        </NavLink>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={offen}
          aria-label={offen ? 'Domänenliste einklappen' : 'Domänenliste ausklappen'}
          className="rounded-lg p-2 text-leise hover:bg-flaeche-3 hover:text-text"
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform duration-150 ${offen ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
      {offen && baum.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {baum.map((k) => (
            <DomaeneNavKnoten key={k.id} knoten={k} onNavigieren={onNavigieren} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NavListeOben({
  domaenen,
  onNavigieren,
}: {
  domaenen: DomaeneKnotenDTO[] | null;
  onNavigieren?: () => void;
}) {
  return (
    <nav aria-label="Hauptnavigation" className="flex flex-col gap-1">
      <DomaenenNavEintrag domaenen={domaenen} onNavigieren={onNavigieren} />
      {NAV_OBEN.map((z) => (
        <NavLink
          key={z.pfad}
          to={z.pfad}
          onClick={onNavigieren}
          className={({ isActive }) => NAV_LINK_KLASSE(isActive)}
        >
          {({ isActive }) => (
            <>
              <z.Icon
                className="h-5 w-5 shrink-0"
                aria-hidden="true"
                aria-current={isActive ? 'page' : undefined}
              />
              {z.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function NavListeUnten({
  istAdmin,
  onNavigieren,
}: {
  istAdmin: boolean;
  onNavigieren?: () => void;
}) {
  return (
    <nav aria-label="Konto und Verwaltung" className="flex flex-col gap-1">
      {NAV_UNTEN.filter((z) => !z.nurAdmin || istAdmin).map((z) => (
        <NavLink
          key={z.pfad}
          to={z.pfad}
          onClick={onNavigieren}
          className={({ isActive }) => NAV_LINK_KLASSE(isActive)}
        >
          {({ isActive }) => (
            <>
              <z.Icon
                className="h-5 w-5 shrink-0"
                aria-hidden="true"
                aria-current={isActive ? 'page' : undefined}
              />
              {z.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const { person, logout } = useAuth();
  const [drawerOffen, setDrawerOffen] = useState(false);
  const [domaenen, setDomaenen] = useState<DomaeneKnotenDTO[] | null>(null);

  // Mobile-Navigation per Escape schließbar (Tastaturbedienung).
  useEffect(() => {
    if (!drawerOffen) return;
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOffen(false);
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [drawerOffen]);

  // Domänen einmalig für den Domänen-Baum in der Sidebar laden.
  useEffect(() => {
    apiFetch<DomaeneKnotenDTO[]>('/api/domaenen')
      .then(setDomaenen)
      .catch(() => setDomaenen([]));
  }, []);

  if (!person) return null;

  return (
    <div className="min-h-dvh bg-flaeche-2">
      <a
        href="#hauptinhalt"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-primaer focus:px-3 focus:py-2 focus:text-primaer-text"
      >
        Zum Hauptinhalt springen
      </a>

      {/* Durchgehende Kopfleiste ganz oben: links Wortmarke (Serif) + Organisation,
          rechts Glocke + Abmelden. */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-rahmen bg-flaeche px-4">
        <div className="flex items-center gap-2">
          <button
            className="grid h-10 w-10 place-items-center rounded-lg text-text hover:bg-flaeche-3 lg:hidden"
            aria-label="Navigation öffnen"
            aria-expanded={drawerOffen}
            onClick={() => setDrawerOffen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="leading-tight">
            <div className="font-serif text-2xl font-bold text-primaer">SozioLog</div>
            <div className="text-sm text-leise">{person.organisationName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Benachrichtigungszentrum />
          <button
            onClick={() => void logout()}
            aria-label="Abmelden"
            title="Abmelden"
            className="grid h-10 w-10 place-items-center rounded-lg border border-rahmen text-leise transition-colors duration-150 hover:bg-flaeche-3 hover:text-text"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Unter dem Header: Sidebar (links) + Main (rechts, mit klarem Abstand). */}
      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[268px] shrink-0 flex-col border-r border-rahmen bg-flaeche lg:flex">
          <div className="flex-1 overflow-y-auto p-4">
            <NavListeOben domaenen={domaenen} />
          </div>
          <div className="border-t border-rahmen p-4">
            <NavListeUnten istAdmin={person.istAdmin} />
          </div>
        </aside>

        <main
          id="hauptinhalt"
          className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-7"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile-Drawer */}
      {drawerOffen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOffen(false)}>
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <aside
            className="absolute inset-y-0 left-0 flex w-[268px] flex-col border-r border-rahmen bg-flaeche"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 pb-2">
              <span className="px-1 font-serif text-2xl font-bold text-primaer">SozioLog</span>
              <button
                aria-label="Navigation schließen"
                onClick={() => setDrawerOffen(false)}
                className="rounded-lg p-1 text-text hover:bg-flaeche-3"
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pt-2">
              <NavListeOben domaenen={domaenen} onNavigieren={() => setDrawerOffen(false)} />
            </div>
            <div className="border-t border-rahmen p-4">
              <NavListeUnten
                istAdmin={person.istAdmin}
                onNavigieren={() => setDrawerOffen(false)}
              />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
