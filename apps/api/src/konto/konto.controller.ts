import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { KontoService } from './konto.service';
import { KontoAktualisierenDto } from './dto/konto-aktualisieren.dto';
import { PasswortAendernDto } from './dto/passwort-aendern.dto';
import { avatarUploadOptionen } from './avatar.storage';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { sitzungsCookieOptionen } from '../common/cookies';
import { AuthService } from '../auth/auth.service';

@Controller('konto')
@UseGuards(SitzungGuard)
export class KontoController {
  constructor(
    private readonly konto: KontoService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Patch()
  async aktualisiere(
    @AktuellePerson() person: SitzungsPerson,
    @Body() dto: KontoAktualisierenDto,
  ): Promise<{ person: SitzungsPerson }> {
    const aktualisiert = await this.konto.aktualisiere(person.id, dto);
    return { person: aktualisiert };
  }

  /**
   * Wechselt das eigene Passwort.
   *
   * DANACH WIRD EIN FRISCHES SITZUNGS-COOKIE GESETZT, und das ist kein Beiwerk:
   * `aenderePasswort` zählt `sitzungsGeneration` hoch und entwertet damit ALLE
   * Sitzungen dieser Person — auch die, aus der heraus sie gerade handelt. Ohne
   * das neue Cookie liefe der nächste Aufruf in einen 401, das Frontend würfe
   * die Person auf die Anmeldeseite, und sie stünde nach „Passwort geändert."
   * vor einem Anmeldebildschirm. Andere Geräte bleiben ausgeschlossen, genau
   * das ist gewollt.
   *
   * Dasselbe Muster wie in der Verwaltung (zugang.service.setzePasswort): erst
   * entwerten, dann der handelnden Person sofort einen neuen Ausweis geben.
   */
  @Post('passwort')
  @HttpCode(200)
  async aenderePasswort(
    @AktuellePerson() person: SitzungsPerson,
    @Body() dto: PasswortAendernDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await this.konto.aenderePasswort(
      person.id,
      dto.altesPasswort,
      dto.neuesPasswort,
    );
    const token = await this.auth.erstelleSitzungsToken(person);
    res.cookie('sitzung', token, sitzungsCookieOptionen(this.config));
    return { ok: true };
  }

  @Post('avatar')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('datei', avatarUploadOptionen))
  async ladeAvatarHoch(
    @AktuellePerson() person: SitzungsPerson,
    @UploadedFile() datei?: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    if (!datei?.buffer) {
      throw new BadRequestException('Keine Datei hochgeladen.');
    }
    return this.konto.setzeAvatar(person.id, datei.buffer);
  }
}
