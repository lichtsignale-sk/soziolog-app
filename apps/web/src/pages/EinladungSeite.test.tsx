import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EinladungSeite } from './EinladungSeite';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const echt = await orig<typeof import('react-router-dom')>();
  return { ...echt, useNavigate: () => navigate, useParams: () => ({ token: 'tok' }) };
});

const apiFetch = vi.fn();
vi.mock('../lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  ApiError: class ApiError extends Error {},
}));

beforeEach(() => {
  navigate.mockClear();
  apiFetch.mockReset();
  apiFetch.mockImplementation((_path: string, opts?: { method?: string }) =>
    opts?.method === 'POST'
      ? Promise.resolve({ ok: true })
      : Promise.resolve({ name: 'Neu Person', loginEmail: 'neu@demo.test' }),
  );
});

describe('EinladungSeite', () => {
  it('zeigt den Namen und aktiviert das Konto', async () => {
    render(
      <MemoryRouter>
        <EinladungSeite />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Willkommen, Neu Person')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Passwort'), {
      target: { value: 'sicher123' },
    });
    fireEvent.change(screen.getByLabelText('Passwort wiederholen'), {
      target: { value: 'sicher123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Konto aktivieren' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/einladung/tok/aktivieren',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(navigate).toHaveBeenCalledWith('/login');
    });
  });
});
