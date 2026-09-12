import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AdminPersonDTO } from '@soziolog/shared';
import { PersonenBereich } from './PersonenBereich';

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

const person: AdminPersonDTO = {
  id: 'p1',
  name: 'Alice Admin',
  nutzername: 'alice',
  loginEmail: 'alice@demo.test',
  avatarColor: null,
  avatarTextColor: null,
  istAdmin: false,
  aktiv: true,
  status: 'aktiv',
  berechtigung: 'Protokollierend',
  benachrichtigungenAktiv: true,
  angelegtAm: '2026-07-01',
  domaenen: [{ domaeneId: 'k1', name: 'Kernkreis', rollen: ['logbuchfuehrer'] }],
};

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((path: string, opts?: { method?: string }) => {
    if (path === '/api/admin/personen' && (!opts || !opts.method)) {
      return Promise.resolve([person]);
    }
    return Promise.resolve({ mailVersendet: true, ok: true });
  });
});

describe('PersonenBereich', () => {
  it('zeigt die Personenliste mit E-Mail, Berechtigung und Status', async () => {
    render(<PersonenBereich />);
    expect(await screen.findByText('Alice Admin')).toBeInTheDocument();
    expect(screen.getByText('alice@demo.test')).toBeInTheDocument();
    expect(screen.getByText('Protokollierend')).toBeInTheDocument();
    // „Aktiv" erscheint als Status-Zelle und als Filter-Reiter.
    expect(screen.getAllByText('Aktiv').length).toBeGreaterThan(0);
  });

  it('Person einladen sendet POST mit den Formulardaten', async () => {
    render(<PersonenBereich />);
    await screen.findByText('Alice Admin');

    fireEvent.click(screen.getByText('Person einladen'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bob Neu' } });
    fireEvent.change(screen.getByLabelText('Nutzername'), { target: { value: 'bob' } });
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'bob@demo.test' } });
    fireEvent.click(screen.getByText('Anlegen & einladen'));

    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          (c) =>
            String(c[0]) === '/api/admin/personen' &&
            (c[1] as { method?: string })?.method === 'POST',
        ),
      ).toBe(true),
    );
    const call = apiFetch.mock.calls.find(
      (c) => String(c[0]) === '/api/admin/personen' && (c[1] as { method?: string })?.method === 'POST',
    )!;
    const body = JSON.parse((call[1] as { body: string }).body);
    expect(body).toMatchObject({ name: 'Bob Neu', nutzername: 'bob', loginEmail: 'bob@demo.test' });
  });

  it('Deaktivieren erfordert eine Bestätigung im Dialog, kein direkter PATCH beim ersten Klick', async () => {
    render(<PersonenBereich />);
    await screen.findByText('Alice Admin');

    fireEvent.click(screen.getByRole('button', { name: /Alice Admin deaktivieren/i }));
    // Noch kein PATCH gesendet — erst nach der expliziten Bestätigung.
    expect(
      apiFetch.mock.calls.some((c) => (c[1] as { method?: string })?.method === 'PATCH'),
    ).toBe(false);
    expect(screen.getByText('Person deaktivieren?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));

    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          (c) =>
            String(c[0]) === '/api/admin/personen/p1' &&
            (c[1] as { method?: string })?.method === 'PATCH',
        ),
      ).toBe(true),
    );
  });
});
