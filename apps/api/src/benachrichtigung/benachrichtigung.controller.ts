import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { AnzahlUngelesenDTO } from '@soziolog/shared';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { BenachrichtigungService } from './benachrichtigung.service';
import { UeberpruefungScheduler } from './ueberpruefung.scheduler';

/** Benachrichtigungen der angemeldeten Person + Lesestand-Abfrage. */
@Controller('benachrichtigungen')
@UseGuards(SitzungGuard)
export class BenachrichtigungController {
  constructor(
    private readonly benachrichtigung: BenachrichtigungService,
    private readonly scheduler: UeberpruefungScheduler,
  ) {}

  /**
   * Löst den täglichen Überprüfungslauf manuell aus (nur Admin). Dient dem
   * Testen/Demonstrieren ohne Warten auf den nächtlichen Cron.
   */
  @Post('ueberpruefungen/verarbeiten')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  async ueberpruefungenVerarbeiten(): Promise<{ neu: number }> {
    const neu = await this.scheduler.verarbeiteFaellige();
    return { neu };
  }

  @Get()
  meine(@AktuellePerson() person: SitzungsPerson) {
    return this.benachrichtigung.meine(person.id);
  }

  @Get('anzahl-ungelesen')
  async anzahlUngelesen(
    @AktuellePerson() person: SitzungsPerson,
  ): Promise<AnzahlUngelesenDTO> {
    const anzahl = await this.benachrichtigung.anzahlUngelesen(person.id);
    return { anzahl };
  }

  /** Markiert alle „Korrekturantrag zu bestätigen" als angeschaut (Tab-Besuch). */
  @Post('korrektur-beantragt/gelesen')
  @HttpCode(200)
  async korrekturBeantragtGelesen(
    @AktuellePerson() person: SitzungsPerson,
  ): Promise<{ ok: true }> {
    await this.benachrichtigung.markiereTypGelesen(person.id, 'korrektur_beantragt');
    return { ok: true };
  }

  @Post(':id/gelesen')
  @HttpCode(200)
  async gelesen(
    @AktuellePerson() person: SitzungsPerson,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.benachrichtigung.alsGelesen(id, person.id);
    return { ok: true };
  }

  @Get(':id/lesestand')
  lesestand(@Param('id') id: string) {
    return this.benachrichtigung.lesestand(id);
  }
}
