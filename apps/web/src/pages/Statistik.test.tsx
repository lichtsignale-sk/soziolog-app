import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Statistik } from './Statistik';

// recharts nutzt ResizeObserver – in jsdom nicht vorhanden.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const apiFetch = vi.fn();
vi.mock('../lib/api-client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class ApiError extends Error {},
}));

const nutzer = [
  { domaeneId: 'k1', domaeneName: 'Kernkreis', anzahl: 3 },
  { domaeneId: 'k2', domaeneName: 'Bau', anzahl: 0 },
];
const einwB = [
  { domaeneId: 'k1', domaeneName: 'Kernkreis', bedenken: 1, einwaendeLeicht: 1, einwaendeSchwer: 0 },
  { domaeneId: 'k2', domaeneName: 'Bau', bedenken: 0, einwaendeLeicht: 0, einwaendeSchwer: 0 },
];
const entsch = [
  { domaeneId: 'k1', domaeneName: 'Kernkreis', beschluesse: 1 },
  { domaeneId: 'k2', domaeneName: 'Bau', beschluesse: 0 },
];
const monat = [{ monat: '2026-07', anzahl: 1 }];

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((path: string) => {
    if (path.includes('nutzer-pro-domaene')) return Promise.resolve(nutzer);
    if (path.includes('domaene-einwaende-bedenken')) return Promise.resolve(einwB);
    if (path.includes('domaene-entscheidungen')) return Promise.resolve(entsch);
    if (path.includes('bedenken-pro-monat')) return Promise.resolve(monat);
    return Promise.resolve(null);
  });
});

function rendere() {
  render(
    <MemoryRouter>
      <Statistik />
    </MemoryRouter>,
  );
}

describe('Statistik', () => {
  it('zeigt die vier Auswertungen mit korrekten Zahlen in den Begleit-Tabellen', async () => {
    rendere();
    // Überschriften der vier Diagramme (Rolle heading, nicht die sr-only Caption).
    expect(
      await screen.findByRole('heading', { name: 'Nutzer je Domäne' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bedenken je Monat' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Bedenken & Einwände je Domäne' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Entscheidungen je Domäne' }),
    ).toBeInTheDocument();

    // Monats-Kurzlabel unter der Säule (2026-07 → „Jul").
    expect(screen.getByText('Jul')).toBeInTheDocument();
    // Kernkreis erscheint als Balken-Label in mehreren Kacheln.
    expect(screen.getAllByText('Kernkreis').length).toBeGreaterThan(0);
  });

  it('filtert Bedenken je Monat nach Domäne (Endpunkt mit domaeneId)', async () => {
    rendere();
    await screen.findByRole('heading', { name: 'Bedenken je Monat' });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'k1' } });

    await waitFor(() => {
      expect(
        apiFetch.mock.calls.some((c) => String(c[0]).includes('bedenken-pro-monat?domaeneId=k1')),
      ).toBe(true);
    });
  });
});
