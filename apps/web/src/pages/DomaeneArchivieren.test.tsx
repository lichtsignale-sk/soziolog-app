import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { ArchivierenVorschau } from '@soziolog/shared';
import { DomaeneArchivierenDialog } from './DomaeneArchivieren';

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

const vorschau: ArchivierenVorschau = {
  domaeneId: 'k1',
  domaeneName: 'Bau',
  hatEintraege: false,
  hatAktiveUnterDomaenen: false,
  verwaisende: [{ personId: 'p1', name: 'Alice', rollenImDomaene: ['moderation'] }],
  zielDomaenen: [{ id: 'k2', name: 'Kernkreis' }],
};

const onSchliessen = vi.fn();
const onArchiviert = vi.fn();

beforeEach(() => {
  apiFetch.mockReset();
  onSchliessen.mockReset();
  onArchiviert.mockReset();
  apiFetch.mockImplementation((path: string) => {
    if (path.endsWith('/archivieren-vorschau')) return Promise.resolve(vorschau);
    return Promise.resolve({ ok: true });
  });
});

function rendere() {
  render(
    <DomaeneArchivierenDialog
      domaeneId="k1"
      domaeneName="Bau"
      onSchliessen={onSchliessen}
      onArchiviert={onArchiviert}
    />,
  );
}

describe('DomaeneArchivierenDialog', () => {
  it('Archivieren bleibt gesperrt bis die verwaisende Person entschieden ist, dann POST', async () => {
    rendere();

    // Vorschau wird beim Öffnen automatisch geladen; verwaisende Person erscheint.
    const zeile = await screen.findByTestId('verwaist-p1');
    const archivierenBtn = screen.getByRole('button', { name: 'Archivieren' });
    expect(archivierenBtn).toBeDisabled();

    // Entscheidung: behalten (erstes Radio) + Ziel-Domäne (Select in der Personenzeile).
    fireEvent.click(within(zeile).getAllByRole('radio')[0]);
    fireEvent.change(within(zeile).getByRole('combobox'), { target: { value: 'k2' } });

    await waitFor(() => expect(archivierenBtn).not.toBeDisabled());
    fireEvent.click(archivierenBtn);

    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          (c) =>
            String(c[0]) === '/api/admin/domaenen/k1/archivieren' &&
            (c[1] as { method?: string })?.method === 'POST',
        ),
      ).toBe(true),
    );
    const call = apiFetch.mock.calls.find((c) => String(c[0]).endsWith('/archivieren'))!;
    const body = JSON.parse((call[1] as { body: string }).body);
    expect(body.entscheidungen).toEqual([
      { personId: 'p1', aktion: 'behalten_in_domaene', zielDomaeneId: 'k2' },
    ]);
    expect(onArchiviert).toHaveBeenCalled();
  });
});
