import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import type { DemoAnfrageDto, PilotAnfrageDto } from './dto/anfrage.dto';

/**
 * Verarbeitet öffentliche Anfragen aus einem externen Anfrageformular:
 * Demo-Zugang und Pilotphase. Aktiv nur, wenn `ANFRAGE_EMPFAENGER` gesetzt ist –
 * so bleiben die Endpunkte auf normalen Instanzen wirkungslos (404).
 */
@Injectable()
export class AnfrageService {
  private readonly logger = new Logger(AnfrageService.name);

  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Empfängeradresse fürs Team; fehlt sie, sind Anfragen hier nicht aktiv. */
  private empfaenger(): string {
    const e = this.config.get<string>('ANFRAGE_EMPFAENGER');
    if (!e) {
      throw new NotFoundException('Anfragen sind auf dieser Instanz nicht aktiv.');
    }
    return e;
  }

  async demo(dto: DemoAnfrageDto): Promise<void> {
    const empfaenger = this.empfaenger();
    // Honeypot ausgefüllt → Bot: nach außen ok, aber nichts versenden.
    if (dto.webseite) {
      this.logger.warn('Demo-Anfrage mit ausgefülltem Honeypot verworfen.');
      return;
    }
    await this.mail.sendeDemoZugang(dto.email);
    await this.mail.sendeInterneAnfrage(
      empfaenger,
      'Neue Demo-Anfrage',
      [`E-Mail: ${dto.email}`, dto.name ? `Name: ${dto.name}` : ''].filter(Boolean),
    );
  }

  async pilot(dto: PilotAnfrageDto): Promise<void> {
    const empfaenger = this.empfaenger();
    if (dto.webseite) {
      this.logger.warn('Pilot-Anfrage mit ausgefülltem Honeypot verworfen.');
      return;
    }
    await this.mail.sendeInterneAnfrage(
      empfaenger,
      `Pilotphase-Anfrage – ${dto.organisation}`,
      [
        `Organisation: ${dto.organisation}`,
        dto.art ? `Art: ${dto.art}` : '',
        dto.groesse ? `Größe: ${dto.groesse}` : '',
        `Ansprechperson: ${dto.name}`,
        `E-Mail: ${dto.email}`,
        dto.nachricht ? `\nNachricht:\n${dto.nachricht}` : '',
      ].filter(Boolean),
    );
    await this.mail.sendePilotBestaetigung(dto.email, dto.name);
  }
}
