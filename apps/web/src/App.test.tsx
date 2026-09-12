import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

// Echtes fetch mocken: deckt sowohl holeCsrf() als auch apiFetch() ab und
// hält ApiError/instanceof intakt (Modul wird nicht ersetzt).
function mockFetch(ich: { status: number; body: unknown }) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/auth/csrf')) {
      return new Response(JSON.stringify({ csrfToken: 'test-token' }), {
        status: 200,
      });
    }
    if (url.includes('/api/setup/status')) {
      return new Response(JSON.stringify({ benoetigtSetup: false }), {
        status: 200,
      });
    }
    return new Response(JSON.stringify(ich.body), { status: ich.status });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('leitet nicht angemeldete Nutzer (401) auf die Login-Seite', async () => {
    mockFetch({
      status: 401,
      body: { fehler: { code: 'HTTP_401', nachricht: 'Nicht angemeldet.' } },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Passwort vergessen?')).toBeInTheDocument();
    });
  });
});
