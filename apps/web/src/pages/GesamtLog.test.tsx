import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@soziolog/ui';
import { giltAmStichtag, type GesamtLogDomaene, type VorschlagDTO } from '@soziolog/shared';
import { GesamtLog } from './GesamtLog';

// heute() deterministisch fixieren; Grenzlogik (giltAmStichtag) bleibt echt.
vi.mock('@soziolog/shared', async (orig) => {
  const echt = await orig<typeof import('@soziolog/shared')>();
  return { ...echt, heute: () => '2026-07-05' };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ person: { istAdmin: false, domaenen: [{ domaeneId: 'k1', name: 'Kernkreis', rollen: ['logbuchfuehrer'] }] } }),
}));

const apiFetch = vi.fn();
vi.mock('../lib/api-client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class ApiError extends Error {},
}));

const sGilt = {
  id: 'b-gilt',
  vorschlagId: 'v-gilt',
  titel: 'Unbefristet gueltig',
  vorschlagInhalt: 'Inhalt des Vorschlags',
  beschlussInhalt: 'Beschlusstext',
  gueltigAb: '2026-01-01',
  gueltigBis: null,
  gueltigkeitStatus: 'gueltig' as const,
  befristung: 'unbefristet' as const,
  ueberpruefungsdatum: null,
  ersetztBeschlussId: null,
};
const sAbgelaufen = {
  id: 'b-alt',
  vorschlagId: 'v-alt',
  titel: 'Abgelaufen',
  vorschlagInhalt: 'Inhalt des Vorschlags 2',
  beschlussInhalt: 'Beschlusstext 2',
  gueltigAb: '2026-01-01',
  gueltigBis: '2026-03-01',
  gueltigkeitStatus: 'ersetzt' as const,
  befristung: 'befristet' as const,
  ueberpruefungsdatum: null,
  ersetztBeschlussId: null,
};

const daten: GesamtLogDomaene[] = [
  {
    domaeneId: 'k1',
    domaeneName: 'Kernkreis',
    spannen: [sGilt, sAbgelaufen],
    offeneVorschlaege: [
      { id: 'v-offen', titel: 'Offen', vorschlagInhalt: 'Inhalt offen', datum: '2026-05-01' },
    ],
  },
  // Leere Domäne erzeugt einfach keine Zeilen (darf nicht zu Fehlern führen).
  { domaeneId: 'k2', domaeneName: 'Bau', spannen: [], offeneVorschlaege: [] },
];

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((path: string) => {
    if (path.startsWith('/api/gesamt-log')) return Promise.resolve(daten);
    return Promise.resolve(null);
  });
});

function rendere() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <GesamtLog />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('GesamtLog', () => {
  it('rendert eine Zeile je Vorschlag; leere Domäne erzeugt keine Zeile', async () => {
    rendere();
    expect(await screen.findByText('Unbefristet gueltig')).toBeInTheDocument();
    expect(screen.getByTestId('balken-b-gilt')).toBeInTheDocument();
    expect(screen.getByTestId('balken-b-alt')).toBeInTheDocument();
    expect(screen.getByTestId('punkt-v-offen')).toBeInTheDocument();
    // Domäne als Link je Zeile; die leere Domäne „Bau" taucht nicht auf.
    expect(screen.getAllByRole('link', { name: 'Kernkreis' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Bau')).not.toBeInTheDocument();
  });

  it('Stichtag-Hervorhebung deckt sich exakt mit der shared-Engine', async () => {
    rendere();
    await screen.findByText('Unbefristet gueltig');

    const stichtag = '2026-06-01';
    fireEvent.change(screen.getByLabelText('Stand zum Stichtag'), {
      target: { value: stichtag },
    });

    await waitFor(() => {
      const gilt = screen.getByTestId('balken-b-gilt');
      const alt = screen.getByTestId('balken-b-alt');

      expect(giltAmStichtag(sGilt.gueltigAb, sGilt.gueltigBis, stichtag)).toBe(true);
      expect(giltAmStichtag(sAbgelaufen.gueltigAb, sAbgelaufen.gueltigBis, stichtag)).toBe(false);

      expect(gilt.getAttribute('data-gilt')).toBe('true');
      expect(alt.getAttribute('data-gilt')).toBe('false');
      expect(gilt.className).toContain('ring-2');
    });
  });

  it('Klick auf einen Balken öffnet das Vorschlag-Detail-Modal', async () => {
    const vorschlag: VorschlagDTO = {
      id: 'v-gilt',
      domaeneId: 'k1',
      titel: 'Unbefristet gueltig',
      inhalt: 'Inhalt des Vorschlags',
      governanceTyp: 'operativ',
      status: 'entschieden',
      datum: '2026-01-01',
      erfasstVonName: 'Test Person',
      bedenken: [],
      einwaende: [],
      beschluss: null,
      neufassungVon: null,
    };
    apiFetch.mockImplementation((path: string) => {
      if (path.startsWith('/api/gesamt-log')) return Promise.resolve(daten);
      if (path === '/api/vorschlaege/v-gilt') return Promise.resolve(vorschlag);
      return Promise.resolve(null);
    });

    rendere();
    await screen.findByText('Unbefristet gueltig');
    fireEvent.click(screen.getByTestId('balken-b-gilt'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/vorschlaege/v-gilt');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('Liste: Klick auf einen Titel öffnet das Modal, Klick auf Domäne navigiert', async () => {
    const vorschlag: VorschlagDTO = {
      id: 'v-gilt',
      domaeneId: 'k1',
      titel: 'Unbefristet gueltig',
      inhalt: 'Inhalt des Vorschlags',
      governanceTyp: 'operativ',
      status: 'entschieden',
      datum: '2026-01-01',
      erfasstVonName: 'Test Person',
      bedenken: [],
      einwaende: [],
      beschluss: null,
      neufassungVon: null,
    };
    apiFetch.mockImplementation((path: string) => {
      if (path.startsWith('/api/gesamt-log')) return Promise.resolve(daten);
      if (path === '/api/vorschlaege/v-gilt') return Promise.resolve(vorschlag);
      return Promise.resolve(null);
    });

    rendere();
    await screen.findByText('Unbefristet gueltig');
    fireEvent.click(screen.getByRole('button', { name: 'Liste' }));

    fireEvent.click(screen.getByRole('button', { name: 'Unbefristet gueltig' }));
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/vorschlaege/v-gilt');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const domaenenLink = screen.getAllByRole('link', { name: 'Kernkreis' })[0];
    expect(domaenenLink).toHaveAttribute('href', '/domaenen/k1');
  });

  it('Freitextsuche filtert auch über Beschlusstext', async () => {
    rendere();
    await screen.findByText('Unbefristet gueltig');

    fireEvent.change(screen.getByPlaceholderText('Alle Vorschläge durchsuchen…'), {
      target: { value: 'Beschlusstext 2' },
    });

    await waitFor(() => {
      expect(screen.queryByTestId('balken-b-gilt')).not.toBeInTheDocument();
      expect(screen.getByTestId('balken-b-alt')).toBeInTheDocument();
    });
  });
});
