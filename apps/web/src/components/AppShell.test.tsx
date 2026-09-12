import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ToastProvider } from '@soziolog/ui';

const person = {
  istAdmin: false,
  name: 'Test Person',
  organisationName: 'Test-Organisation',
  domaenen: [],
};
const useAuthMock = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

// Die eingebettete Glocke und der Domänen-Baum rufen apiFetch; im Shell-Test nicht relevant.
const apiFetch = vi.fn((pfad: string) => {
  if (pfad === '/api/domaenen') return Promise.resolve([]);
  return Promise.resolve({ anzahl: 0 });
});
vi.mock('../lib/api-client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...(a as [string])),
  ApiError: class ApiError extends Error {},
}));

function rendere() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('AppShell', () => {
  it('blendet die Admin-Navigation für Nicht-Admins aus', () => {
    useAuthMock.mockReturnValue({ person, logout: vi.fn() });
    rendere();
    expect(screen.queryByText('Verwaltung')).not.toBeInTheDocument();
    // Regulärer Nav-Punkt ist da (Desktop + evtl. Drawer → mind. 1×).
    expect(screen.getAllByText('Domänen').length).toBeGreaterThan(0);
  });

  it('zeigt die Admin-Navigation für Admins und bietet einen Skip-Link', () => {
    useAuthMock.mockReturnValue({
      person: { ...person, istAdmin: true },
      logout: vi.fn(),
    });
    rendere();
    expect(screen.getAllByText('Verwaltung').length).toBeGreaterThan(0);
    expect(screen.getByText('Zum Hauptinhalt springen')).toBeInTheDocument();
  });
});
