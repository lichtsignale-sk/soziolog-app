import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import type { VorschlagDTO } from '@soziolog/shared';
import { VorschlagFelder } from './components/VorschlagFelder';
import { AdminVerwaltungSeite } from './pages/AdminVerwaltungSeite';
import { ToastProvider } from '@soziolog/ui';

expect.extend(matchers);

const apiFetch = vi.fn();
vi.mock('./lib/api-client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class ApiError extends Error {},
}));

const vorschlag: VorschlagDTO = {
  id: 'v1',
  domaeneId: 'k1',
  titel: 'Neue Büroausstattung',
  inhalt: 'Anschaffung von 3 Schreibtischen.',
  governanceTyp: 'operativ',
  status: 'entschieden',
  datum: '2026-07-01',
  erfasstVonName: 'Anna Muster',
  bedenken: [{ id: 'b1', inhalt: 'Kostet zu viel.', datum: '2026-07-01' }],
  einwaende: [
    { id: 'e1', inhalt: 'Kein Öko-Konzept.', schweregrad: 'leicht', integration: null, datum: '2026-07-01' },
  ],
  beschluss: {
    id: 'be1',
    inhalt: 'Beschlossen.',
    notiz: null,
    befristung: 'unbefristet',
    ueberpruefungsdatum: null,
    gueltigkeitStatus: 'gueltig',
    gueltigAb: '2026-07-01',
    gueltigBis: null,
    datum: '2026-07-01',
    erfasstVonLabel: 'Logbuchführer Kernkreis',
    ersetztBeschlussId: null,
    ersetztDurch: null,
  },
  neufassungVon: null,
};

describe('Barrierefreiheit (axe)', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue([]);
  });

  it('VorschlagFelder hat keine axe-Violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <VorschlagFelder vorschlag={vorschlag} korrigierbar />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Verwaltung hat keine axe-Violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <AdminVerwaltungSeite />
        </ToastProvider>
      </MemoryRouter>,
    );
    // Auf das Ausbleiben des Spinners / Rendern der Tabelle warten.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Verwaltung' })).toBeInTheDocument(),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
