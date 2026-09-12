import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EinladungService } from '../verwaltung/einladung.service';
import { EinladungAktivierenDto } from '../setup/dto/setup.dto';

/**
 * Öffentliche Einlösung von Einladungen – bewusst ohne Login/SitzungGuard.
 * Der CSRF-Schutz greift global; das Frontend holt vorab ein CSRF-Token.
 */
@Controller('einladung')
export class EinladungController {
  constructor(private readonly einladung: EinladungService) {}

  @Get(':token')
  pruefe(@Param('token') token: string) {
    return this.einladung.pruefe(token);
  }

  @Post(':token/aktivieren')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async aktivieren(
    @Param('token') token: string,
    @Body() dto: EinladungAktivierenDto,
  ): Promise<{ ok: true }> {
    await this.einladung.aktiviere(token, dto.passwort);
    return { ok: true };
  }
}
