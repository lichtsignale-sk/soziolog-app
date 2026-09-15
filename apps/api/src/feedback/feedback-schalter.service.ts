import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** So lange gilt eine erfolgreiche Antwort als frisch. */
export const SCHALTER_FRISCH_MS = 5 * 60_000;
/** Nach einem Fehlschlag so lange nicht erneut fragen. */
export const SCHALTER_FEHLERPAUSE_MS = 60_000;
/** Höchstens so lange auf eine Antwort warten. */
export const SCHALTER_TIMEOUT_MS = 2_500;

/**
 * FRAGT OPTIONAL EINE ENTFERNTE STELLE, OB DAS FEEDBACK AN IST.
 *
 * `FEEDBACK_SCHALTER_URL` ist eine Adresse, die mit `{ "feedback": true }`
 * oder `{ "feedback": false }` antwortet. So lässt sich das Modul für mehrere
 * Instanzen an einer Stelle abschalten, ohne jede neu auszurollen. Die Instanz
 * FRAGT NUR — sie schickt dabei nichts mit und schreibt nirgends hin.
 *
 * - Ohne Adresse: an (dann entscheidet allein `FEEDBACK_EMPFAENGER`).
 * - Eine Antwort gilt fünf Minuten. Danach wird sie sofort weiter benutzt und
 *   im Hintergrund erneuert — kein Seitenaufruf wartet auf die Gegenstelle.
 * - Ist die Gegenstelle nicht erreichbar, gilt der letzte bekannte Wert; gab
 *   es noch keinen, gilt „an". Eine Minute Pause, dann neuer Versuch.
 *
 * Der Inhalt einer Antwort kommt nie ins Log; gemeldet wird nur ein Wechsel
 * zwischen „erreichbar" und „nicht erreichbar".
 */
@Injectable()
export class FeedbackSchalterService {
  private readonly logger = new Logger(FeedbackSchalterService.name);
  private letzterWert: boolean | null = null;
  private gueltigBis = 0;
  private laufend: Promise<boolean> | null = null;
  private zuletztErreichbar: boolean | null = null;

  /** Uhr und Abruf, in Tests austauschbar. */
  jetzt: () => number = Date.now;
  abruf: typeof fetch = (eingabe, init) => fetch(eingabe, init);

  constructor(private readonly config: ConfigService) {}

  private adresse(): string | undefined {
    const wert = this.config.get<string>('FEEDBACK_SCHALTER_URL')?.trim();
    return wert ? wert : undefined;
  }

  async istAn(): Promise<boolean> {
    const adresse = this.adresse();
    if (!adresse) return true;

    if (this.jetzt() < this.gueltigBis) return this.letzterWert ?? true;
    if (this.letzterWert !== null) {
      // Veraltet, aber bekannt: sofort antworten, im Hintergrund erneuern.
      void this.frage(adresse);
      return this.letzterWert;
    }
    return this.frage(adresse);
  }

  /** Höchstens ein Abruf zur selben Zeit. Wirft nie. */
  private frage(adresse: string): Promise<boolean> {
    if (!this.laufend) {
      this.laufend = this.abrufen(adresse).finally(() => {
        this.laufend = null;
      });
    }
    return this.laufend;
  }

  private async abrufen(adresse: string): Promise<boolean> {
    try {
      // Vor der ersten Antwort (und in einer Fehlerpause ohne bekannten
      // Stand) wartet ein Aufruf höchstens SCHALTER_TIMEOUT_MS. Keine
      // Weiterleitungen: Die Adresse ist fest eingestellt, eine Umleitung
      // wäre ein Fehler und kein Ziel.
      const antwort = await this.abruf(adresse, {
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(SCHALTER_TIMEOUT_MS),
      });
      if (!antwort.ok) throw new Error(`Status ${antwort.status}`);
      const koerper = (await antwort.json()) as { feedback?: unknown } | null;
      const wert = koerper?.feedback;
      if (typeof wert !== 'boolean') throw new Error('unerwartete Antwortform');

      this.letzterWert = wert;
      this.gueltigBis = this.jetzt() + SCHALTER_FRISCH_MS;
      if (this.zuletztErreichbar === false) {
        this.logger.log('Feedback-Schalter wieder erreichbar.');
      }
      this.zuletztErreichbar = true;
      return wert;
    } catch (e) {
      this.gueltigBis = this.jetzt() + SCHALTER_FEHLERPAUSE_MS;
      if (this.zuletztErreichbar !== false) {
        const grund = e instanceof Error ? e.name === 'Error' ? e.message : e.name : 'unbekannt';
        this.logger.warn(
          `Feedback-Schalter nicht abrufbar (${grund}); es gilt ` +
            `${this.letzterWert === null ? 'die Vorgabe „an"' : 'der letzte bekannte Stand'}.`,
        );
      }
      this.zuletztErreichbar = false;
      return this.letzterWert ?? true;
    }
  }
}
