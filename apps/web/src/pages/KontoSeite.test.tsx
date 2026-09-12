import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AktuellePersonDTO } from '@soziolog/shared';
import { KontoSeite } from './KontoSeite';

const person: AktuellePersonDTO = {
  id: 'p1',
  name: 'Admin Demo',
  displayName: 'Admin D.',
  nutzername: 'admin.demo',
  loginEmail: 'admin@demo.test',
  istAdmin: true,
  benachrichtigungenAktiv: true,
  avatarUrl: null,
  avatarColor: null,
  avatarTextColor: null,
  zweiFaktorAktiv: false,
  angelegtAm: '2024-01-14',
  passwortGeaendertAm: null,
  organisationName: 'Demo-Organisation',
  domaenen: [
    { domaeneId: 'k1', name: 'Kernkreis', rollen: ['logbuchfuehrer'] },
  ],
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    person,
    login: vi.fn(),
    logout: vi.fn(),
    neuLaden: vi.fn(),
    laedt: false,
  }),
}));

const apiFetch = vi.fn().mockResolvedValue(undefined);
vi.mock('../lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}));
// Nur useToast ersetzen, alle übrigen Bausteine aus @soziolog/ui bleiben echt.
vi.mock('@soziolog/ui', async (originalLaden) => ({
  ...(await originalLaden<typeof import('@soziolog/ui')>()),
  useToast: () => ({ zeige: vi.fn() }),
}));

function renderSeite() {
  return render(
    <MemoryRouter>
      <KontoSeite />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetch.mockClear();
});

describe('KontoSeite – Benachrichtigungs-Schalter', () => {
  it('zeigt beim Ausschalten einen Bestätigungsdialog und speichert nicht sofort', () => {
    renderSeite();

    // Schalter ist an (person.benachrichtigungenAktiv = true) → Klick = ausschalten
    fireEvent.click(
      screen.getByRole('switch', { name: /E-Mail-Benachrichtigungen/ }),
    );

    // Dialog mit exaktem Warnhinweis erscheint
    expect(
      screen.getByText('Benachrichtigungen ausschalten?'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/erscheinen auch fällige Überprüfungen/),
    ).toBeInTheDocument();

    // Noch KEIN Speichern erfolgt (erst nach Bestätigung)
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('speichert erst nach Bestätigung im Dialog', async () => {
    renderSeite();

    fireEvent.click(
      screen.getByRole('switch', { name: /E-Mail-Benachrichtigungen/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ausschalten' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/konto',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });
});
