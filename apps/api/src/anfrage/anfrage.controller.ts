import { Body, Controller, GoneException, HttpCode, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DemoAnfrageDto, PilotAnfrageDto } from './dto/anfrage.dto';

/**
 * STILLGELEGT — öffentliche Anfragen laufen nicht mehr über diese Anwendung.
 *
 * Hier wurde eine Anfrage nur per Mail verschickt und war weg, sobald der
 * Versand scheiterte.
 *
 * Die Endpunkte bleiben bestehen und antworten mit `410 Gone`. Ein alter
 * Browser-Tab oder ein Bot bekommt damit eine eindeutige Auskunft statt eines
 * 404, das nach einem Ausfall aussieht.
 *
 * WAS PROTOKOLLIERT WIRD — und was ausdrücklich NICHT:
 *
 * Eine frühere Fassung schrieb die eingegangene Anfrage VOLLSTÄNDIG ins
 * Fehlerlog, damit nichts verloren geht. Das war der falsche Tausch: Damit
 * lägen Namen, Adressen und Freitexte von Interessenten dauerhaft im Log der
 * INSTANZ — außerhalb jeder Auskunft, jeder Löschung und ohne
 * Aufbewahrungskonzept. Protokolliert werden deshalb nur die ART der Anfrage
 * und ein Zähler.
 *
 * DER PREIS, offen benannt: Wer nach dem Ausrollen noch auf die alte Adresse
 * sendet, dessen Anfrage ist weg. Auffangen soll das die Antwort selbst — sie
 * nennt den Weg, der jetzt gilt, und eine Adresse zum Hinschreiben. Der Zähler
 * sagt der Betriebsführung, ob noch jemand dort landet; solange er steigt,
 * zeigt irgendwo noch ein Formular hierher.
 *
 * `AnfrageService` bleibt unangetastet im Modul und wird hier bewusst nicht
 * gelöscht.
 */
@Controller('anfrage')
export class AnfrageController {
  private readonly logger = new Logger(AnfrageController.name);
  /** Zähler je Art, nur für die Betriebsanzeige. Kein Nachweis, kein Inhalt. */
  private readonly eingegangen: Record<'demo' | 'pilot', number> = {
    demo: 0,
    pilot: 0,
  };

  @Post('demo')
  @HttpCode(410)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  demo(@Body() _dto: DemoAnfrageDto): never {
    this.meldeUmgezogen('demo');
    throw umgezogen();
  }

  @Post('pilot')
  @HttpCode(410)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  pilot(@Body() _dto: PilotAnfrageDto): never {
    this.meldeUmgezogen('pilot');
    throw umgezogen();
  }

  /**
   * Zählt, wie viele Anfragen noch auf der alten Adresse ankommen — OHNE
   * ihren Inhalt.
   *
   * Der Zähler ist die Betriebsanzeige für den Umzug: solange er steigt, zeigt
   * irgendwo noch ein Formular hierher. Er lebt im Prozess und übersteht keinen
   * Neustart; er soll eine Größenordnung nennen und kein Nachweis sein.
   */
  private meldeUmgezogen(art: 'demo' | 'pilot'): void {
    this.eingegangen[art] += 1;
    this.logger.error(
      `Anfrage (${art}) an den STILLGELEGTEN Endpunkt eingegangen — die ` +
        `${this.eingegangen[art]}. seit dem Start. Der Inhalt wird bewusst ` +
        'NICHT protokolliert; Anfragen laufen nicht mehr über diese ' +
        'Anwendung. Steigt dieser Zähler, zeigt noch ein Formular hierher.',
    );
  }
}

/** Einheitliche Antwort beider Endpunkte. */
function umgezogen(): GoneException {
  return new GoneException(
    'Dieser Weg ist umgezogen. Anfragen laufen jetzt über die SozioLog-' +
      'Verwaltung. Bitte die Seite neu laden oder direkt an hallo@soziolog.com ' +
      'schreiben.',
  );
}
