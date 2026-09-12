import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SetupWizard } from './SetupWizard';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ setupErledigt: vi.fn() }),
}));

const apiFetch = vi.fn();
vi.mock('../lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  ApiError: class ApiError extends Error {},
}));

/** Antwortet auf den Status-Abruf; alle anderen Aufrufe liefern ein Standard-Setup-Ergebnis. */
function mockApi(smtpVorhanden: boolean) {
  apiFetch.mockImplementation(async (path: string) => {
    if (path === '/api/setup/status') return { benoetigtSetup: true, smtpVorhanden };
    return { versandFehler: [] };
  });
}

describe('SetupWizard', () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it('zeigt den SMTP-Schritt und blockt bei fehlenden Pflichtfeldern (kein Env-SMTP)', async () => {
    mockApi(false);
    render(
      <MemoryRouter>
        <SetupWizard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Schritt 1 von 5: SMTP')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    // Validierungsfehler erscheint, es wird NICHT zu Schritt 2 gewechselt.
    expect(await screen.findByText('SMTP-Host erforderlich.')).toBeInTheDocument();
    expect(screen.getByText('Schritt 1 von 5: SMTP')).toBeInTheDocument();
  });

  it('überspringt den SMTP-Schritt, wenn der Server bereits SMTP hat', async () => {
    mockApi(true);
    render(
      <MemoryRouter>
        <SetupWizard />
      </MemoryRouter>,
    );

    // Erster Schritt ist Organisation, nur noch 4 Schritte, kein SMTP.
    expect(await screen.findByText('Schritt 1 von 4: Organisation')).toBeInTheDocument();
    expect(screen.queryByText(/von 5: SMTP/)).not.toBeInTheDocument();
  });
});
