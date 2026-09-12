import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminVerwaltungSeite } from './AdminVerwaltungSeite';

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

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue([]);
});

describe('AdminVerwaltungSeite', () => {
  it('zeigt die drei Reiter Domänen, Personen, Korrekturanträge', async () => {
    render(
      <MemoryRouter>
        <AdminVerwaltungSeite />
      </MemoryRouter>,
    );
    expect(screen.getByRole('tab', { name: 'Domänen' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Personen' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Korrekturanträge' })).toBeInTheDocument();
    // Erster Reiter ist aktiv -> "Neue Domäne" (aus DomaenenBereich) sichtbar.
    expect(await screen.findByText('Neue Domäne')).toBeInTheDocument();
  });
});
