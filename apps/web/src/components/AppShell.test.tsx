import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { FEEDBACK_FRAGE } from './FeedbackModal';
import { ToastProvider } from '@soziolog/ui';

const person = {
  istAdmin: false,
  name: 'Test Person',
  loginEmail: 'test@example.test',
  organisationName: 'Test-Organisation',
  domaenen: [],
};
const useAuthMock = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

let feedbackAktiv = false;
let feedbackStatusScheitert = false;

// Die eingebettete Glocke und der Domänen-Baum rufen apiFetch; im Shell-Test nicht relevant.
const apiFetch = vi.fn((pfad: string) => {
  if (pfad === '/api/domaenen') return Promise.resolve([]);
  if (pfad === '/api/feedback/status') {
    return feedbackStatusScheitert
      ? Promise.reject(new Error('Server nicht erreichbar'))
      : Promise.resolve({ aktiv: feedbackAktiv, empfaengerName: 'das Testteam' });
  }
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
  beforeEach(() => {
    feedbackAktiv = false;
    feedbackStatusScheitert = false;
  });

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

  describe('Feedback', () => {
    it('zeigt den Punkt nicht, solange der Server ihn nicht freigibt', async () => {
      useAuthMock.mockReturnValue({ person, logout: vi.fn(), demoModus: false });
      rendere();
      // Warten, bis der Statusabruf durch ist.
      await screen.findAllByText('Domänen');
      await Promise.resolve();
      expect(screen.queryByRole('button', { name: /Feedback geben/ })).not.toBeInTheDocument();
    });

    it('lässt den Punkt still weg, wenn der Status nicht abrufbar ist', async () => {
      feedbackAktiv = true;
      feedbackStatusScheitert = true;
      useAuthMock.mockReturnValue({ person, logout: vi.fn(), demoModus: false });
      rendere();
      await screen.findAllByText('Domänen');
      await Promise.resolve();
      expect(screen.queryByRole('button', { name: /Feedback geben/ })).not.toBeInTheDocument();
      // Ohne Toast: Der Aufruf ist als stumm markiert.
      expect(apiFetch).toHaveBeenCalledWith('/api/feedback/status', { stumm: true });
    });

    it('öffnet den Dialog über der aktuellen Seite und nennt den Empfänger', async () => {
      feedbackAktiv = true;
      useAuthMock.mockReturnValue({ person, logout: vi.fn(), demoModus: false });
      rendere();
      const [knopf] = await screen.findAllByRole('button', { name: /Feedback geben/ });
      expect(knopf).toHaveAttribute('aria-haspopup', 'dialog');
      fireEvent.click(knopf);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: FEEDBACK_FRAGE })).toBeInTheDocument();
      expect(screen.getByText(/geht direkt an das Testteam\./)).toBeInTheDocument();
    });

    it('schließt auf dem Handy erst die Navigation und öffnet dann den Dialog', async () => {
      feedbackAktiv = true;
      useAuthMock.mockReturnValue({ person, logout: vi.fn(), demoModus: false });
      rendere();
      await screen.findAllByRole('button', { name: /Feedback geben/ });

      fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }));
      const imDrawer = screen.getAllByRole('button', { name: /Feedback geben/ });
      // Desktop-Seitenleiste + Drawer.
      expect(imDrawer).toHaveLength(2);
      fireEvent.click(imDrawer[1]);

      expect(
        screen.queryByRole('button', { name: 'Navigation schließen' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Nach dem Schließen steht der Fokus auf dem Menü-Knopf, nicht auf <body>.
      fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Navigation öffnen' })).toHaveFocus();
    });
  });
});
