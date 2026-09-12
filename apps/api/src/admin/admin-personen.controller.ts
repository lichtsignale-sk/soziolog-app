import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { PersonVerwaltungService } from '../verwaltung/person-verwaltung.service';
import { EinladungService } from '../verwaltung/einladung.service';
import { MailService } from '../mail/mail.service';
import { PersonAnlegenDto, PersonAktualisierenDto } from './dto/person.dto';

@Controller('admin/personen')
@UseGuards(SitzungGuard, AdminGuard)
export class AdminPersonenController {
  private readonly logger = new Logger(AdminPersonenController.name);

  constructor(
    private readonly personen: PersonVerwaltungService,
    private readonly einladung: EinladungService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private aktivierungsUrl(token: string): string {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');
    return `${appUrl}/einladung/${token}`;
  }

  /** Sendet die Einladungsmail; ein Fehler blockiert den Aufrufer nicht. */
  private async versendeEinladung(
    loginEmail: string,
    name: string,
    token: string,
  ): Promise<boolean> {
    try {
      await this.mail.sendeEinladung(loginEmail, name, this.aktivierungsUrl(token));
      return true;
    } catch (e) {
      this.logger.error(
        `Einladungs-Mail an ${loginEmail} fehlgeschlagen: ${
          e instanceof Error ? e.message : e
        }`,
      );
      return false;
    }
  }

  @Get()
  alle(@AktuellePerson() admin: SitzungsPerson) {
    return this.personen.alle(admin.organisationId);
  }

  @Post()
  async anlegen(
    @AktuellePerson() admin: SitzungsPerson,
    @Body() dto: PersonAnlegenDto,
  ) {
    const { person, einladungToken } = await this.personen.anlegen(
      admin.organisationId,
      dto,
    );
    const mailVersendet = await this.versendeEinladung(
      person.loginEmail,
      person.name,
      einladungToken,
    );
    return { person, mailVersendet };
  }

  @Post(':id/einladung-erneut-senden')
  @HttpCode(200)
  async einladungErneutSenden(
    @Param('id') id: string,
  ): Promise<{ ok: true; mailVersendet: boolean }> {
    const person = await this.personen.hole(id);
    const token = await this.einladung.neuAusstellen(id);
    const mailVersendet = await this.versendeEinladung(
      person.loginEmail,
      person.name,
      token,
    );
    return { ok: true, mailVersendet };
  }

  @Patch(':id')
  async aktualisieren(
    @Param('id') id: string,
    @Body() dto: PersonAktualisierenDto,
  ) {
    const person = await this.personen.aktualisieren(id, dto);
    return { person };
  }

  @Delete(':id')
  @HttpCode(200)
  async loeschen(@Param('id') id: string): Promise<{ ok: true }> {
    await this.personen.loeschen(id);
    return { ok: true };
  }
}
