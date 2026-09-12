import 'reflect-metadata';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { AlleExceptionsFilter } from './common/filters/alle-exceptions.filter';
import { pruefeTlsPflicht } from './mail/tls-pflicht';
import { vertrauensStufe } from './common/trust-proxy';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);

  // Vor allem anderen: in Produktion darf die Verschlüsselung des Postausgangs
  // nicht abgeschaltet sein. Über ihn gehen die Passwort-Reset-Links hinaus —
  // lieber gar nicht starten, als Kontoübernahme-Token im Klartext verschicken.
  pruefeTlsPflicht(
    config.get<string>('NODE_ENV'),
    config.get<string>('SMTP_TLS_ERZWINGEN'),
  );

  // Hochgeladene Dateien (z. B. Avatare) unter /uploads ausliefern – BEWUSST
  // außerhalb des globalen /api-Präfixes (statische Assets, keine API-Route).
  // useStaticAssets registriert die Route direkt auf dem Express-Adapter und ist
  // daher von setGlobalPrefix('api') unberührt.
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  const sentryDsn = config.get<string>('SENTRY_DSN');
  if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn });
  }

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');

  // Ohne diese Zeile ist `req.ip` hinter dem Proxy für alle Aufrufer dieselbe
  // Container-Adresse — und das Rate-Limit damit wirkungslos (siehe
  // common/trust-proxy.ts). Ein falscher Wert bricht den Start ab, statt still
  // ein löchriges Limit zu betreiben.
  app.set('trust proxy', vertrauensStufe(config.get<string>('TRUST_PROXY')));

  // CORS vor Helmet registrieren: OPTIONS-Preflight-Requests werden korrekt beantwortet.
  // credentials: true ist Pflicht für Cookie-Auth (httpOnly Session + CSRF-Cookie).
  const appUrl = config.get<string>('APP_URL', 'http://localhost:5173');
  app.enableCors({
    origin: appUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-csrf-token'],
    exposedHeaders: ['x-request-id'],
  });

  app.use(helmet());
  app.use(cookieParser());

  // whitelist: unbekannte Felder verwerfen; forbidNonWhitelisted: sie ablehnen
  // (defensiv – Requests mit Fremdfeldern werden mit 400 abgewiesen statt still
  // beschnitten); transform: DTO-Instanzen samt Typkonvertierung erzeugen.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AlleExceptionsFilter());

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}

bootstrap();
