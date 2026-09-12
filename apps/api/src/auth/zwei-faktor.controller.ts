import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ZweiFaktorService } from './zwei-faktor.service';
import { ZweiFaktorDeaktivierenDto } from './dto/zwei-faktor.dto';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';

/**
 * Verwaltung der eigenen E-Mail-2FA (nur angemeldet). Einschalten aktiviert
 * direkt; beim nächsten Login folgt der E-Mail-Code-Schritt. Ausschalten
 * verlangt das aktuelle Passwort.
 */
@Controller('konto/2fa')
@UseGuards(SitzungGuard)
export class ZweiFaktorController {
  constructor(private readonly zweiFaktor: ZweiFaktorService) {}

  @Post('einschalten')
  @HttpCode(200)
  async einschalten(
    @AktuellePerson() person: SitzungsPerson,
  ): Promise<{ ok: true }> {
    await this.zweiFaktor.einschalten(person.id);
    return { ok: true };
  }

  @Post('ausschalten')
  @HttpCode(200)
  async ausschalten(
    @AktuellePerson() person: SitzungsPerson,
    @Body() dto: ZweiFaktorDeaktivierenDto,
  ): Promise<{ ok: true }> {
    await this.zweiFaktor.ausschalten(person.id, dto.aktuellesPasswort);
    return { ok: true };
  }
}
