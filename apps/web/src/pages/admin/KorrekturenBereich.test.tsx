import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { KorrekturantragDTO } from '@soziolog/shared';
import { KorrekturenBereich } from './KorrekturenBereich';

function rendere() {
  return render(
    <MemoryRouter>
      <KorrekturenBereich />
    </MemoryRouter>,
  );
}

const apiFetch = vi.fn();
vi.mock('../../lib/api-client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class ApiError extends Error {},
}));
// Nur useToast ersetzen, alle übrigen Bausteine aus @soziolog/ui bleiben echt.
vi.mock('@soziolog/ui', async (originalLaden) => ({
  ...(await originalLaden<typeof import('@soziolog/ui')>()),
  useToast: () => ({ zeige: vi.fn() }),
}));

const antrag: KorrekturantragDTO = {
  id: 'k1',
  zielTyp: 'vorschlag',
  feld: 'titel',
  alterInhalt: 'Alter Titel',
  neuerInhalt: 'Neuer Titel',
  begruendung: 'Tippfehler',
  beantragtVonName: 'Marek Kowalski',
  beantragtVonLabel: 'Logbuchführend · Kernkreis',
  beantragtAm: '2026-07-05',
  vorschlagId: 'v1',
  vorschlagTitel: 'Büroausstattung',
  domaeneName: 'Kernkreis',
};

let offeneAntraege: KorrekturantragDTO[] = [];

beforeEach(() => {
  apiFetch.mockReset();
  offeneAntraege = [antrag];
  apiFetch.mockImplementation((path: string, opts?: { method?: string }) => {
    if (path.startsWith('/api/korrekturen?status=offen')) {
      return Promise.resolve([...offeneAntraege]);
    }
    if (opts?.method === 'POST') {
      offeneAntraege = []; // nach Bestätigen ist die Queue leer
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve(null);
  });
});

describe('KorrekturenBereich', () => {
  it('zeigt offene Anträge mit alt→neu und Kontext', async () => {
    rendere();
    expect(await screen.findByText('Büroausstattung')).toBeInTheDocument();
    expect(screen.getByText('Alter Titel')).toBeInTheDocument();
    expect(screen.getByText('Neuer Titel')).toBeInTheDocument();
    expect(screen.getByText('Marek Kowalski')).toBeInTheDocument();
  });

  it('Bestätigen ruft POST /api/korrekturen/:id/bestaetigen und lädt neu', async () => {
    rendere();
    await screen.findByText('Büroausstattung');

    fireEvent.click(screen.getByText('Bestätigen'));

    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          (c) =>
            String(c[0]) === '/api/korrekturen/k1/bestaetigen' &&
            (c[1] as { method?: string })?.method === 'POST',
        ),
      ).toBe(true),
    );
    expect(await screen.findByText('Alle Anträge bearbeitet')).toBeInTheDocument();
  });

  it('Ablehnen öffnet den Dialog und sendet die Begründung als grund mit', async () => {
    rendere();
    await screen.findByText('Büroausstattung');

    // Öffnet den Ablehnen-Dialog.
    fireEvent.click(screen.getByText('Ablehnen'));
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Ändert die Aussage.' } });

    // Der Dialog-Button „Ablehnen" (zweiter im DOM) sendet den Request.
    const buttons = screen.getAllByRole('button', { name: 'Ablehnen' });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          (c) =>
            String(c[0]) === '/api/korrekturen/k1/ablehnen' &&
            (c[1] as { method?: string })?.method === 'POST' &&
            (c[1] as { body?: string })?.body ===
              JSON.stringify({ grund: 'Ändert die Aussage.' }),
        ),
      ).toBe(true),
    );
  });

  it('Ablehnen ohne Begründung lässt den Bestätigen-Button gesperrt', async () => {
    rendere();
    await screen.findByText('Büroausstattung');

    fireEvent.click(screen.getByText('Ablehnen'));
    await screen.findByRole('textbox');

    const buttons = screen.getAllByRole('button', { name: 'Ablehnen' });
    // Der Dialog-Bestätigen-Button ist ohne Begründung deaktiviert.
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });
});
