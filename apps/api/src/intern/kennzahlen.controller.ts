import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { KennzahlenTokenGuard } from './kennzahlen-token.guard';
import { KennzahlenService } from './kennzahlen.service';
import type { KennzahlenAntwort } from './kennzahlen.typen';

/**
 * `GET /api/intern/kennzahlen` — der einzige Weg, auf dem die Verwaltung
 * (SozioLog Control) etwas über eine laufende Kundeninstanz erfährt.
 *
 * WARUM ES DAS GIBT — und warum es so schmal ist: Die Verwaltung hat KEINE
 * SQL-Verbindung zu Kundendatenbanken (harte Regel R1). Sie fragt hier
 * täglich sechs Werte ab, mehr existiert auf dieser Route nicht. Genau das
 * macht den Zugang im Auftragsverarbeitungsvertrag in einem Satz erklärbar.
 *
 * SCHUTZ: ein PRO INSTANZ erzeugtes Geheimnis (`KENNZAHLEN_TOKEN`),
 * zeitkonstant verglichen. Ohne die Variable existiert die Route nicht (404) —
 * bestehende Instanzen bleiben unverändert.
 *
 * AUSSCHLIESSLICH LESEND. Es gibt hier keinen POST, PATCH oder DELETE, und es
 * soll auch keinen geben: Die Verwaltung schreibt auf einer Kundeninstanz
 * nichts — sie legt sie über die Coolify-API an und stoppt sie über die
 * Coolify-API, und das war die vollständige Aufzählung.
 */
@Controller('intern')
@UseGuards(KennzahlenTokenGuard)
export class KennzahlenController {
  constructor(private readonly kennzahlen: KennzahlenService) {}

  @Get('kennzahlen')
  // Abgefragt wird einmal am Tag. Ein Limit von 30/Minute lässt Nachholläufe
  // und Fehlersuche zu und macht das Raten des Geheimnisses trotzdem teuer.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async abrufen(
    /**
     * Abdruck des Organisationsnamens, den die Verwaltung erwartet — NICHT der
     * Name (E3-3/E3-20). Optional; ohne ihn bleibt
     * `organisationsnameStimmt` null.
     */
    @Query('nameAbdruck') nameAbdruck?: string,
  ): Promise<KennzahlenAntwort> {
    // Nur ein Hex-Abdruck kommt durch. Alles andere wird verworfen statt
    // durchgereicht: Ein freier Abfrageparameter wäre der einzige Weg, über
    // den auf diesem Endpunkt je Fremdtext ankäme.
    const geprueft =
      typeof nameAbdruck === 'string' && /^[0-9a-f]{64}$/.test(nameAbdruck)
        ? nameAbdruck
        : undefined;
    return this.kennzahlen.erhebe(geprueft);
  }
}
