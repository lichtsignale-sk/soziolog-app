import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { DomaeneService } from '../verwaltung/domaene.service';
import { MitgliedschaftService } from '../verwaltung/mitgliedschaft.service';
import { RollenService } from '../verwaltung/rollen.service';
import { DomaeneArchivService } from '../verwaltung/domaene-archiv.service';
import {
  DomaeneErstellenDto,
  DomaeneAktualisierenDto,
  MitgliedHinzufuegenDto,
  RolleHinzufuegenDto,
} from './dto/domaene.dto';
import { ArchivierenDto } from './dto/archiv.dto';

@Controller('admin')
@UseGuards(SitzungGuard, AdminGuard)
export class AdminDomaenenController {
  constructor(
    private readonly domaenen: DomaeneService,
    private readonly mitgliedschaften: MitgliedschaftService,
    private readonly rollen: RollenService,
    private readonly archiv: DomaeneArchivService,
  ) {}

  @Post('domaenen')
  async erstellen(
    @AktuellePerson() admin: SitzungsPerson,
    @Body() dto: DomaeneErstellenDto,
  ) {
    return this.domaenen.erstellen(admin.organisationId, dto);
  }

  @Patch('domaenen/:id')
  async aktualisieren(
    @Param('id') id: string,
    @Body() dto: DomaeneAktualisierenDto,
  ) {
    return this.domaenen.aktualisieren(id, dto);
  }

  @Get('domaenen/:id/mitglieder')
  async mitglieder(
    @AktuellePerson() admin: SitzungsPerson,
    @Param('id') id: string,
  ) {
    return this.domaenen.mitgliederDetail(admin.organisationId, id);
  }

  @Get('domaenen/:id/archivieren-vorschau')
  async archivierenVorschau(
    @AktuellePerson() admin: SitzungsPerson,
    @Param('id') id: string,
  ) {
    return this.archiv.vorschau(admin.organisationId, id);
  }

  @Post('domaenen/:id/archivieren')
  @HttpCode(200)
  async archivieren(
    @AktuellePerson() admin: SitzungsPerson,
    @Param('id') id: string,
    @Body() dto: ArchivierenDto,
  ): Promise<{ ok: true }> {
    await this.archiv.archivieren(admin.organisationId, id, dto);
    return { ok: true };
  }

  @Post('domaenen/:id/wiederbeleben')
  @HttpCode(200)
  async wiederbeleben(
    @AktuellePerson() admin: SitzungsPerson,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.archiv.wiederbeleben(admin.organisationId, id);
    return { ok: true };
  }

  @Post('domaenen/:id/mitglieder')
  async mitgliedHinzufuegen(
    @Param('id') domaeneId: string,
    @Body() dto: MitgliedHinzufuegenDto,
  ) {
    return this.mitgliedschaften.hinzufuegen(domaeneId, dto.personId);
  }

  @Delete('mitgliedschaften/:mitgliedschaftId')
  @HttpCode(200)
  async mitgliedBeenden(
    @Param('mitgliedschaftId') mitgliedschaftId: string,
  ): Promise<{ ok: true }> {
    await this.mitgliedschaften.beenden(mitgliedschaftId);
    return { ok: true };
  }

  /** Entfernt eine Person aus einer Domäne (per Domäne+Person). */
  @Delete('domaenen/:id/mitglieder/:personId')
  @HttpCode(200)
  async mitgliedEntfernen(
    @Param('id') domaeneId: string,
    @Param('personId') personId: string,
  ): Promise<{ ok: true }> {
    await this.mitgliedschaften.beendenFuerPerson(domaeneId, personId);
    return { ok: true };
  }

  @Post('domaenen/:id/rollen')
  async rolleSetzen(
    @Param('id') domaeneId: string,
    @Body() dto: RolleHinzufuegenDto,
  ) {
    return this.rollen.setzen(domaeneId, dto.personId, dto.rolleTyp);
  }

  @Delete('domaenen/:id/personen/:personId/rolle')
  @HttpCode(200)
  async rolleAufTeilhabend(
    @Param('id') domaeneId: string,
    @Param('personId') personId: string,
  ): Promise<{ ok: true }> {
    await this.rollen.aufTeilhabend(domaeneId, personId);
    return { ok: true };
  }

  @Delete('rollen/:rollenId')
  @HttpCode(200)
  async rolleBeenden(
    @Param('rollenId') rollenId: string,
  ): Promise<{ ok: true }> {
    await this.rollen.beenden(rollenId);
    return { ok: true };
  }
}
