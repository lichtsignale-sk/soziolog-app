import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import type { Sharp } from 'sharp';
import { heute, zuDatum } from '@soziolog/shared';

// sharp ist ein CommonJS-Modul (module.exports = Factory). Ohne esModuleInterop
// muss es per require geladen werden, damit die Factory zur Laufzeit aufrufbar
// ist (der Typen-Default-Export wäre sonst nicht callable).
const sharp = require('sharp') as (input?: Buffer) => Sharp;
import { PrismaService } from '../prisma/prisma.service';
import type { KontoAktualisierenDto } from './dto/konto-aktualisieren.dto';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AVATAR_OEFFENTLICH, AVATAR_VERZEICHNIS } from './avatar.storage';

/** Kantenlänge, auf die Avatare serverseitig normalisiert werden. */
const AVATAR_GROESSE = 512;

@Injectable()
export class KontoService {
  private readonly logger = new Logger(KontoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aktualisiert ausschließlich die erlaubten Felder der eigenen Person.
   * nutzername/loginEmail müssen eindeutig bleiben (sonst 409).
   */
  async aktualisiere(
    personId: string,
    dto: KontoAktualisierenDto,
  ): Promise<SitzungsPerson> {
    // Nur die vier erlaubten Felder explizit übernehmen – niemals istAdmin o. Ä.
    const daten: Prisma.PersonUpdateInput = {};
    if (dto.name !== undefined) daten.name = dto.name;
    if (dto.displayName !== undefined) daten.displayName = dto.displayName;
    if (dto.nutzername !== undefined) daten.nutzername = dto.nutzername;
    if (dto.loginEmail !== undefined) daten.loginEmail = dto.loginEmail;
    if (dto.benachrichtigungenAktiv !== undefined) {
      daten.benachrichtigungenAktiv = dto.benachrichtigungenAktiv;
    }

    if (Object.keys(daten).length === 0) {
      throw new BadRequestException('Keine Änderungen angegeben.');
    }

    try {
      const person = await this.prisma.person.update({
        where: { id: personId },
        data: daten,
      });
      return {
        id: person.id,
        organisationId: person.organisationId,
        name: person.name,
        nutzername: person.nutzername,
        loginEmail: person.loginEmail,
        istAdmin: person.istAdmin,
        benachrichtigungenAktiv: person.benachrichtigungenAktiv,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = e.meta?.['target'];
        const feld = Array.isArray(target)
          ? (target as string[]).join(', ')
          : 'Nutzername oder E-Mail';
        throw new ConflictException(`Bereits vergeben: ${feld}.`);
      }
      throw e;
    }
  }

  /** Ändert das eigene Passwort nach Prüfung des aktuellen Passworts. */
  async aenderePasswort(
    personId: string,
    altesPasswort: string,
    neuesPasswort: string,
  ): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
    });
    if (!person || !person.passwortHash) {
      throw new UnauthorizedException('Konto nicht gefunden.');
    }

    const passt = await argon2.verify(person.passwortHash, altesPasswort);
    if (!passt) {
      throw new UnauthorizedException('Das aktuelle Passwort ist falsch.');
    }

    const passwortHash = await argon2.hash(neuesPasswort, {
      type: argon2.argon2id,
    });
    await this.prisma.person.update({
      where: { id: personId },
      data: {
        passwortHash,
        passwortGeaendertAm: zuDatum(heute()),
        // Beendet alle bestehenden Sitzungen dieser Person, auch die auf
        // anderen Geraeten. Wer sein Passwort wechselt, will genau das.
        sitzungsGeneration: { increment: 1 },
      },
    });
  }

  /**
   * Normalisiert den hochgeladenen Bild-Puffer mit sharp auf ein quadratisches
   * WebP (512×512, mittiger Zuschnitt als Sicherheitsnetz), speichert es unter
   * einem UUID-Namen und setzt es als Avatar. Räumt das vorherige Bild auf.
   */
  async setzeAvatar(personId: string, puffer: Buffer): Promise<{ avatarUrl: string }> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { avatarUrl: true },
    });
    if (!person) {
      throw new UnauthorizedException('Konto nicht gefunden.');
    }

    let webp: Buffer;
    try {
      webp = await sharp(puffer)
        .rotate() // EXIF-Orientierung anwenden
        .resize(AVATAR_GROESSE, AVATAR_GROESSE, { fit: 'cover', position: 'centre' })
        .webp({ quality: 82 })
        .toBuffer();
    } catch (e) {
      this.logger.error(
        `Avatar-Verarbeitung fehlgeschlagen (${puffer?.length ?? 0} Bytes): ${
          e instanceof Error ? e.message : e
        }`,
      );
      throw new BadRequestException('Das Bild konnte nicht verarbeitet werden.');
    }

    if (!existsSync(AVATAR_VERZEICHNIS)) {
      mkdirSync(AVATAR_VERZEICHNIS, { recursive: true });
    }
    const dateiname = `${randomUUID()}.webp`;
    await writeFile(join(AVATAR_VERZEICHNIS, dateiname), webp);

    const avatarUrl = `${AVATAR_OEFFENTLICH}/${dateiname}`;
    await this.prisma.person.update({
      where: { id: personId },
      data: { avatarUrl },
    });

    // Altes Bild aufräumen (nur eigene Uploads, nie außerhalb des Verzeichnisses).
    if (person.avatarUrl?.startsWith(`${AVATAR_OEFFENTLICH}/`)) {
      const altPfad = join(AVATAR_VERZEICHNIS, basename(person.avatarUrl));
      try {
        if (existsSync(altPfad)) unlinkSync(altPfad);
      } catch {
        // Alte Datei bereits weg – kein Grund, den Request scheitern zu lassen.
      }
    }

    return { avatarUrl };
  }
}
