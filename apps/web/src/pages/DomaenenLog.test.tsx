import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@soziolog/ui';
import type { DomaeneDetailDTO, DomaeneMitgliedNameDTO, VorschlagDTO } from '@soziolog/shared';
import { DomaenenLog } from './DomaenenLog';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ person: { istAdmin: false, domaenen: [{ domaeneId: 'k1', name: 'Kernkreis', rollen: [] }] } }),
}));
vi.mock('react-router-dom', async (orig) => {
  const echt = await orig<typeof import('react-router-dom')>();
  return { ...echt, useParams: () => ({ domaeneId: 'k1' }) };
});

const apiFetch = vi.fn();
vi.mock('../lib/api-client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class ApiError extends Error {},
}));

const domaene: DomaeneDetailDTO = {
  id: 'k1', name: 'Kernkreis', ziel: 'Koordination', tasks: ['Gesamt'], typ: 'dauerdomaene',
  elternDomaeneId: null, elternDomaeneName: null, aktiv: true, archiviert: false, anzahlBeschluesse: 0, anzahlOffeneEinwaende: 0,
};

const mitglieder: DomaeneMitgliedNameDTO[] = [
  { id: 'p1', name: 'Anna Muster', avatarColor: null, avatarTextColor: null },
  { id: 'p2', name: 'Ben Beispiel', avatarColor: null, avatarTextColor: null },
];

function beschluss(id: string, inhalt: string) {
  return { id, inhalt, notiz: null, befristung: 'unbefristet' as const, ueberpruefungsdatum: null, gueltigkeitStatus: 'gueltig' as const, gueltigAb: '2026-07-01', gueltigBis: null, datum: '2026-07-01', erfasstVonLabel: 'Logbuchführer Kernkreis', ersetztBeschlussId: null, ersetztDurch: null };
}
const vOffen: VorschlagDTO = {
  id: 'v1', domaeneId: 'k1', titel: 'Offener Vorschlag', inhalt: 'Ein Vorschlag zur Büroausstattung.', governanceTyp: 'operativ', status: 'offen',
  datum: '2026-07-01', erfasstVonName: 'Logbuchführer Kernkreis',
  bedenken: [{ id: 'bd1', inhalt: 'Sorge', datum: '2026-07-01' }], einwaende: [], beschluss: null, neufassungVon: null,
};
const vEntschieden: VorschlagDTO = {
  id: 'v2', domaeneId: 'k1', titel: 'Beschlossene Sache', inhalt: 'x', governanceTyp: 'operativ', status: 'entschieden',
  datum: '2026-07-01', erfasstVonName: 'Logbuchführer Kernkreis', bedenken: [], einwaende: [],
  beschluss: beschluss('b2', 'Wortlaut des Beschlusses'), neufassungVon: null,
};

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((path: string) => {
    if (path === '/api/domaenen/k1') return Promise.resolve(domaene);
    if (path.endsWith('/vorschlaege')) return Promise.resolve([vOffen, vEntschieden]);
    if (path.endsWith('/mitglieder')) return Promise.resolve(mitglieder);
    return Promise.resolve(null);
  });
});

function rendere() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <DomaenenLog />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('DomaenenLog', () => {
  it('zeigt Kopfbereich, Teilhabende und Vorschläge mit Status-Badge', async () => {
    rendere();
    expect(await screen.findByText('Offener Vorschlag')).toBeInTheDocument();
    expect(screen.getByText('Beschlossene Sache')).toBeInTheDocument();
    expect(screen.getByText('Anna Muster')).toBeInTheDocument();
    expect(screen.getByText('Ben Beispiel')).toBeInTheDocument();
    // Kein „Vorschlag"-Badge mehr, Status-Badge bleibt (Text erscheint auch im
    // Filter-Button, daher getAllByText statt getByText).
    expect(screen.queryByText('Vorschlag')).not.toBeInTheDocument();
    expect(screen.getAllByText('Offen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Entschieden').length).toBeGreaterThan(0);
  });

  it('Freitextsuche filtert nach Titel und Beschlusstext', async () => {
    rendere();
    await screen.findByText('Offener Vorschlag');

    fireEvent.change(
      screen.getByPlaceholderText('Vorschläge, Inhalte und Beschlüsse durchsuchen…'),
      { target: { value: 'Wortlaut' } },
    );

    expect(screen.queryByText('Offener Vorschlag')).not.toBeInTheDocument();
    expect(screen.getByText('Beschlossene Sache')).toBeInTheDocument();
  });

  it('Status-Filter zeigt nur den gewählten Status', async () => {
    rendere();
    await screen.findByText('Offener Vorschlag');

    fireEvent.click(screen.getByRole('button', { name: 'Entschieden' }));

    expect(screen.queryByText('Offener Vorschlag')).not.toBeInTheDocument();
    expect(screen.getByText('Beschlossene Sache')).toBeInTheDocument();
  });

  it('Klick auf die Vorschlagskarte öffnet das Detail-Modal', async () => {
    rendere();
    await screen.findByText('Offener Vorschlag');

    // Die ganze Karte ist klickbar (role="button"); Klick auf den Titel genügt.
    fireEvent.click(screen.getByText('Offener Vorschlag'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
