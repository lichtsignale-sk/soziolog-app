import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@soziolog/ui';
import type { AenderungslogEintragDTO, VorschlagDTO } from '@soziolog/shared';
import { KorrekturenLogSeite } from './KorrekturenLogSeite';

/** Detail-Modal (VorschlagFelder) nutzt useNavigate – daher im Router rendern. */
const rendereSeite = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <KorrekturenLogSeite />
      </ToastProvider>
    </MemoryRouter>,
  );

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ person: { istAdmin: false, domaenen: [{ domaeneId: 'k1', name: 'Kernkreis', rollen: ['logbuchfuehrer'] }] } }),
}));

const apiFetch = vi.fn();
vi.mock('../lib/api-client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class ApiError extends Error {},
}));

const eintrag: AenderungslogEintragDTO = {
  id: 'k1',
  zielTyp: 'vorschlag',
  feld: 'titel',
  alterInhalt: 'Alter Titel',
  neuerInhalt: 'Neuer Titel',
  beantragtVonName: 'Marek Kowalski',
  beantragtVonLabel: 'Logbuchführend · Kernkreis',
  bestaetigtVonName: 'Admin Demo',
  beantragtAm: '2026-07-04',
  entschiedenAm: '2026-07-05',
  vorschlagId: 'v1',
  vorschlagTitel: 'Büroausstattung',
  domaeneName: 'Kernkreis',
  status: 'bestaetigt',
  ablehnungsgrund: null,
  benachrichtigungId: null,
};

const abgelehnt: AenderungslogEintragDTO = {
  ...eintrag,
  id: 'k2',
  vorschlagId: 'v2',
  vorschlagTitel: 'Newsletter-Frequenz',
  neuerInhalt: 'Monatlich',
  entschiedenAm: '2026-07-03',
  status: 'abgelehnt',
  ablehnungsgrund: 'Ändert die inhaltliche Aussage.',
};

/** Beantwortet die beiden aenderungslog-Aufrufe je nach ?status. */
function mockLog(bestaetigt: AenderungslogEintragDTO[], abgelehntListe: AenderungslogEintragDTO[]) {
  apiFetch.mockImplementation((path: string) => {
    if (path === '/api/aenderungslog') return Promise.resolve(bestaetigt);
    if (String(path).startsWith('/api/aenderungslog?status=abgelehnt')) return Promise.resolve(abgelehntListe);
    return Promise.resolve(null);
  });
}

beforeEach(() => apiFetch.mockReset());

describe('KorrekturenLogSeite', () => {
  it('zeigt bestätigte Korrekturen mit Antragsteller- und Admin-Namen', async () => {
    mockLog([eintrag], []);
    rendereSeite();

    expect(await screen.findByText('Büroausstattung')).toBeInTheDocument();
    expect(screen.getByText('Marek Kowalski')).toBeInTheDocument();
    expect(screen.getByText(/Admin Demo/)).toBeInTheDocument();
    expect(screen.getByText('Neuer Titel')).toBeInTheDocument();
  });

  it('zeigt abgelehnte Korrekturen mit Begründung und „wird nicht übernommen"', async () => {
    mockLog([], [abgelehnt]);
    rendereSeite();

    expect(await screen.findByText('Newsletter-Frequenz')).toBeInTheDocument();
    expect(screen.getByText('Abgelehnt')).toBeInTheDocument();
    expect(screen.getByText(/wird nicht übernommen/)).toBeInTheDocument();
    expect(screen.getByText(/Ändert die inhaltliche Aussage/)).toBeInTheDocument();
  });

  it('zeigt Leerzustand ohne Einträge', async () => {
    mockLog([], []);
    rendereSeite();
    expect(await screen.findByText('Noch keine Korrekturen')).toBeInTheDocument();
  });

  it('Klick auf einen Eintrag öffnet das Vorschlag-Detail-Modal', async () => {
    const vorschlag: VorschlagDTO = {
      id: 'v1',
      domaeneId: 'k1',
      titel: 'Büroausstattung',
      inhalt: 'Inhalt des Vorschlags',
      governanceTyp: 'operativ',
      status: 'entschieden',
      datum: '2026-07-01',
      erfasstVonName: 'Admin Demo',
      bedenken: [],
      einwaende: [],
      beschluss: null,
      neufassungVon: null,
    };
    apiFetch.mockImplementation((path: string) => {
      if (path === '/api/aenderungslog') return Promise.resolve([eintrag]);
      if (String(path).startsWith('/api/aenderungslog?status=abgelehnt')) return Promise.resolve([]);
      if (path === '/api/vorschlaege/v1') return Promise.resolve(vorschlag);
      return Promise.resolve(null);
    });

    rendereSeite();
    fireEvent.click(await screen.findByRole('button', { name: /Büroausstattung/ }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/vorschlaege/v1');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
