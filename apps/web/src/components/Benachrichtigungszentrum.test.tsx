import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { BenachrichtigungDTO } from '@soziolog/shared';
import { Benachrichtigungszentrum } from './Benachrichtigungszentrum';

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

const benachrichtigung: BenachrichtigungDTO = {
  id: 'n1',
  typ: 'ueberpruefung_faellig',
  inhalt: 'Überprüfung fällig: Kaffeekasse',
  domaeneId: 'k1',
  domaeneName: 'Kernkreis',
  faelligAm: '2026-07-05',
  erstelltAm: '2026-07-05',
  gelesen: false,
  gelesenAm: null,
  betrifftBeschlussId: 'b1',
  vorschlagId: 'v1',
  betrifftKorrekturId: null,
  korrekturZielTyp: null,
};

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((path: string) => {
    if (path.includes('anzahl-ungelesen')) return Promise.resolve({ anzahl: 2 });
    if (path === '/api/benachrichtigungen') return Promise.resolve([benachrichtigung]);
    return Promise.resolve({ ok: true });
  });
});

function rendere() {
  render(
    <MemoryRouter>
      <Benachrichtigungszentrum />
    </MemoryRouter>,
  );
}

describe('Benachrichtigungszentrum', () => {
  it('zeigt den Ungelesen-Zähler und öffnet die Liste', async () => {
    rendere();
    expect(await screen.findByTestId('ungelesen-zaehler')).toHaveTextContent('2');

    fireEvent.click(screen.getByRole('button', { name: /Benachrichtigungen/ }));

    expect(await screen.findByText('Überprüfung fällig: Kaffeekasse')).toBeInTheDocument();
  });

  it('Klick auf einen Eintrag markiert ihn als gelesen', async () => {
    rendere();
    fireEvent.click(await screen.findByRole('button', { name: /Benachrichtigungen/ }));

    fireEvent.click(await screen.findByRole('button', { name: /Überprüfung fällig/ }));

    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          (c) =>
            String(c[0]) === '/api/benachrichtigungen/n1/gelesen' &&
            (c[1] as { method?: string })?.method === 'POST',
        ),
      ).toBe(true),
    );
  });
});
