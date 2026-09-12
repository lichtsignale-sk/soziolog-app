import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import type { AktuellePersonDTO } from '@soziolog/shared';
import { AuthService } from './auth.service';
import { ZweiFaktorService } from './zwei-faktor.service';
import { LoginDto } from './dto/login.dto';
import { ZweiFaktorLoginDto } from './dto/zwei-faktor.dto';
import { PasswortVergessenDto } from './dto/passwort-vergessen.dto';
import { PasswortZuruecksetzenDto } from './dto/passwort-zuruecksetzen.dto';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import {
  csrfCookieOptionen,
  sitzungsCookieOptionen,
  pending2faCookieOptionen,
} from '../common/cookies';

/** Einheitliche neutrale Antwort für Passwort-vergessen. */
const NEUTRALE_ANTWORT = {
  nachricht:
    'Falls die Adresse existiert, wurde eine E-Mail mit weiteren Schritten verschickt.',
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly zweiFaktor: ZweiFaktorService,
  ) {}

  /** Liefert (und setzt) ein CSRF-Token für Double-Submit bei schreibenden Requests. */
  @Get('csrf')
  csrf(@Res({ passthrough: true }) res: Response): { csrfToken: string } {
    const csrfToken = randomBytes(24).toString('hex');
    res.cookie('csrf', csrfToken, csrfCookieOptionen(this.config));
    return { csrfToken };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ person: SitzungsPerson } | { zweiFaktorErforderlich: true }> {
    const { person, zweiFaktorAktiv } = await this.auth.login(
      dto.nutzernameOderEmail,
      dto.passwort,
    );

    if (zweiFaktorAktiv) {
      // Statt der Sitzung: kurzlebiges Pending-Cookie + Code per E-Mail.
      const pendingToken = await this.auth.erstellePending2faToken(person.id);
      res.cookie('pending2fa', pendingToken, pending2faCookieOptionen(this.config));
      await this.zweiFaktor.codeSendenFuerLogin(person.id);
      return { zweiFaktorErforderlich: true };
    }

    const token = await this.auth.erstelleSitzungsToken(person);
    await this.auth.merkeAnmeldung(person.id);
    res.cookie('sitzung', token, sitzungsCookieOptionen(this.config));
    return { person };
  }

  /** Zweiter Login-Schritt bei aktiver E-Mail-2FA: Code prüfen, Sitzung ausstellen. */
  @Post('2fa/login-verifizieren')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async loginVerifizieren(
    @Body() dto: ZweiFaktorLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ person: SitzungsPerson }> {
    const pending = (req.cookies as Record<string, string> | undefined)?.[
      'pending2fa'
    ];
    const personId = await this.auth.verifizierePending2fa(pending);
    const ok = await this.zweiFaktor.codeVerifizieren(personId, dto.code);
    if (!ok) {
      throw new UnauthorizedException('Der Code ist ungültig oder abgelaufen.');
    }
    const person = await this.auth.ladeSitzungsPerson(personId);
    const token = await this.auth.erstelleSitzungsToken(person);
    await this.auth.merkeAnmeldung(person.id);
    res.clearCookie('pending2fa', { path: '/' });
    res.cookie('sitzung', token, sitzungsCookieOptionen(this.config));
    return { person };
  }

  /** Fordert im 2FA-Schritt einen neuen Login-Code an (60-Sekunden-Sperre). */
  @Post('2fa/code-erneut-senden')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async codeErneutSenden(@Req() req: Request): Promise<{ ok: true }> {
    const pending = (req.cookies as Record<string, string> | undefined)?.[
      'pending2fa'
    ];
    const personId = await this.auth.verifizierePending2fa(pending);
    await this.zweiFaktor.codeErneutSenden(personId);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(SitzungGuard)
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie('sitzung', { path: '/' });
    return { ok: true };
  }

  @Get('ich')
  @UseGuards(SitzungGuard)
  async ich(
    @AktuellePerson() person: SitzungsPerson,
  ): Promise<AktuellePersonDTO> {
    return this.auth.ich(person.id);
  }

  @Post('passwort-vergessen')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async passwortVergessen(
    @Body() dto: PasswortVergessenDto,
  ): Promise<{ nachricht: string }> {
    await this.auth.passwortVergessen(dto.email);
    return NEUTRALE_ANTWORT;
  }

  @Post('passwort-zuruecksetzen')
  @HttpCode(200)
  async passwortZuruecksetzen(
    @Body() dto: PasswortZuruecksetzenDto,
  ): Promise<{ ok: true }> {
    await this.auth.passwortZuruecksetzen(dto.token, dto.neuesPasswort);
    return { ok: true };
  }
}
