import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { DomaeneKnotenDTO, AdminPersonDTO, DomaeneMitgliederDTO } from '@soziolog/shared';
import { DomaenenBereich } from './DomaenenBereich';

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

const domaene: DomaeneKnotenDTO = {
  id: 'k1',
  name: 'Kernkreis',
  ziel: 'Z',
  tasks: ['D'],
  typ: 'dauerdomaene',
  elternDomaeneId: null,
  aktiv: true,
  archiviert: false,
  anzahlBeschluesse: 0,
  anzahlOffeneEinwaende: 0,
};

const personen: AdminPersonDTO[] = [
  {
    id: 'p1',
    name: 'Alice',
    nutzername: 'alice',
    loginEmail: 'a@x',
    avatarColor: null,
    avatarTextColor: null,
    istAdmin: false,
    aktiv: true,
    status: 'aktiv',
    berechtigung: 'Teilhabend',
    benachrichtigungenAktiv: true,
    angelegtAm: '2026-07-01',
    domaenen: [],
  },
  {
    id: 'p2',
    name: 'Bob',
    nutzername: 'bob',
    loginEmail: 'b@x',
    avatarColor: null,
    avatarTextColor: null,
    istAdmin: false,
    aktiv: true,
    status: 'aktiv',
    berechtigung: 'Teilhabend',
    benachrichtigungenAktiv: true,
    angelegtAm: '2026-07-01',
    domaenen: [],
  },
];

const mitgliederDetail: DomaeneMitgliederDTO = {
  domaeneId: 'k1',
  domaeneName: 'Kernkreis',
  mitglieder: [
    { mitgliedschaftId: 'm1', personId: 'p1', name: 'Alice', nutzername: 'alice', gueltigAb: '2026-07-01', rollen: [] },
  ],
};

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((path: string, opts?: { method?: string }) => {
    if (path === '/api/domaenen') return Promise.resolve([domaene]);
    if (path === '/api/admin/personen') return Promise.resolve(personen);
    if (path === '/api/admin/domaenen/k1/mitglieder') return Promise.resolve(mitgliederDetail);
    if (path === '/api/admin/domaenen/k1/archivieren-vorschau') {
      return Promise.resolve({ domaeneId: 'k1', domaeneName: 'Kernkreis', hatEintraege: false, hatAktiveUnterDomaenen: false, verwaisende: [], zielDomaenen: [] });
    }
    if (opts?.method) return Promise.resolve({ ok: true });
    return Promise.resolve(null);
  });
});

describe('DomaenenBereich', () => {
  it('zeigt die Domänenliste als hierarchische Zeilen', async () => {
    render(<DomaenenBereich />);
    expect(await screen.findByText('Kernkreis')).toBeInTheDocument();
    expect(screen.getByText(/Dauerdomäne/)).toBeInTheDocument();
    // Zeilen-Aktionen als Icon-Buttons.
    expect(screen.getByRole('button', { name: 'Mitglieder von Kernkreis' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kernkreis archivieren' })).toBeInTheDocument();
  });

  it('Archivieren-Icon lädt die Archivieren-Vorschau', async () => {
    render(<DomaenenBereich />);
    await screen.findByText('Kernkreis');
    fireEvent.click(screen.getByRole('button', { name: 'Kernkreis archivieren' }));
    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          (c) => String(c[0]) === '/api/admin/domaenen/k1/archivieren-vorschau',
        ),
      ).toBe(true),
    );
  });

  it('zeigt einen Regel-a-Hinweis, solange die Startbesetzung unvollständig ist', async () => {
    render(<DomaenenBereich />);
    await screen.findAllByText('Kernkreis');

    fireEvent.click(screen.getByText('Neue Domäne'));
    expect(
      await screen.findByText(/Mindestens 3 verschiedene Personen nötig/),
    ).toBeInTheDocument();

    // Eine Person in der ersten Zeile setzen -> weiterhin < 3 Personen.
    // selects[0] ist der Typ-Select (dauerdomaene/arbeitsdomaene), selects[1] die
    // erste Personen-Zeile der Startbesetzung.
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'p1' } });
    expect(
      await screen.findByText(/Mindestens 3 verschiedene Personen nötig \(aktuell 1\)/),
    ).toBeInTheDocument();
  });

  it('Mitglied hinzufügen im Verwalten-Dialog ruft den korrekten Endpunkt', async () => {
    render(<DomaenenBereich />);
    await screen.findAllByText('Kernkreis');

    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder von Kernkreis' }));
    await screen.findByText('Mitglieder & Rollen');

    const selects = screen.getAllByRole('combobox');
    const zielSelect = selects.find((s) =>
      Array.from((s as HTMLSelectElement).options).some((o) => o.textContent === 'Bob'),
    )!;
    fireEvent.change(zielSelect, { target: { value: 'p2' } });
    fireEvent.click(screen.getByText('Mitglied hinzufügen'));

    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          (c) =>
            String(c[0]) === '/api/admin/domaenen/k1/mitglieder' &&
            (c[1] as { method?: string })?.method === 'POST',
        ),
      ).toBe(true),
    );
  });
});
