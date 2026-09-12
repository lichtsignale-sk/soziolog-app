import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { VorschlagDTO } from '@soziolog/shared';
import { VorschlagFelder } from './VorschlagFelder';

/** VorschlagFelder nutzt useNavigate – daher immer in einem Router rendern. */
const renderMitRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

const apiFetch = vi.fn();
vi.mock('../lib/api-client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class ApiError extends Error {},
}));
// Nur useToast ersetzen, alle übrigen Bausteine aus @soziolog/ui bleiben echt.
vi.mock('@soziolog/ui', async (originalLaden) => ({
  ...(await originalLaden<typeof import('@soziolog/ui')>()),
  useToast: () => ({ zeige: vi.fn() }),
}));

const vorschlag: VorschlagDTO = {
  id: 'v1',
  domaeneId: 'k1',
  titel: 'Ursprungstitel',
  inhalt: 'Ursprungsinhalt',
  governanceTyp: 'operativ',
  status: 'offen',
  datum: '2026-07-01',
  erfasstVonName: 'Anna Muster',
  bedenken: [],
  einwaende: [],
  beschluss: null,
  neufassungVon: null,
};

beforeEach(() => apiFetch.mockReset());

describe('VorschlagFelder – Korrektur', () => {
  it('Protokollführer: Bearbeiten öffnet das Korrektur-Modal; Feld ändern → „Korrekturantrag stellen" ruft POST /api/korrekturen', async () => {
    apiFetch.mockResolvedValue({ id: 'k99' });
    renderMitRouter(<VorschlagFelder vorschlag={vorschlag} korrigierbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Vorschlag bearbeiten' }));

    const titel = screen.getByLabelText('Neuer Titel');
    fireEvent.change(titel, { target: { value: 'Korrigierter Titel' } });

    fireEvent.click(screen.getByRole('button', { name: 'Korrekturantrag stellen' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [pfad, opts] = apiFetch.mock.calls[0];
    expect(pfad).toBe('/api/korrekturen');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      zielTyp: 'vorschlag',
      zielId: 'v1',
      feld: 'titel',
      neuerInhalt: 'Korrigierter Titel',
    });
  });

  it('ohne Änderung ist „Korrekturantrag stellen" deaktiviert', () => {
    renderMitRouter(<VorschlagFelder vorschlag={vorschlag} korrigierbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschlag bearbeiten' }));
    expect(screen.getByRole('button', { name: 'Korrekturantrag stellen' })).toBeDisabled();
  });

  it('Bearbeiten-Icon bleibt sichtbar, solange kein Beschluss existiert (zusätzlich zu „Protokollieren")', () => {
    renderMitRouter(<VorschlagFelder vorschlag={vorschlag} korrigierbar />);
    expect(screen.getByRole('button', { name: 'Vorschlag bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Protokollieren' })).toBeInTheDocument();
  });

  it('Nicht-Protokollführer sieht keine Editier- oder Protokollieren-Affordance (rein lesend)', () => {
    renderMitRouter(<VorschlagFelder vorschlag={vorschlag} korrigierbar={false} />);
    expect(screen.queryByRole('button', { name: 'Vorschlag bearbeiten' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Protokollieren' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
