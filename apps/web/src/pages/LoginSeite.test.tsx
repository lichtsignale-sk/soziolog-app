import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginSeite } from './LoginSeite';

const login = vi.fn().mockResolvedValue({ zweiFaktorErforderlich: false });
const zweiFaktorLoginVerifizieren = vi.fn().mockResolvedValue(undefined);
const navigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login,
    zweiFaktorLoginVerifizieren,
    logout: vi.fn(),
    neuLaden: vi.fn(),
    person: null,
    laedt: false,
  }),
}));

vi.mock('react-router-dom', async (orig) => {
  const echt = await orig<typeof import('react-router-dom')>();
  return { ...echt, useNavigate: () => navigate };
});

function renderSeite() {
  return render(
    <MemoryRouter>
      <LoginSeite />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  login.mockClear();
  login.mockResolvedValue({ zweiFaktorErforderlich: false });
  zweiFaktorLoginVerifizieren.mockClear();
  navigate.mockClear();
});

describe('LoginSeite', () => {
  it('sendet die Anmeldedaten und navigiert bei Erfolg', async () => {
    renderSeite();

    fireEvent.change(screen.getByLabelText('Nutzername oder E-Mail'), {
      target: { value: 'admin@demo.test' },
    });
    fireEvent.change(screen.getByLabelText('Passwort'), {
      target: { value: 'demo1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('admin@demo.test', 'demo1234');
      expect(navigate).toHaveBeenCalledWith('/');
    });
  });

  it('zeigt Validierungsfehler bei leeren Feldern und sendet nicht', async () => {
    renderSeite();

    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(
      await screen.findByText('Bitte Nutzername oder E-Mail angeben.'),
    ).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('zeigt bei aktiver E-Mail-2FA den Code-Schritt und bestätigt den Code', async () => {
    login.mockResolvedValue({ zweiFaktorErforderlich: true });
    renderSeite();

    fireEvent.change(screen.getByLabelText('Nutzername oder E-Mail'), {
      target: { value: 'admin@demo.test' },
    });
    fireEvent.change(screen.getByLabelText('Passwort'), {
      target: { value: 'demo1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    // Statt Navigation erscheint der Code-Schritt.
    const codeFeld = await screen.findByLabelText('Bestätigungscode');
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.change(codeFeld, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));

    await waitFor(() => {
      expect(zweiFaktorLoginVerifizieren).toHaveBeenCalledWith('123456');
      expect(navigate).toHaveBeenCalledWith('/');
    });
  });
});
