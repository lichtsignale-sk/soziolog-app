import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DomaeneKnotenDTO } from '@soziolog/shared';
import { DomaenenKarte } from './DomaenenKarte';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const echt = await orig<typeof import('react-router-dom')>();
  return { ...echt, useNavigate: () => navigate };
});

const apiFetch = vi.fn();
vi.mock('../lib/api-client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class ApiError extends Error {},
}));

const domaenen: DomaeneKnotenDTO[] = [
  { id: 'k1', name: 'Kernkreis', ziel: 'Z', tasks: ['D'], typ: 'dauerdomaene', elternDomaeneId: null, aktiv: true, archiviert: false, anzahlBeschluesse: 1, anzahlOffeneEinwaende: 0 },
  { id: 'k2', name: 'Finanzen', ziel: 'Z', tasks: ['D'], typ: 'dauerdomaene', elternDomaeneId: 'k1', aktiv: true, archiviert: false, anzahlBeschluesse: 0, anzahlOffeneEinwaende: 2 },
];

beforeEach(() => {
  navigate.mockClear();
  apiFetch.mockReset();
  apiFetch.mockResolvedValue(domaenen);
});

describe('DomaenenKarte', () => {
  it('rendert die Hierarchie (Eltern- und Tochter-Domäne) und navigiert bei Klick', async () => {
    render(
      <MemoryRouter>
        <DomaenenKarte />
      </MemoryRouter>,
    );

    // Beide Domänen erscheinen (Hierarchie aufgebaut) – hier über die barrierefreie Liste.
    const kernBtn = await screen.findByRole('button', { name: /Kernkreis/ });
    const finBtn = screen.getByRole('button', { name: /Finanzen/ });
    expect(kernBtn).toBeInTheDocument();
    expect(finBtn).toBeInTheDocument();

    fireEvent.click(finBtn);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/domaenen/k2'));
  });
});
