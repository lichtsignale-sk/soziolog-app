/**
 * Liest und prüft die Anzahl der vertrauenswürdigen Proxy-Sprünge.
 *
 * WARUM DAS NÖTIG IST: Express ermittelt `req.ip` ohne diese Einstellung aus der
 * TCP-Verbindung. In Produktion steht aber immer ein Proxy davor (äußerer
 * Reverse-Proxy → nginx → api), also ist `req.ip` für JEDEN Aufrufer dieselbe interne
 * Container-Adresse. Der Throttler von NestJS zählt genau über diesen Wert.
 * Ohne `trust proxy` gilt das globale Limit von 100/min deshalb nicht pro
 * Person, sondern für die gesamte Instanz — und das Login-Limit von 5/min sperrt
 * beim ersten Rateversuch alle übrigen Nutzer aus, statt den Angreifer.
 *
 * Der Wert ist die Anzahl der Sprünge VON RECHTS in `X-Forwarded-For`. Er darf
 * nicht zu hoch stehen: Jeder Sprung mehr, als tatsächlich Proxys vorhanden
 * sind, lässt den Aufrufer seine eigene Adresse frei wählen und das Limit
 * umgehen.
 *
 * Vorgabe 2 = ein äußerer Reverse-Proxy (TLS) plus nginx im Web-Container.
 */
export const TRUST_PROXY_VORGABE = 2;

export function vertrauensStufe(roh: string | undefined): number {
  const wert = (roh ?? '').trim();
  if (wert === '') return TRUST_PROXY_VORGABE;

  const zahl = Number(wert);
  if (!Number.isInteger(zahl) || zahl < 0) {
    throw new Error(
      `TRUST_PROXY muss eine ganze Zahl >= 0 sein, war "${wert}". ` +
        'Bedeutung: Anzahl der Proxys vor der API. Hinter einem äußeren ' +
        'Reverse-Proxy plus nginx ist 2 richtig, bei direktem Zugriff ohne Proxy 0.',
    );
  }
  return zahl;
}
