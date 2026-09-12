import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SetupService } from './setup.service';
import { SetupGesperrtGuard } from './setup-gesperrt.guard';
import {
  SETUP_COOKIE,
  SetupTokenGuard,
  erwartetesGeheimnis,
  gleich,
} from './setup-token.guard';
import { SetupDto } from './dto/setup.dto';

@Controller('setup')
export class SetupController {
  constructor(
    private readonly setup: SetupService,
    private readonly config: ConfigService,
  ) {}

  /** Immer erreichbar – das Frontend entscheidet damit, ob der Assistent nötig ist. */
  @Get('status')
  status(): Promise<{
    benoetigtSetup: boolean;
    smtpVorhanden: boolean;
    demoModus: boolean;
  }> {
    return this.setup.status();
  }

  /**
   * EINSTIEG ÜBER DEN EINLADUNGSLINK.
   *
   * Prüft das Geheimnis aus `?token=`, setzt ein kurzlebiges httpOnly-Cookie
   * und leitet auf den Assistenten weiter. Der Assistent selbst bleibt dadurch
   * unverändert: Das Geheimnis steht nicht in seinem Formular, nicht in seinem
   * Zustand und nicht im weiteren Verlauf — der Browser hängt das Cookie an.
   *
   * Ohne gesetztes `SETUP_TOKEN` (selbst betriebene Instanz) leitet die Route
   * einfach weiter; es gibt dann nichts zu prüfen.
   *
   * BEWUSST OHNE Auskunft darüber, ob das Geheimnis falsch war oder die
   * Einrichtung schon abgeschlossen ist: In beiden Fällen landet man auf dem
   * Assistenten, und der sagt es dann selbst.
   */
  @Get('start')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  start(
    @Query('token') token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): void {
    const erwartet = erwartetesGeheimnis(this.config);
    if (erwartet !== null && typeof token === 'string' && gleich(token, erwartet)) {
      res.cookie(SETUP_COOKIE, token, {
        httpOnly: true,
        secure: this.config.get<string>('COOKIE_SECURE', '1') !== '0',
        // `lax` genügt und ist nötig: Der Aufruf ist eine ganz gewöhnliche
        // Navigation, und das Cookie muss die Weiterleitung überleben.
        sameSite: 'lax',
        path: '/',
        // Kurz. Der Assistent wird in einem Zug ausgefüllt; ein Geheimnis, das
        // tagelang im Browser liegt, ist ein zweiter Einladungslink.
        maxAge: 60 * 60 * 1000,
      });
    }
    res.redirect(302, '/setup');
  }

  /**
   * Erst-Setup. Zwei Schranken:
   * - `SetupGesperrtGuard`: nach Abschluss gesperrt (410).
   * - `SetupTokenGuard`: davor nur über den Einladungslink erreichbar.
   *   Ohne gesetztes `SETUP_TOKEN` wirkungslos — bestehende und selbst
   *   betriebene Instanzen bleiben unverändert.
   */
  @Post()
  @HttpCode(201)
  @UseGuards(SetupGesperrtGuard, SetupTokenGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  durchfuehren(@Body() dto: SetupDto) {
    return this.setup.durchfuehren(dto);
  }

}
