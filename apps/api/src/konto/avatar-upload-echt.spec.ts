import {
  Controller,
  Module,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { request } from 'http';
import { avatarUploadOptionen } from './avatar.storage';

/**
 * ECHTER UPLOAD GEGEN EINEN LAUFENDEN SERVER — keine Attrappe.
 *
 * WARUM ([A.17]): Die vier hohen Befunde von `pnpm audit` steckten in `multer`,
 * das NestJS 10 ueber `@nestjs/platform-express` mitbringt. Statt eines
 * Major-Sprungs des ganzen Frameworks wird der Paketstand in
 * `pnpm-workspace.yaml` auf `^2.2.0` gezwungen. Das ist eine BEHAUPTUNG: dass
 * multer 2 mit dem Aufrufer aus NestJS 10 zusammenarbeitet.
 *
 * Die uebrigen Tests dieses Projekts mocken den Upload — sie wuerden einen
 * Bruch an dieser Stelle nicht bemerken. Dieser hier schickt eine echte
 * multipart-Anfrage ueber einen echten Socket und prueft, was ankommt.
 */
@Controller('pruef')
class PruefController {
  @Post('avatar')
  @UseInterceptors(FileInterceptor('datei', avatarUploadOptionen))
  hochladen(@UploadedFile() datei?: Express.Multer.File) {
    if (!datei) return { empfangen: false };
    return {
      empfangen: true,
      feldname: datei.fieldname,
      dateiname: datei.originalname,
      mimetyp: datei.mimetype,
      groesse: datei.size,
      // Beweist, dass der Inhalt im Speicher liegt und unversehrt ist.
      inhalt: datei.buffer.toString('utf8'),
    };
  }
}

@Module({ controllers: [PruefController] })
class PruefModul {}

/** Baut eine multipart/form-data-Anfrage von Hand und schickt sie ab. */
function sendeDatei(
  port: number,
  feld: string,
  dateiname: string,
  mimetyp: string,
  inhalt: Buffer,
): Promise<{ status: number; koerper: string }> {
  const grenze = '----soziologPruefGrenze1234567890';
  const kopf = Buffer.from(
    `--${grenze}\r\n` +
      `Content-Disposition: form-data; name="${feld}"; filename="${dateiname}"\r\n` +
      `Content-Type: ${mimetyp}\r\n\r\n`,
  );
  const fuss = Buffer.from(`\r\n--${grenze}--\r\n`);
  const koerper = Buffer.concat([kopf, inhalt, fuss]);

  return new Promise((aufloesen, ablehnen) => {
    const anfrage = request(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/pruef/avatar',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${grenze}`,
          'Content-Length': koerper.length,
        },
      },
      (antwort) => {
        let text = '';
        antwort.on('data', (teil) => (text += teil));
        antwort.on('end', () =>
          aufloesen({ status: antwort.statusCode ?? 0, koerper: text }),
        );
      },
    );
    anfrage.on('error', ablehnen);
    anfrage.end(koerper);
  });
}

describe('[A.17] multer 2 arbeitet mit NestJS 10 zusammen', () => {
  let app: NestExpressApplication;
  let port: number;

  beforeAll(async () => {
    const modul = await Test.createTestingModule({
      imports: [PruefModul],
    }).compile();
    app = modul.createNestApplication<NestExpressApplication>();
    await app.listen(0);
    const adresse = app.getHttpServer().address() as { port: number };
    port = adresse.port;
  });

  afterAll(async () => {
    await app.close();
  });

  it('nimmt ein erlaubtes Bild an und reicht den Inhalt unversehrt durch', async () => {
    const inhalt = Buffer.from('das sind die bilddaten');
    const { status, koerper } = await sendeDatei(
      port,
      'datei',
      'avatar.png',
      'image/png',
      inhalt,
    );

    expect(status).toBe(201);
    const antwort = JSON.parse(koerper);
    expect(antwort.empfangen).toBe(true);
    expect(antwort.feldname).toBe('datei');
    expect(antwort.dateiname).toBe('avatar.png');
    expect(antwort.mimetyp).toBe('image/png');
    expect(antwort.groesse).toBe(inhalt.length);
    expect(antwort.inhalt).toBe('das sind die bilddaten');
  });

  it('weist einen nicht erlaubten Typ ab — der fileFilter greift noch', async () => {
    const { status } = await sendeDatei(
      port,
      'datei',
      'schad.svg',
      'image/svg+xml',
      Buffer.from('<svg/>'),
    );

    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('weist eine zu grosse Datei ab — das Limit greift noch', async () => {
    const zuGross = Buffer.alloc(1024 * 1024 + 1024, 0x41);
    const { status } = await sendeDatei(
      port,
      'datei',
      'gross.png',
      'image/png',
      zuGross,
    );

    expect(status).toBeGreaterThanOrEqual(400);
  });
});
