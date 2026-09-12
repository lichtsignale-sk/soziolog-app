import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { Request } from 'express';

/** Zielverzeichnis für gespeicherte Avatare (außerhalb von src, neben dist). */
export const AVATAR_VERZEICHNIS = join(__dirname, '..', '..', 'uploads', 'avatare');

/** Öffentlicher Basis-Pfad, unter dem die Dateien ausgeliefert werden. */
export const AVATAR_OEFFENTLICH = '/uploads/avatare';

const ERLAUBTE_TYPEN = new Set(['image/png', 'image/jpeg', 'image/webp']);
// Der Client sendet einen bereits zugeschnittenen, verkleinerten Ausschnitt –
// 1 MB reicht dafür großzügig und deckelt beliebig große Uploads.
const MAX_GROESSE = 1 * 1024 * 1024; // 1 MB

/**
 * Multer-Konfiguration für den Avatar-Upload: Der Upload landet im Speicher
 * (nicht direkt auf der Platte), damit ihn der KontoService mit sharp auf ein
 * einheitliches quadratisches Format normalisieren kann. Whitelist + Limit.
 */
export const avatarUploadOptionen = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_GROESSE },
  fileFilter: (
    _req: Request,
    datei: Express.Multer.File,
    cb: (fehler: Error | null, akzeptiert: boolean) => void,
  ) => {
    if (!ERLAUBTE_TYPEN.has(datei.mimetype)) {
      cb(
        new BadRequestException(
          'Nur PNG-, JPEG- oder WebP-Bilder sind erlaubt.',
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};
