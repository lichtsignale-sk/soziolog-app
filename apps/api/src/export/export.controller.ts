import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ExportStartAntwort } from '@soziolog/shared';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { ExportService, type PdfErgebnis } from './export.service';

@Controller('export')
export class ExportController {
  constructor(private readonly export_: ExportService) {}

  /** Einzelner Beschluss/Vorgang als PDF-Download. GET = idempotent, kein CSRF nötig. */
  @Get('vorschlaege/:id/pdf')
  @UseGuards(SitzungGuard)
  async vorschlag(
    @AktuellePerson() person: SitzungsPerson,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return alsDownload(res, await this.export_.einzel(person, id));
  }

  /** Alle Vorgänge einer Domäne als PDF-Download. */
  @Get('domaenen/:domaeneId/pdf')
  @UseGuards(SitzungGuard)
  async domaene(
    @AktuellePerson() person: SitzungsPerson,
    @Param('domaeneId') domaeneId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return alsDownload(res, await this.export_.domaene(person, domaeneId));
  }

  /**
   * Gesamt-Export der Organisation anfragen (Admin). Läuft asynchron: das PDF
   * wird im Hintergrund erzeugt und per Mail zugestellt (202).
   */
  @Post('organisation/pdf')
  @HttpCode(202)
  @UseGuards(SitzungGuard, AdminGuard)
  organisation(@AktuellePerson() person: SitzungsPerson): ExportStartAntwort {
    this.export_.organisationAnfragen(person);
    return { status: 'wird_erstellt', email: person.loginEmail };
  }
}

/** Setzt die PDF-Download-Header und liefert den Buffer als StreamableFile. */
function alsDownload(res: Response, ergebnis: PdfErgebnis): StreamableFile {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${ergebnis.dateiname}"`,
  );
  return new StreamableFile(ergebnis.buffer);
}
