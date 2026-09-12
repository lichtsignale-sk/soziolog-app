import type { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

/** 7 Tage in Millisekunden (Lebensdauer des Session-Cookies). */
export const SITZUNG_MAX_ALTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Secure-Flag aus Umgebung. `Secure` verlangt HTTPS – im lokalen Dev per
 * COOKIE_SECURE=0 abschaltbar, sonst schlägt Login lokal fehl.
 */
function istSecure(config: ConfigService): boolean {
  return config.get<string>('COOKIE_SECURE', '1') !== '0';
}

/** Cookie-Optionen für das httpOnly-Session-Cookie `sitzung`. */
export function sitzungsCookieOptionen(config: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    secure: istSecure(config),
    sameSite: 'lax',
    path: '/',
    maxAge: SITZUNG_MAX_ALTER_MS,
  };
}

/** Kurzlebiges httpOnly-Cookie für den ausstehenden 2FA-Login-Schritt (10 Min). */
export function pending2faCookieOptionen(config: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    secure: istSecure(config),
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60 * 1000,
  };
}

/**
 * Cookie-Optionen für das CSRF-Cookie `csrf`. NICHT httpOnly, damit das
 * Frontend den Wert lesen und als Header x-csrf-token zurücksenden kann.
 */
export function csrfCookieOptionen(config: ConfigService): CookieOptions {
  return {
    httpOnly: false,
    secure: istSecure(config),
    sameSite: 'lax',
    path: '/',
  };
}
