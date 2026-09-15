import type { IncomingMessage, ServerResponse } from 'http';
import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { CsrfGuard } from './common/guards/csrf.guard';
import { maskiereUrl } from './common/log-maskierung';
import { pruefeGeheimnisse } from './common/geheimnisse-pruefen';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { KontoModule } from './konto/konto.module';
import { AdminModule } from './admin/admin.module';
import { SetupModule } from './setup/setup.module';
import { VorgangModule } from './vorgang/vorgang.module';
import { GueltigkeitModule } from './gueltigkeit/gueltigkeit.module';
import { DomaeneModule } from './domaene/domaene.module';
import { StatistikModule } from './statistik/statistik.module';
import { KorrekturModule } from './korrektur/korrektur.module';
import { BenachrichtigungModule } from './benachrichtigung/benachrichtigung.module';
import { AnfrageModule } from './anfrage/anfrage.module';
import { ExportModule } from './export/export.module';
import { InternModule } from './intern/intern.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Bricht den Start ab, wenn in Produktion ein Platzhalter oder ein zu
      // kurzer Wert als Geheimnis steht — siehe common/geheimnisse-pruefen.ts.
      validate: pruefeGeheimnisse,
    }),
    ScheduleModule.forRoot(),
    // Globales Basis-Rate-Limit; strengere Limits auf /login und
    // /passwort-vergessen kommen per @Throttle direkt an den Routen.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        customProps: (req: IncomingMessage, _res: ServerResponse) => ({
          requestId: req.headers['x-request-id'] ?? '',
        }),
        // Cookies und CSRF-Header tragen das Sitzungs-Token. Ohne diese Liste
        // steht in jeder Logzeile ein vollwertiger Anmeldeausweis, mit dem jeder
        // Log-Leser die Sitzung übernehmen könnte.
        redact: [
          'req.headers.cookie',
          'req.headers["x-csrf-token"]',
          'req.headers.authorization',
          // Der SetupTokenGuard akzeptiert das Einrichtungsgeheimnis auch als
          // Kopfzeile (setup/setup-token.guard.ts). Nutzt es jemand, stuende es
          // sonst im Klartext im Log — dieselbe Klasse wie das Cookie oben.
          'req.headers["x-setup-token"]',
          'res.headers["set-cookie"]',
        ],
        // Der Standard-Serializer protokolliert `req.url` samt Query-String —
        // dort stehen der Einrichtungs- und der Passwort-Reset-Token. Dieser
        // Serializer bildet dieselben Felder ab und maskiert nur die URL.
        // Bewusst selbst geschrieben statt `pino/stdSerializers` zu importieren:
        // pino ist eine transitive Abhängigkeit von nestjs-pino, kein direkter
        // Eintrag in package.json — ein Import daraus wäre unter pnpm nicht
        // aufzulösen. Die Feldnamen entsprechen dem pino-Standard, damit die
        // `redact`-Pfade oben weiter greifen.
        serializers: {
          req(
            anfrage: IncomingMessage & {
              id?: unknown;
              remoteAddress?: string;
              remotePort?: number;
            },
          ) {
            return {
              id: anfrage.id,
              method: anfrage.method,
              url: maskiereUrl(anfrage.url ?? ''),
              headers: anfrage.headers,
              // pino-http reicht dem eigenen Serializer das BEREITS
              // serialisierte Objekt, nicht die IncomingMessage
              // (wrapRequestSerializer). `socket` gibt es dort nicht mehr,
              // `remoteAddress` schon.
              remoteAddress: anfrage.remoteAddress,
              remotePort: anfrage.remotePort,
            };
          },
        },
      },
      // '{*pfad}' STATT DER VORGABE '*' — `nestjs-pino` registriert seine
      // Middleware ab Werk auf `[{ path: '*', method: ALL }]`, und
      // `setGlobalPrefix('api')` macht daraus `/api/*`. Nest 11 nimmt das
      // noch an und schreibt beim Start zweimal eine Warnung; die
      // Umschreibung ist eine Übergangshilfe. Fällt sie weg, ist es kein
      // Schönheitsfehler mehr, sondern ein „Missing parameter name" beim
      // Start. Dieselbe Form wie unten bei `configure()`.
      forRoutes: [{ path: '{*pfad}', method: RequestMethod.ALL }],
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    KontoModule,
    AdminModule,
    SetupModule,
    VorgangModule,
    GueltigkeitModule,
    DomaeneModule,
    StatistikModule,
    KorrekturModule,
    BenachrichtigungModule,
    AnfrageModule,
    ExportModule,
    InternModule,
    FeedbackModule,
  ],
  controllers: [AppController],
  providers: [
    // Reihenfolge: Rate-Limit vor CSRF-Prüfung.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('{*pfad}');
    // '{*pfad}' STATT '*' ([NestJS 11]): platform-express 11 bringt Express 5
    // mit, und dessen path-to-regexp 8 kennt das nackte '*' nicht mehr — es
    // wirft beim Start "Missing parameter name". Die geschweifte Form ist der
    // benannte, optionale Sammelparameter und deckt dieselben Pfade ab.
  }
}
