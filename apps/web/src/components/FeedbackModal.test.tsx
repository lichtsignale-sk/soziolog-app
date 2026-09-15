import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { FEEDBACK_DANK, FEEDBACK_FRAGE, FeedbackModal } from './FeedbackModal';

expect.extend(matchers);

const { ApiErrorAttrappe } = vi.hoisted(() => ({
  ApiErrorAttrappe: class extends Error {
    constructor(
      public readonly fehler: { code: string; nachricht: string },
      public readonly status: number,
    ) {
      super(fehler.nachricht);
    }
  },
}));

const useAuthMock = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => useAuthMock() }));

const apiFetch = vi.fn();
vi.mock('../lib/api-client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: ApiErrorAttrappe,
}));

const PERSON = { name: 'Alex Beispiel', loginEmail: 'alex@example.test' };

function rendere({ demo = false, pfad = '/gesamt-log' } = {}) {
  useAuthMock.mockReturnValue({ person: PERSON, demoModus: demo });
  const onSchliessen = vi.fn();
  const onNichtVerfuegbar = vi.fn();
  const baum = (offen: boolean) => (
    <MemoryRouter initialEntries={[pfad]}>
      <FeedbackModal
        offen={offen}
        onSchliessen={onSchliessen}
        onNichtVerfuegbar={onNichtVerfuegbar}
      />
    </MemoryRouter>
  );
  const r = render(baum(true));
  return {
    ...r,
    onSchliessen,
    onNichtVerfuegbar,
    oeffneNeu: () => {
      r.rerender(baum(false));
      r.rerender(baum(true));
    },
  };
}

const feld = () => screen.getByLabelText('Dein Feedback') as HTMLTextAreaElement;
const sendeKnopf = () => screen.getByRole('button', { name: 'Feedback senden' });
/** Nur über den sichtbaren Text eindeutig — das X trägt „Schließen" als aria-label. */
const fussSchliessen = () => screen.getByText('Schließen', { selector: 'button' });

describe('FeedbackModal', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(undefined);
  });

  it('stellt die Frage und sendet erst mit Text', () => {
    rendere();
    expect(screen.getByRole('heading', { name: FEEDBACK_FRAGE })).toBeInTheDocument();
    // Ohne Angabe vom Server: neutral, ohne Produkt- oder Firmennamen.
    expect(
      screen.getByText(/geht direkt an das Team, das diese Instanz betreut\./),
    ).toBeInTheDocument();
    expect(sendeKnopf()).toBeDisabled();
    fireEvent.change(feld(), { target: { value: '   ' } });
    expect(sendeKnopf()).toBeDisabled();
    fireEvent.change(feld(), { target: { value: 'Etwas fehlt.' } });
    expect(sendeKnopf()).toBeEnabled();
  });

  it('schickt Text und Seite und bedankt sich im selben Dialog', async () => {
    rendere({ pfad: '/domaenen/k1' });
    fireEvent.change(feld(), { target: { value: '  Der Knopf fehlt.  ' } });
    fireEvent.click(sendeKnopf());

    await screen.findByText(FEEDBACK_DANK);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(FEEDBACK_DANK);
    // Der Knopf in der Fußleiste (das X oben heißt ebenfalls „Schließen").
    expect(fussSchliessen()).toHaveFocus();

    const [pfad, optionen] = apiFetch.mock.calls[0] as [
      string,
      { method: string; body: string; stumm: boolean },
    ];
    expect(pfad).toBe('/api/feedback');
    expect(optionen.method).toBe('POST');
    // Fehler zeigt der Dialog selbst — kein zweiter Toast.
    expect(optionen.stumm).toBe(true);
    expect(JSON.parse(optionen.body)).toEqual({
      text: 'Der Knopf fehlt.',
      seite: '/domaenen/k1',
      seitenBezeichnung: 'Domänen-Log',
      rueckfragenErlaubt: false,
    });
  });

  it('schickt die Rückfragen-Erlaubnis nur mit Häkchen und nennt die Adresse', async () => {
    rendere();
    expect(screen.getByText(/alex@example\.test/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /Rückfragen/ }));
    fireEvent.change(feld(), { target: { value: 'Bitte ruft an.' } });
    fireEvent.click(sendeKnopf());
    await screen.findByText(FEEDBACK_DANK);
    const body = JSON.parse((apiFetch.mock.calls[0][1] as { body: string }).body);
    expect(body.rueckfragenErlaubt).toBe(true);
  });

  it('bietet in der Demo kein Häkchen an und nennt keine Organisation', async () => {
    rendere({ demo: true });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/wird nur die Seite/)).toBeInTheDocument();
    fireEvent.change(feld(), { target: { value: 'Demo-Feedback' } });
    fireEvent.click(sendeKnopf());
    await screen.findByText(FEEDBACK_DANK);
    const body = JSON.parse((apiFetch.mock.calls[0][1] as { body: string }).body);
    expect(body.rueckfragenErlaubt).toBe(false);
  });

  it('setzt nach dem Dank zurück, behält aber einen abgebrochenen Entwurf', async () => {
    const { oeffneNeu, onSchliessen } = rendere();
    fireEvent.change(feld(), { target: { value: 'Entwurf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onSchliessen).toHaveBeenCalledTimes(1);
    oeffneNeu();
    expect(feld().value).toBe('Entwurf');

    fireEvent.click(sendeKnopf());
    await screen.findByText(FEEDBACK_DANK);
    fireEvent.click(fussSchliessen());
    oeffneNeu();
    expect(feld().value).toBe('');
  });

  it('meldet ein abgeschaltetes Modul und blendet den Punkt aus', async () => {
    apiFetch.mockRejectedValue(
      new ApiErrorAttrappe({ code: 'HTTP_404', nachricht: 'weg' }, 404),
    );
    const { onNichtVerfuegbar } = rendere();
    fireEvent.change(feld(), { target: { value: 'Hallo' } });
    fireEvent.click(sendeKnopf());
    expect(await screen.findByRole('alert')).toHaveTextContent('gerade nicht verfügbar');
    expect(onNichtVerfuegbar).toHaveBeenCalled();
  });

  it('bittet bei zu vielen Versuchen um Geduld und behält den Text', async () => {
    apiFetch.mockRejectedValue(
      new ApiErrorAttrappe({ code: 'HTTP_429', nachricht: 'zu viele' }, 429),
    );
    rendere();
    fireEvent.change(feld(), { target: { value: 'Nochmal' } });
    fireEvent.click(sendeKnopf());
    expect(await screen.findByRole('alert')).toHaveTextContent('ein paar Minuten');
    expect(feld().value).toBe('Nochmal');
  });

  it('hat in beiden Zuständen keine axe-Verstöße', async () => {
    const { container } = rendere();
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.change(feld(), { target: { value: 'Gut so' } });
    fireEvent.click(sendeKnopf());
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });
});
