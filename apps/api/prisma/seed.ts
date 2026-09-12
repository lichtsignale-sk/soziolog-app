import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { heute, datumPlusTage } from '@soziolog/shared';

const prisma = new PrismaClient();

/** Kalendertag als UTC-Mitternacht (kein Zeitzonen-Versatz bei @db.Date). */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** YYYY-MM-DD relativ zum echten Heute – für zeitbezogene Demo-Fälle (Fristen). */
function relTag(offset: number): string {
  return datumPlusTage(heute(), offset);
}

/**
 * Demo-Seed „Genossenschaft Solawi Rheintal" mit ECHTEN, in sich konsistenten
 * Daten: alle angezeigten Zahlen (Beschlüsse, Teilhabende, Bedenken/Einwände,
 * Korrekturen, Statistik) werden live aus diesen Datensätzen aggregiert – es gibt
 * keine gespeicherten Anzeige-Zähler mehr. Idempotent: löscht eine bestehende
 * Organisation gleichen Namens komplett und legt alles neu an. Passwort aller
 * aktiven Konten: demo1234.
 */
async function main() {
  // SCHUTZ: Der Seed LÖSCHT Daten. In Produktion darf er nur auf der Demo-Instanz
  // laufen (DEMO_MODE=1). Echte Kunden-Instanzen (NODE_ENV=production ohne
  // DEMO_MODE) werden hart abgewiesen; lokal (kein production) läuft er wie bisher.
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== '1') {
    console.error(
      'Abbruch: Seed in Produktion nur mit DEMO_MODE=1 erlaubt (Schutz echter Instanzen).',
    );
    process.exit(1);
  }

  // Selbstheilender Demo-Reset: ALLE Organisationen entfernen und komplett neu
  // aufbauen – so verschwindet auch eine z. B. per Setup-Assistent angelegte Org.
  const alleOrgs = await prisma.organisation.findMany({ select: { id: true } });
  for (const o of alleOrgs) {
    await raeumeOrgAuf(o.id);
  }

  const passwortHash = await argon2.hash('demo1234', { type: argon2.argon2id });

  const org = await prisma.organisation.create({
    data: {
      name: 'Genossenschaft Solawi Rheintal',
      setupAbgeschlossen: true,
      angelegtAm: d('2021-11-20'),
    },
  });

  // ---------------------------------------------------------------- Domänen
  const c1 = await domaene({
    orgId: org.id, name: 'Allgemeiner Kreis', typ: 'dauerdomaene',
    ziel: 'Die Organisation als Ganzes ausrichten, Grundsätze festlegen und die Arbeit der Unterdomänen koordinieren.',
    tasks: ['Leitbild & Grundsätze pflegen', 'Haushalt beschließen', 'Delegierte koordinieren'],
    gegruendet: '2021-11-20',
  });
  const c1a = await domaene({
    orgId: org.id, elternId: c1.id, name: 'Finanzkreis', typ: 'dauerdomaene',
    ziel: 'Die finanzielle Stabilität der Genossenschaft sichern und transparent verwalten.',
    tasks: ['Buchhaltung führen', 'Jahreshaushalt planen', 'Rücklagen verwalten'],
    gegruendet: '2021-12-01',
  });
  const c1b = await domaene({
    orgId: org.id, elternId: c1.id, name: 'Öffentlichkeitskreis', typ: 'dauerdomaene',
    ziel: 'Die Genossenschaft nach außen sichtbar, verständlich und einladend darstellen — und den Dialog mit Mitgliedern und Öffentlichkeit pflegen.',
    tasks: ['Kanäle betreuen & Redaktion', 'Newsletter & Website', 'Presse- und Öffentlichkeitsarbeit'],
    gegruendet: '2022-01-15',
  });
  const c1b1 = await domaene({
    orgId: org.id, elternId: c1b.id, name: 'Social-Media-Kreis', typ: 'arbeitsdomaene',
    ziel: 'Soziale Kanäle aufbauen und redaktionell betreuen.',
    tasks: ['Beiträge planen', 'Community betreuen'],
    gegruendet: '2023-03-01',
  });
  const c1c = await domaene({
    orgId: org.id, elternId: c1.id, name: 'Personalkreis', typ: 'dauerdomaene',
    ziel: 'Rollen besetzen, Mitwirkung fördern und faire Zusammenarbeit sicherstellen.',
    tasks: ['Rollenwahlen organisieren', 'Onboarding begleiten'],
    gegruendet: '2022-02-10',
  });
  const c2 = await domaene({
    orgId: org.id, name: 'Anbaukreis', typ: 'dauerdomaene',
    ziel: 'Den solidarischen Gemüseanbau planen, durchführen und weiterentwickeln.',
    tasks: ['Anbauplanung', 'Bewässerung & Pflege', 'Ernteorganisation'],
    gegruendet: '2021-11-25',
  });
  const c2a = await domaene({
    orgId: org.id, elternId: c2.id, name: 'Gemüse-Team', typ: 'arbeitsdomaene',
    ziel: 'Das operative Anbau- und Erntegeschäft im Feld umsetzen.',
    tasks: ['Aussaat & Ernte', 'Preisgestaltung'],
    gegruendet: '2022-04-01',
  });
  const c2b = await domaene({
    orgId: org.id, elternId: c2.id, name: 'Verteilkreis', typ: 'arbeitsdomaene',
    ziel: 'Die Verteilung der Ernte an die Mitglieder zuverlässig organisieren.',
    tasks: ['Abholstationen betreuen', 'Logistik planen'],
    gegruendet: '2022-05-01',
  });
  const c2a1 = await domaene({
    orgId: org.id, elternId: c2a.id, name: 'Saatgut-AG', typ: 'arbeitsdomaene',
    ziel: 'Eigenes samenfestes Saatgut vermehren, sortenrein lagern und an andere Höfe weitergeben.',
    tasks: ['Sorten auswählen & vermehren', 'Saatgut trocknen und lagern', 'Tauschringe pflegen'],
    gegruendet: '2025-02-10',
  });
  const c2b1 = await domaene({
    orgId: org.id, elternId: c2b.id, name: 'Abholstation Stadtmitte', typ: 'arbeitsdomaene',
    ziel: 'Die Abholstation in der Stadtmitte zuverlässig betreuen und als Treffpunkt lebendig halten.',
    tasks: ['Öffnungszeiten besetzen', 'Kisten und Rückgabe betreuen'],
    gegruendet: '2025-06-01',
  });
  await domaene({
    orgId: org.id, name: 'Aktionskreis Hoffest 2025', typ: 'arbeitsdomaene',
    ziel: 'Das Hoffest 2025 planen und durchführen.',
    tasks: ['Programm planen', 'Helfende koordinieren'],
    gegruendet: '2024-09-01', archiviert: true, archiviertAm: '2025-09-30',
  });

  // ---------------------------------------------------------------- Personen
  // 2FA bewusst überall AUS (bequemer Login; über den Toggle in „Mein Konto"
  // testbar). Genug Mitglieder, damit alle Domänen echte Teilhabenden-Zahlen haben.
  const lena = await person(org.id, passwortHash, {
    name: 'Lena Brandt', displayName: 'Lena B.', email: 'lena.brandt@solawi-rheintal.de',
    bg: '#C9DBD3', text: '#2C6152', admin: true, angelegt: '2023-09-01', pwGeaendert: '2026-01-10',
  });
  const sofia = await person(org.id, passwortHash, {
    name: 'Sofia Adler', displayName: 'Sofia A.', email: 'sofia.adler@solawi-rheintal.de',
    bg: '#C6D2DC', text: '#2f5a86', admin: true, angelegt: '2022-05-14', pwGeaendert: '2025-11-02',
  });
  const marek = await person(org.id, passwortHash, {
    name: 'Marek Kowalski', displayName: 'Marek K.', email: 'marek.kowalski@solawi-rheintal.de',
    bg: '#DCD7C5', text: '#7a6a2f', admin: false, angelegt: '2024-01-14', pwGeaendert: '2026-03-03',
  });
  const jamal = await person(org.id, passwortHash, {
    name: 'Jamal Reza', displayName: 'Jamal R.', email: 'jamal.reza@solawi-rheintal.de',
    bg: '#D8C7C6', text: '#8C2C28', admin: false, angelegt: '2024-03-02',
  });
  const hannah = await person(org.id, passwortHash, {
    name: 'Hannah Vogel', displayName: 'Hannah V.', email: 'hannah.vogel@solawi-rheintal.de',
    bg: '#D3DCC9', text: '#4a6a2f', admin: false, angelegt: '2022-06-20',
  });
  const paul = await person(org.id, passwortHash, {
    name: 'Paul Berger', displayName: 'Paul B.', email: 'paul.berger@solawi-rheintal.de',
    bg: '#C9D3DC', text: '#2f5a86', admin: false, angelegt: '2023-02-11',
  });
  const clara = await person(org.id, passwortHash, {
    name: 'Clara Weiss', displayName: 'Clara W.', email: 'clara.weiss@solawi-rheintal.de',
    bg: '#DCC9D3', text: '#86395f', admin: false, angelegt: '2023-05-30',
  });
  const david = await person(org.id, passwortHash, {
    name: 'David Schmid', displayName: 'David S.', email: 'david.schmid@solawi-rheintal.de',
    bg: '#DCD3C9', text: '#7a5a2f', admin: false, angelegt: '2022-09-14',
  });
  const elif = await person(org.id, passwortHash, {
    name: 'Elif Yılmaz', displayName: 'Elif Y.', email: 'elif.yilmaz@solawi-rheintal.de',
    bg: '#C9DCDA', text: '#2f6a66', admin: false, angelegt: '2024-05-06',
  });
  const bruno = await person(org.id, passwortHash, {
    name: 'Bruno Fischer', displayName: 'Bruno F.', email: 'bruno.fischer@solawi-rheintal.de',
    bg: '#D3C9DC', text: '#5a3a86', admin: false, angelegt: '2022-03-18',
  });
  const greta = await person(org.id, passwortHash, {
    name: 'Greta Lund', displayName: 'Greta L.', email: 'greta.lund@solawi-rheintal.de',
    bg: '#DCCFC9', text: '#86452f', admin: false, angelegt: '2023-08-22',
  });
  const noah = await person(org.id, passwortHash, {
    name: 'Noah Berg', displayName: 'Noah B.', email: 'noah.berg@solawi-rheintal.de',
    bg: '#CFDCD3', text: '#2f6a4e', admin: false, angelegt: '2023-11-03',
  });
  const ida = await person(org.id, passwortHash, {
    name: 'Ida Sommer', displayName: 'Ida S.', email: 'ida.sommer@solawi-rheintal.de',
    bg: '#DCDAC9', text: '#6a6a2f', admin: false, angelegt: '2024-02-27',
  });
  // Deaktiviert (behält historische Logbuch-Mitgliedschaft im Finanzkreis).
  await person(org.id, passwortHash, {
    name: 'Thomas Vogt', displayName: 'Thomas V.', email: 'thomas.vogt@solawi-rheintal.de',
    bg: '#D0D2CC', text: '#5C665E', admin: false, angelegt: '2021-11-20', aktiv: false,
    benachrichtigungen: false, thomasLogbuch: c1a.id, thomasLogbuchGegruendet: '2021-12-01',
  });
  // Eingeladen (noch kein Passwort gesetzt).
  await personEingeladen(org.id, {
    name: 'Nadia Hoffmann', displayName: 'Nadia H.', email: 'nadia.hoffmann@solawi-rheintal.de',
    bg: '#D5CBD8', text: '#6a4a86',
  });
  await personEingeladen(org.id, {
    name: 'Robert Kist', displayName: 'Robert K.', email: 'robert.kist@web.de',
    bg: '#CBD8CE', text: '#3a6a4e',
  });

  // Fester Demo-Login der öffentlichen Demo (Zugangsdaten werden auf Anfrage per
  // Mail verschickt). Admin → darf organisationsweit ansehen UND schreiben.
  // Eigenes Passwort, getrennt vom Sammel-Passwort der übrigen Konten.
  const demoHash = await argon2.hash('soziolog-demo1234', { type: argon2.argon2id });
  const demoZugang = await person(org.id, demoHash, {
    name: 'Demo-Zugang', displayName: 'Demo', email: 'demo-soziologer@solawi-rheintal.de',
    bg: '#E3D9F2', text: '#5a3a86', admin: true, angelegt: '2023-09-01',
  });
  await mitglied(demoZugang.id, c1.id, null);

  // ------------------------------------------------ Mitgliedschaften & Rollen
  // Genau eine Funktionsrolle pro (Person, Domäne); teilhabend = ohne Rolle.
  // Je Domäne 1× Moderation + 1× Logbuchführend (verschiedene Personen).
  // Allgemeiner Kreis
  await mitglied(hannah.id, c1.id, 'moderation');
  await mitglied(sofia.id, c1.id, 'logbuchfuehrer');
  await mitglied(lena.id, c1.id, 'delegierte');
  await mitglied(david.id, c1.id, 'delegierte');
  await mitglied(paul.id, c1.id, null);
  await mitglied(clara.id, c1.id, null);
  await mitglied(elif.id, c1.id, null);
  await mitglied(greta.id, c1.id, null);
  // Finanzkreis
  await mitglied(lena.id, c1a.id, 'moderation');
  await mitglied(sofia.id, c1a.id, 'logbuchfuehrer');
  await mitglied(paul.id, c1a.id, null);
  await mitglied(bruno.id, c1a.id, null);
  await mitglied(greta.id, c1a.id, null);
  // Öffentlichkeitskreis (Design: Lena, Marek, Jamal, Sofia)
  await mitglied(lena.id, c1b.id, 'moderation');
  await mitglied(marek.id, c1b.id, 'logbuchfuehrer');
  await mitglied(jamal.id, c1b.id, null);
  await mitglied(sofia.id, c1b.id, null);
  // Social-Media-Kreis
  await mitglied(clara.id, c1b1.id, 'moderation');
  await mitglied(marek.id, c1b1.id, 'logbuchfuehrer');
  await mitglied(elif.id, c1b1.id, null);
  // Personalkreis
  await mitglied(sofia.id, c1c.id, 'moderation');
  await mitglied(hannah.id, c1c.id, 'logbuchfuehrer');
  await mitglied(paul.id, c1c.id, null);
  await mitglied(ida.id, c1c.id, 'delegierte');
  // Anbaukreis (Jamal bleibt Teilhabend -> keine Logbuch-/Admin-Rolle)
  await mitglied(bruno.id, c2.id, 'moderation');
  await mitglied(david.id, c2.id, 'logbuchfuehrer');
  await mitglied(marek.id, c2.id, null);
  await mitglied(jamal.id, c2.id, null);
  await mitglied(noah.id, c2.id, null);
  await mitglied(ida.id, c2.id, null);
  await mitglied(greta.id, c2.id, 'delegierte');
  // Gemüse-Team
  await mitglied(bruno.id, c2a.id, 'moderation');
  await mitglied(noah.id, c2a.id, 'logbuchfuehrer');
  await mitglied(jamal.id, c2a.id, 'delegierte');
  await mitglied(david.id, c2a.id, null);
  await mitglied(ida.id, c2a.id, null);
  // Verteilkreis
  await mitglied(greta.id, c2b.id, 'moderation');
  await mitglied(noah.id, c2b.id, 'logbuchfuehrer');
  await mitglied(clara.id, c2b.id, null);
  // Saatgut-AG (dritte Ebene, gegründet 2025)
  await mitglied(ida.id, c2a1.id, 'moderation', '2025-02-10');
  await mitglied(noah.id, c2a1.id, 'logbuchfuehrer', '2025-02-10');
  await mitglied(david.id, c2a1.id, null, '2025-02-10');
  await mitglied(bruno.id, c2a1.id, null, '2025-03-04');
  // Abholstation Stadtmitte (dritte Ebene, gegründet 2025)
  await mitglied(clara.id, c2b1.id, 'moderation', '2025-06-01');
  await mitglied(greta.id, c2b1.id, 'logbuchfuehrer', '2025-06-01');
  await mitglied(elif.id, c2b1.id, null, '2025-06-01');

  // ------------------------------------------------------------- Vorschläge
  // Öffentlichkeitskreis – die vier ausdetaillierten Vorschläge (p1–p4).
  const p1 = await vorschlag({
    domaeneId: c1b.id, erfasstVonId: marek.id,
    titel: 'Auftritt auf Mastodon aufbauen', typ: 'governance', status: 'entschieden',
    datum: '2026-05-12',
    inhalt: 'Wir eröffnen einen offiziellen Mastodon-Account auf einer genossenschaftsnahen Instanz und pflegen ihn parallel zu bestehenden Kanälen. Ziel ist mehr Reichweite in der lokalen, netzpolitisch interessierten Community.',
  });
  await bedenken(p1.id, marek.id, 'Der Pflegeaufwand ist unklar. Wir sollten vorab ein realistisches Zeitbudget je Woche festlegen.', '2026-05-18');
  await bedenken(p1.id, lena.id, 'Mastodon-Instanzen können schließen. Ein Export-/Umzugsplan wäre sinnvoll.', '2026-05-19');
  await einwand(p1.id, jamal.id, 'Ohne feste Verantwortliche wird der Account verwaisen und schadet dem Bild der Genossenschaft.', 'schwerwiegend', '2026-05-20',
    'Der Öffentlichkeitskreis benennt zwei feste Redaktionsverantwortliche und legt ein wöchentliches Zeitbudget von je zwei Stunden fest.');
  await beschluss({
    vorschlagId: p1.id, erfasstVonId: marek.id,
    inhalt: 'Der Öffentlichkeitskreis richtet einen Mastodon-Account ein. Zwei benannte Verantwortliche pflegen ihn mit je zwei Stunden pro Woche; nach sechs Monaten wird der Kanal überprüft.',
    befristung: 'unbefristet', status: 'gueltig', gueltigAb: '2026-05-26',
  });

  const p2 = await vorschlag({
    domaeneId: c1b.id, erfasstVonId: marek.id,
    titel: 'Redaktionsplan für das dritte Quartal festlegen', typ: 'operativ', status: 'offen',
    datum: '2026-06-02',
    inhalt: 'Für Juli bis September brauchen wir einen abgestimmten Redaktionsplan: Themen, Verantwortliche und Veröffentlichungstermine je Kanal, damit Beiträge nicht kurzfristig entstehen müssen.',
  });
  await bedenken(p2.id, marek.id, 'Der Plan sollte flexibel bleiben — die Erntesaison ist schwer vorhersehbar und kann Themen verschieben.', '2026-06-04');

  await entschieden({
    domaeneId: c1b.id, erfasstVonId: lena.id,
    titel: 'Einheitliche Bildsprache für alle Kanäle', typ: 'operativ', datum: '2026-04-20',
    inhalt: 'Wir definieren eine gemeinsame Bildsprache — Farben, Bildstil und Vorlagen — damit unsere Beiträge über alle Kanäle hinweg als zusammengehörig erkennbar sind.',
    beschlussInhalt: 'Es wird eine schlichte, dokumentierte Bildsprache eingeführt: warme Naturtöne, echte Hoffotos statt Stockbilder, einheitliche Vorlagen im geteilten Ordner.',
    gueltigAb: '2026-04-28',
  });

  const p4 = await vorschlag({
    domaeneId: c1b.id, erfasstVonId: jamal.id,
    titel: 'Newsletter-Frequenz auf einmal monatlich reduzieren', typ: 'governance', status: 'offen',
    datum: '2026-06-28',
    inhalt: 'Der wöchentliche Newsletter bindet viel Zeit und die Öffnungsrate sinkt. Vorschlag: künftig nur noch einmal im Monat, dafür sorgfältiger kuratiert.',
  });
  await einwand(p4.id, jamal.id, 'Ein monatlicher Rhythmus ist zu selten für aktuelle Ernte-Infos und Abhol-Hinweise an die Mitglieder.', 'leicht', '2026-06-30', null);

  await entschieden({
    domaeneId: c1b.id, erfasstVonId: marek.id,
    titel: 'Website-Relaunch beauftragen', typ: 'operativ', datum: '2026-03-24',
    inhalt: 'Die Website ist veraltet und auf Mobilgeräten schwer bedienbar. Wir beauftragen einen schlanken Relaunch mit klarer Struktur und Anmeldeformular.',
    beschlussInhalt: 'Der Relaunch wird an ein regionales Kollektiv vergeben; Budget 3.500 €, Fertigstellung bis September.',
    gueltigAb: '2026-03-30',
  });

  // Allgemeiner Kreis
  await entschieden({
    domaeneId: c1.id, erfasstVonId: sofia.id, titel: 'Leitbild 2026 verabschieden',
    typ: 'governance', datum: '2026-01-15',
    inhalt: 'Aktualisierung des Leitbilds um die Schwerpunkte Klimaanpassung, Bildungsarbeit und faire Mitbestimmung.',
    beschlussInhalt: 'Das überarbeitete Leitbild 2026 wird angenommen und auf der Website veröffentlicht.',
    gueltigAb: '2026-01-25',
  });
  const pLeitbildAufgaben = await entschieden({
    domaeneId: c1.id, erfasstVonId: sofia.id, titel: 'Jahresziele 2026 festlegen',
    typ: 'governance', datum: '2026-02-09',
    inhalt: 'Drei Jahresziele: 20 neue Mitglieder gewinnen, Bewässerung modernisieren, Öffentlichkeitsarbeit stärken.',
    beschlussInhalt: 'Die drei Jahresziele werden beschlossen und quartalsweise überprüft.',
    gueltigAb: '2026-02-16',
  });
  await bedenken(pLeitbildAufgaben.id, hannah.id, 'Ohne zusätzliche Helfende sind alle drei Ziele gleichzeitig kaum zu schaffen.', '2026-02-11');
  await entschieden({
    domaeneId: c1.id, erfasstVonId: sofia.id, titel: 'Delegiertenordnung aktualisieren',
    typ: 'governance', datum: '2026-03-03',
    inhalt: 'Klarere Regeln, wie Delegierte aus den Unterkreisen in den Allgemeinen Kreis entsandt werden.',
    beschlussInhalt: 'Jeder Dauerkreis entsendet eine delegierte Person für ein Jahr; Wiederwahl möglich.',
    gueltigAb: '2026-03-12',
  });
  const pMV = await vorschlag({
    domaeneId: c1.id, erfasstVonId: sofia.id, titel: 'Mitgliederversammlung im Herbst planen',
    typ: 'operativ', status: 'offen', datum: '2026-06-18',
    inhalt: 'Termin, Ort und Tagesordnung für die jährliche Mitgliederversammlung im Oktober festlegen.',
  });
  await bedenken(pMV.id, lena.id, 'Ein Wochenendtermin schließt Berufstätige weniger aus — bitte nicht unter der Woche.', '2026-06-21');

  // Finanzkreis
  const pHaushalt = await entschieden({
    domaeneId: c1a.id, erfasstVonId: sofia.id, titel: 'Haushalt 2026 verabschieden',
    typ: 'governance', datum: '2026-02-05',
    inhalt: 'Verabschiedung des Jahreshaushalts 2026 inkl. Rücklagenplanung.',
    beschlussInhalt: 'Der Haushalt 2026 wird verabschiedet. Rücklage: 12 % des Jahresumsatzes.',
    gueltigAb: '2026-02-15',
  });
  await bedenken(pHaushalt.id, paul.id, 'Die Position „Instandhaltung" wirkt knapp kalkuliert — ein Puffer wäre sinnvoll.', '2026-02-08');
  await entschieden({
    domaeneId: c1a.id, erfasstVonId: sofia.id, titel: 'Rücklage auf 15 % erhöhen',
    typ: 'governance', datum: '2026-03-10',
    inhalt: 'Die Rücklage soll von 12 % auf 15 % des Jahresumsatzes erhöht werden.',
    beschlussInhalt: 'Die Rücklage wird auf 15 % erhöht.',
    befristung: 'befristet', status: 'ersetzt', gueltigAb: '2026-03-20', gueltigBis: '2026-06-20',
  });
  const pBeitrag = await entschieden({
    domaeneId: c1a.id, erfasstVonId: sofia.id, titel: 'Beitragsordnung 2026 anpassen',
    typ: 'governance', datum: '2026-01-24',
    inhalt: 'Staffelung der Solidaranteile transparenter machen und einen Mindestbeitrag festlegen.',
    beschlussInhalt: 'Die Beitragsordnung wird angepasst: drei Richtwerte plus frei wählbarer Solidaranteil.',
    gueltigAb: '2026-01-31',
  });
  await bedenken(pBeitrag.id, greta.id, 'Der Mindestbeitrag darf niemanden ausschließen, der wirklich mitmachen möchte.', '2026-01-28');
  await einwand(pBeitrag.id, paul.id, 'Ein fixer Mindestbeitrag kann Menschen mit geringem Einkommen faktisch ausschließen und widerspricht dem Solidarprinzip der Genossenschaft.', 'schwerwiegend', '2026-01-29',
    'Der Mindestbeitrag gilt nur als Richtwert; wer ihn nicht aufbringen kann, vereinbart vertraulich mit dem Finanzkreis einen individuell tragbaren Beitrag.');
  await vorschlag({
    domaeneId: c1a.id, erfasstVonId: sofia.id, titel: 'Quartalsbericht Q2 vorstellen',
    typ: 'operativ', status: 'offen', datum: '2026-06-14',
    inhalt: 'Aufbereitung der Einnahmen/Ausgaben des zweiten Quartals für die Mitglieder.',
  });

  // --- Demo: Lebenszyklus befristeter Beschlüsse (Finanzkreis) ---
  // (1) Befristet & gültig – Frist liegt in der Zukunft.
  await entschieden({
    domaeneId: c1a.id, erfasstVonId: sofia.id, titel: 'Bewirtungspauschale für Hoffeste',
    typ: 'operativ', datum: relTag(-40),
    inhalt: 'Eine pauschale Erstattung für Bewirtung bei Hoffesten, um Belege-Aufwand zu sparen.',
    beschlussInhalt: 'Pro Hoffest werden bis zu 150 € Bewirtung pauschal erstattet – zunächst befristet.',
    befristung: 'befristet', gueltigAb: relTag(-40), ueberpruefungsdatum: relTag(45),
  });

  // (2) Fällig / in Überprüfung – Frist erreicht, Teilhabende sind benachrichtigt.
  const pHandy = await vorschlag({
    domaeneId: c1a.id, erfasstVonId: sofia.id, titel: 'Diensthandy-Pauschale',
    typ: 'operativ', status: 'entschieden', datum: relTag(-200),
    inhalt: 'Eine monatliche Pauschale für dienstlich genutzte Privathandys der Koordination.',
  });
  const bHandy = await beschluss({
    vorschlagId: pHandy.id, erfasstVonId: sofia.id,
    inhalt: 'Für dienstlich genutzte Privathandys der Koordination gilt eine Pauschale von 15 €/Monat.',
    befristung: 'befristet', status: 'in_ueberpruefung',
    gueltigAb: relTag(-200), ueberpruefungsdatum: relTag(-3),
  });
  await ueberpruefungFaellig({
    beschlussId: bHandy.id, domaeneId: c1a.id, titel: 'Diensthandy-Pauschale',
    faelligAm: relTag(-3), empfaengerIds: [lena.id, sofia.id, paul.id, bruno.id, greta.id],
  });

  // (3) Ersetzte Kette – alter Beschluss abgelöst, Neufassung läuft weiter.
  const pFondsAlt = await vorschlag({
    domaeneId: c1a.id, erfasstVonId: sofia.id, titel: 'Sozialfonds-Speisung',
    typ: 'governance', status: 'entschieden', datum: relTag(-180),
    inhalt: 'Ein solidarischer Fonds für Mitglieder in finanziellen Notlagen, gespeist aus einem Umsatzanteil.',
  });
  const bFondsAlt = await beschluss({
    vorschlagId: pFondsAlt.id, erfasstVonId: sofia.id,
    inhalt: 'Der Sozialfonds wird mit 1 % vom Umsatz gespeist.',
    befristung: 'befristet', status: 'ersetzt',
    gueltigAb: relTag(-180), gueltigBis: relTag(-30), ueberpruefungsdatum: relTag(-33),
  });
  const pFondsNeu = await entschieden({
    domaeneId: c1a.id, erfasstVonId: sofia.id, titel: 'Sozialfonds-Speisung (Neufassung)',
    typ: 'governance', datum: relTag(-32),
    inhalt: '1 % reichten für die gestiegene Zahl an Anträgen nicht – der Anteil wird erhöht.',
    beschlussInhalt: 'Der Sozialfonds wird künftig mit 2 % vom Umsatz gespeist.',
    befristung: 'unbefristet', gueltigAb: relTag(-30), ersetztBeschlussId: bFondsAlt.id,
  });
  // Festes Datum (nicht relativ), damit die Monats-Statistik deterministisch bleibt.
  await bedenken(pFondsNeu.id, greta.id,
    'Bitte die Auswirkung des höheren Satzes nach einem Jahr im Haushalt prüfen.', '2026-05-20');

  // Social-Media-Kreis
  await entschieden({
    domaeneId: c1b1.id, erfasstVonId: marek.id, titel: 'Instagram-Konto eröffnen',
    typ: 'operativ', datum: '2026-04-05',
    inhalt: 'Ein Instagram-Konto für Ernte-Eindrücke und kurze Einblicke in die Feldarbeit.',
    beschlussInhalt: 'Das Konto @solawi.rheintal wird eröffnet; Clara und Elif betreuen es abwechselnd.',
    gueltigAb: '2026-04-12',
  });
  await entschieden({
    domaeneId: c1b1.id, erfasstVonId: marek.id, titel: 'Posting-Rhythmus festlegen',
    typ: 'operativ', datum: '2026-05-08',
    inhalt: 'Verlässlicher, aber machbarer Rhythmus für Beiträge, damit der Kanal lebendig bleibt.',
    beschlussInhalt: 'Zwei Beiträge pro Woche plus Stories während der Ernte.',
    gueltigAb: '2026-05-15',
  });
  const pReels = await vorschlag({
    domaeneId: c1b1.id, erfasstVonId: clara.id, titel: 'Kurze Reels zur Feldarbeit testen',
    typ: 'operativ', status: 'offen', datum: '2026-06-22',
    inhalt: 'Drei Wochen lang wöchentlich ein kurzes Reel produzieren und die Resonanz auswerten.',
  });
  await bedenken(pReels.id, elif.id, 'Videoschnitt kostet viel Zeit — wir sollten die Aufwände realistisch einschätzen.', '2026-06-24');

  // Personalkreis
  const pRollenwahl = await entschieden({
    domaeneId: c1c.id, erfasstVonId: hannah.id, titel: 'Rollenwahl Moderation',
    typ: 'governance', datum: '2026-03-14',
    inhalt: 'Wahl der Moderation für die kommende Amtszeit.',
    beschlussInhalt: 'Die Moderation wird für ein Jahr gewählt.',
    gueltigAb: '2026-03-22',
  });
  await entschieden({
    domaeneId: c1c.id, erfasstVonId: hannah.id, titel: 'Onboarding-Leitfaden einführen',
    typ: 'operativ', datum: '2026-02-18',
    inhalt: 'Ein kurzer Leitfaden, damit neue Mitglieder schnell reinkommen und ihre Rolle finden.',
    beschlussInhalt: 'Der Onboarding-Leitfaden wird eingeführt; jede neue Person bekommt eine Patin/einen Paten.',
    gueltigAb: '2026-02-26',
  });
  const pWeiterbildung = await entschieden({
    domaeneId: c1c.id, erfasstVonId: hannah.id, titel: 'Weiterbildungsbudget beschließen',
    typ: 'governance', datum: '2026-04-13',
    inhalt: 'Ein kleines Budget für Fortbildungen zu Anbau, Moderation und Buchhaltung.',
    beschlussInhalt: 'Jährlich 600 € Weiterbildungsbudget; Anträge werden im Personalkreis entschieden.',
    gueltigAb: '2026-04-20',
  });
  await bedenken(pWeiterbildung.id, ida.id, 'Bitte auch Online-Formate zulassen, damit weniger mobile Mitglieder profitieren.', '2026-04-16');

  // Anbaukreis
  await entschieden({
    domaeneId: c2.id, erfasstVonId: jamal.id, titel: 'Anbauplan Sommer 2026',
    typ: 'operativ', datum: '2026-04-08',
    inhalt: 'Anbauplan für die Sommersaison 2026 mit Kulturen, Flächen und Terminen.',
    beschlussInhalt: 'Aussaat der Kürbisse ab Mitte Mai.',
    gueltigAb: '2026-04-22',
  });
  await entschieden({
    domaeneId: c2.id, erfasstVonId: jamal.id, titel: 'Bewässerung auf Tröpfchen umstellen',
    typ: 'operativ', datum: '2026-06-01',
    inhalt: 'Umstellung der Feldbewässerung auf ein wassersparendes Tröpfchensystem.',
    beschlussInhalt: 'Es wird ein Tröpfchenbewässerungssystem eingeführt; nach der Saison wird evaluiert.',
    befristung: 'befristet', status: 'in_ueberpruefung', gueltigAb: '2026-06-10', ueberpruefungsdatum: '2026-10-01',
  });
  const pFruchtfolge = await entschieden({
    domaeneId: c2.id, erfasstVonId: jamal.id, titel: 'Fruchtfolge 2027 planen',
    typ: 'operativ', datum: '2026-05-25',
    inhalt: 'Fruchtfolge für die kommende Saison, um Boden zu schonen und Krankheiten vorzubeugen.',
    beschlussInhalt: 'Die Vierfelder-Fruchtfolge wird beschlossen; Leguminosen werden ausgeweitet.',
    gueltigAb: '2026-06-02',
  });
  await bedenken(pFruchtfolge.id, david.id, 'Bei den Starkzehrern sollten wir die Düngung genauer planen.', '2026-05-27');
  await einwand(pFruchtfolge.id, bruno.id, 'Der Zeitplan für die Gründüngung kollidiert mit der Kürbisernte.', 'leicht', '2026-05-28', null);
  const pSorten = await vorschlag({
    domaeneId: c2.id, erfasstVonId: jamal.id, titel: 'Sortenauswahl Tomaten erweitern',
    typ: 'operativ', status: 'offen', datum: '2026-06-17',
    inhalt: 'Zwei robuste, samenfeste Tomatensorten zusätzlich ins Programm nehmen.',
  });
  await bedenken(pSorten.id, noah.id, 'Neue Sorten brauchen mehr Anzuchtplätze — passt das in die Gärtnerei?', '2026-06-19');
  await vorschlag({
    domaeneId: c2.id, erfasstVonId: jamal.id, titel: 'Kompostierung auf dem Feld ausweiten',
    typ: 'operativ', status: 'offen', datum: '2026-07-01',
    inhalt: 'Zusätzliche Kompostmieten anlegen, um Grünschnitt vor Ort zu verwerten.',
  });

  // Gemüse-Team
  const pGemuese = await entschieden({
    domaeneId: c2a.id, erfasstVonId: jamal.id, titel: 'Erntehelfer-Plan Frühjahr',
    typ: 'operativ', datum: '2026-01-20',
    inhalt: 'Koordinationsplan für die Erntehelfenden im Frühjahr.',
    beschlussInhalt: 'Der Erntehelfer-Plan wird beschlossen.',
    gueltigAb: '2026-02-01',
  });
  await entschieden({
    domaeneId: c2a.id, erfasstVonId: noah.id, titel: 'Verteilrouten optimieren',
    typ: 'operativ', datum: '2026-03-12',
    inhalt: 'Die Fahrten zu den Abholstationen bündeln, um Wege und CO₂ zu sparen.',
    beschlussInhalt: 'Zwei Routen statt vier; Abfahrtszeiten werden angepasst.',
    gueltigAb: '2026-03-19',
  });
  const pAnteile = await vorschlag({
    domaeneId: c2a.id, erfasstVonId: noah.id, titel: 'Ernteanteile für 2027 anpassen',
    typ: 'operativ', status: 'offen', datum: '2026-06-09',
    inhalt: 'Größe und Preis der Ernteanteile an die gestiegenen Kosten und Mitgliederzahlen anpassen.',
  });
  await bedenken(pAnteile.id, ida.id, 'Kleine Haushalte sollten weiterhin einen halben Anteil wählen können.', '2026-06-12');

  // Verteilkreis
  await entschieden({
    domaeneId: c2b.id, erfasstVonId: noah.id, titel: 'Abholzeiten erweitern',
    typ: 'operativ', datum: '2026-04-02',
    inhalt: 'Ein zusätzlicher Abendtermin, damit Berufstätige die Ernte besser abholen können.',
    beschlussInhalt: 'Donnerstags zusätzlich 18–20 Uhr; wird nach drei Monaten überprüft.',
    gueltigAb: '2026-04-09',
  });
  await entschieden({
    domaeneId: c2b.id, erfasstVonId: noah.id, titel: 'Pfandsystem für Kisten einführen',
    typ: 'operativ', datum: '2026-05-16',
    inhalt: 'Ein einfaches Pfandsystem, damit weniger Transportkisten verloren gehen.',
    beschlussInhalt: '2 € Pfand pro Kiste; Rückgabe an jeder Abholstation.',
    gueltigAb: '2026-05-23',
  });
  // Beendeter befristeter Beschluss – der vierte Gültigkeitsstatus, damit im
  // Gesamt-Log alle vier Zustände (gültig, in Überprüfung, ersetzt, beendet)
  // vorkommen.
  await entschieden({
    domaeneId: c2b.id, erfasstVonId: noah.id, titel: 'Sonntags-Abholung testen',
    typ: 'operativ', datum: '2026-02-10',
    inhalt: 'Versuchsweise eine Abholmöglichkeit am Sonntagvormittag, um Familien mit Wochenendrhythmus zu erreichen.',
    beschlussInhalt: 'Von März bis Mai wird sonntags von 10–12 Uhr zusätzlich ausgegeben; danach wird entschieden, ob es bleibt.',
    befristung: 'befristet', status: 'beendet',
    gueltigAb: '2026-02-17', gueltigBis: '2026-05-31', ueberpruefungsdatum: '2026-05-31',
  });
  await bedenken(pAnteile.id, greta.id, 'Bitte die Preise erst nach der Ernteauswertung im Herbst festlegen, sonst rechnen wir mit Schätzwerten.', '2026-07-08');

  // Saatgut-AG (dritte Ebene)
  const pSaatgut = await entschieden({
    domaeneId: c2a1.id, erfasstVonId: noah.id, titel: 'Eigene Saatgutvermehrung starten',
    typ: 'governance', datum: '2026-07-06',
    inhalt: 'Wir vermehren drei samenfeste Sorten selbst, statt sie jedes Jahr zuzukaufen — das spart Kosten und macht uns unabhängiger.',
    beschlussInhalt: 'Die Saatgut-AG vermehrt ab der Saison 2027 Tomate, Buschbohne und Palmkohl in Eigenregie; die Fläche stellt das Gemüse-Team.',
    gueltigAb: '2026-07-20',
  });
  await bedenken(pSaatgut.id, david.id, 'Sortenreinheit braucht Abstand zwischen den Beeten — das muss in die Flächenplanung, sonst kreuzen die Sorten aus.', '2026-07-09');
  await einwand(pSaatgut.id, ida.id, 'Ohne trockenen, frostfreien Lagerraum verdirbt das Saatgut über den Winter und die ganze Arbeit ist umsonst.', 'schwerwiegend', '2026-07-12',
    'Das Gemüse-Team stellt bis Oktober den hinteren Teil der Scheune als Saatgutlager her; die Saatgut-AG richtet ihn ein.');
  const pTausch = await vorschlag({
    domaeneId: c2a1.id, erfasstVonId: noah.id, titel: 'Saatgut-Tauschring mit Nachbarhöfen',
    typ: 'operativ', status: 'offen', datum: '2026-08-10',
    inhalt: 'Zweimal jährlich Saatgut mit drei benachbarten Solawis tauschen, um die Sortenvielfalt ohne Zukauf zu vergrößern.',
  });
  await bedenken(pTausch.id, bruno.id, 'Wir sollten vorher klären, wie wir mit Sorten umgehen, deren Herkunft unklar ist.', '2026-08-13');

  // Abholstation Stadtmitte (dritte Ebene)
  await entschieden({
    domaeneId: c2b1.id, erfasstVonId: greta.id, titel: 'Feste Schichtplanung für die Station',
    typ: 'operativ', datum: '2026-06-25',
    inhalt: 'Die Öffnungszeiten werden bisher spontan besetzt — das führt regelmäßig zu Lücken am Freitagnachmittag.',
    beschlussInhalt: 'Die Schichten werden vier Wochen im Voraus im Logbuch festgehalten; wer eine Schicht nicht halten kann, sucht selbst Ersatz.',
    gueltigAb: '2026-07-02',
  });
  const pKuehl = await vorschlag({
    domaeneId: c2b1.id, erfasstVonId: greta.id, titel: 'Kühlschrank für empfindliches Gemüse anschaffen',
    typ: 'operativ', status: 'offen', datum: '2026-08-04',
    inhalt: 'An warmen Tagen leidet Blattgemüse zwischen Anlieferung und Abholung sichtbar. Ein gebrauchter Gewerbekühlschrank würde das lösen.',
  });
  await bedenken(pKuehl.id, clara.id, 'Der Stromverbrauch eines alten Geräts kann die Ersparnis schnell auffressen — bitte vorher nachrechnen.', '2026-08-07');
  await einwand(pKuehl.id, elif.id, 'Für ein Gerät dieser Größe fehlt an der Station ein eigener Stromkreis.', 'leicht', '2026-08-12', null);

  // Aktuelle Vorgänge in bestehenden Kreisen (Juli/August 2026)
  const pWasser = await vorschlag({
    domaeneId: c2.id, erfasstVonId: david.id, titel: 'Notfallplan für Trockenperioden',
    typ: 'governance', status: 'offen', datum: '2026-08-11',
    inhalt: 'Nach zwei trockenen Sommern brauchen wir eine verbindliche Reihenfolge, welche Kulturen bei Wasserknappheit zuerst versorgt werden.',
  });
  await bedenken(pWasser.id, marek.id, 'Der Plan sollte auch festlegen, wer im Ernstfall kurzfristig entscheiden darf — sonst diskutieren wir, während das Feld vertrocknet.', '2026-08-14');
  await entschieden({
    domaeneId: c1.id, erfasstVonId: sofia.id, titel: 'Hoffest 2026 terminieren',
    typ: 'operativ', datum: '2026-07-14',
    inhalt: 'Termin und Rahmen für das diesjährige Hoffest festlegen, damit die Kreise ihre Beiträge planen können.',
    beschlussInhalt: 'Das Hoffest findet am 12. September 2026 statt; jeder Dauerkreis gestaltet einen Programmpunkt.',
    gueltigAb: '2026-07-21',
  });
  // Bedenken im März, damit die Monatsstatistik keine Lücke hat.
  await bedenken(pRollenwahl.id, paul.id, 'Eine einjährige Amtszeit ist kurz — die Einarbeitung dauert allein schon ein Quartal.', '2026-03-16');

  // ----------------------------------------------------------- Korrekturen
  // Erledigte Anträge (Korrekturen-Log): bestätigt + abgelehnt. Dazu genau EIN
  // offener Antrag, damit die Verwaltung den Bestätigen/Ablehnen-Schritt zeigt.
  const beschlussP1 = await prisma.beschluss.findFirstOrThrow({ where: { vorschlagId: p1.id } });
  await korrektur({
    zielTyp: 'beschluss', zielId: beschlussP1.id, feld: 'inhalt',
    alt: '… nach sechs Monaten wird der Kanal überprüft.', neu: '… nach vier Monaten wird der Kanal überprüft.',
    status: 'bestaetigt', name: 'Marek Kowalski', vonId: marek.id, domaene: 'Öffentlichkeitskreis',
    beantragtAm: '2026-06-26', entschiedenAm: '2026-06-28', entschiedenVon: sofia.id, entschiedenName: 'Sofia Adler',
  });
  const bedenkenP1 = await prisma.bedenken.findFirstOrThrow({ where: { vorschlagId: p1.id } });
  await korrektur({
    zielTyp: 'bedenken', zielId: bedenkenP1.id, feld: 'inhalt',
    alt: 'Der Pflegeaufwand ist unklar.', neu: 'Der Pflegeaufwand ist zu hoch — Account vorerst nicht eröffnen.',
    status: 'abgelehnt', name: 'Jonas Weber', domaene: 'Öffentlichkeitskreis',
    beantragtAm: '2026-06-23', entschiedenAm: '2026-06-25', entschiedenVon: sofia.id, entschiedenName: 'Sofia Adler',
    ablehnungsgrund: 'Ändert die inhaltliche Aussage des Bedenkens, statt einen Tippfehler zu korrigieren. Bitte als neues Bedenken einbringen.',
  });
  // Zweiter bestätigter Antrag (Anbaukreis) — zeigt, dass Korrekturen überall
  // vorkommen, nicht nur im Öffentlichkeitskreis.
  const vAnbauplan = await prisma.vorschlag.findFirstOrThrow({
    where: { titel: 'Anbauplan Sommer 2026', domaene: { organisationId: org.id } },
  });
  const bAnbauplan = await prisma.beschluss.findFirstOrThrow({ where: { vorschlagId: vAnbauplan.id } });
  await korrektur({
    zielTyp: 'beschluss', zielId: bAnbauplan.id, feld: 'inhalt',
    alt: 'Aussaat der Kürbisse ab Mitte Mai.', neu: 'Aussaat der Kürbisse ab Anfang Juni.',
    status: 'bestaetigt', name: 'David Schmid', vonId: david.id, domaene: 'Anbaukreis',
    begruendung: 'Im Protokoll stand der Termin der Vorbesprechung. Beschlossen wurde laut Sitzungsnotiz Anfang Juni.',
    beantragtAm: '2026-07-10', entschiedenAm: '2026-07-13', entschiedenVon: lena.id, entschiedenName: 'Lena Brandt',
  });
  // Offener Antrag: liegt den Admins zur Entscheidung vor.
  const vAbholzeiten = await prisma.vorschlag.findFirstOrThrow({
    where: { titel: 'Abholzeiten erweitern', domaene: { organisationId: org.id } },
  });
  const bAbholzeiten = await prisma.beschluss.findFirstOrThrow({ where: { vorschlagId: vAbholzeiten.id } });
  const offenerAntrag = await korrektur({
    zielTyp: 'beschluss', zielId: bAbholzeiten.id, feld: 'inhalt',
    alt: 'Donnerstags zusätzlich 18–20 Uhr; wird nach drei Monaten überprüft.',
    neu: 'Donnerstags zusätzlich 17–19 Uhr; wird nach drei Monaten überprüft.',
    status: 'offen', name: 'Noah Berg', vonId: noah.id, domaene: 'Verteilkreis',
    begruendung: 'Übertragungsfehler aus dem Sitzungsprotokoll: beschlossen wurden 17–19 Uhr, weil die Station um 19 Uhr schließt.',
    beantragtAm: relTag(-5),
  });
  await korrekturBenachrichtigung({
    korrekturId: offenerAntrag.id, domaeneId: c2b.id, beantragtAm: relTag(-5),
    inhalt: 'Neuer Korrekturantrag von Noah Berg zum Beschluss „Abholzeiten erweitern" (Verteilkreis).',
    empfaengerIds: [lena.id, sofia.id],
  });

  const [personen, domaenen, vorschlaege, beschluesse, korrekturen] = await Promise.all([
    prisma.person.count({ where: { organisationId: org.id } }),
    prisma.domaene.count({ where: { organisationId: org.id } }),
    prisma.vorschlag.count({ where: { domaene: { organisationId: org.id } } }),
    prisma.beschluss.count({ where: { vorschlag: { domaene: { organisationId: org.id } } } }),
    prisma.korrekturantrag.count({ where: { OR: [{ beantragtVon: { organisationId: org.id } }, { beantragtVonId: null }] } }),
  ]);
  console.log('Seed erfolgreich: Genossenschaft Solawi Rheintal (echte Daten) —');
  console.log(`  ${domaenen} Domänen (1 archiviert), ${personen} Personen,`);
  console.log(`  ${vorschlaege} Vorschläge, ${beschluesse} Beschlüsse, ${korrekturen} Korrekturanträge.`);
}

// --------------------------------------------------------------- Helfer

async function domaene(opts: {
  orgId: string; elternId?: string; name: string;
  typ: 'dauerdomaene' | 'arbeitsdomaene'; ziel: string; tasks: string[];
  gegruendet: string; archiviert?: boolean; archiviertAm?: string;
}) {
  return prisma.domaene.create({
    data: {
      organisationId: opts.orgId,
      elternDomaeneId: opts.elternId ?? null,
      name: opts.name, ziel: opts.ziel, tasks: opts.tasks, typ: opts.typ,
      gegruendetAm: d(opts.gegruendet),
      archiviert: opts.archiviert ?? false,
      archiviertAm: opts.archiviertAm ? d(opts.archiviertAm) : null,
      aktiv: !(opts.archiviert ?? false),
    },
  });
}

async function person(orgId: string, passwortHash: string, o: {
  name: string; displayName: string; email: string; bg: string; text: string;
  admin: boolean; angelegt: string; aktiv?: boolean; benachrichtigungen?: boolean;
  pwGeaendert?: string; thomasLogbuch?: string; thomasLogbuchGegruendet?: string;
}) {
  const p = await prisma.person.create({
    data: {
      organisationId: orgId,
      name: o.name, displayName: o.displayName,
      nutzername: o.email.split('@')[0],
      loginEmail: o.email, passwortHash,
      passwortGeaendertAm: o.pwGeaendert ? d(o.pwGeaendert) : null,
      istAdmin: o.admin, aktiv: o.aktiv ?? true,
      benachrichtigungenAktiv: o.benachrichtigungen ?? true,
      angelegtAm: d(o.angelegt),
      avatarColor: o.bg, avatarTextColor: o.text,
    },
  });
  // Deaktivierter Thomas Vogt behält seine (historische) Logbuch-Mitgliedschaft.
  if (o.thomasLogbuch) {
    await prisma.mitgliedschaft.create({
      data: { personId: p.id, domaeneId: o.thomasLogbuch, gueltigAb: d(o.thomasLogbuchGegruendet ?? o.angelegt) },
    });
    await prisma.rollenzuweisung.create({
      data: { personId: p.id, domaeneId: o.thomasLogbuch, rolleTyp: 'logbuchfuehrer', gueltigAb: d(o.thomasLogbuchGegruendet ?? o.angelegt) },
    });
  }
  return p;
}

async function personEingeladen(orgId: string, o: {
  name: string; displayName: string; email: string; bg: string; text: string;
}) {
  const p = await prisma.person.create({
    data: {
      organisationId: orgId,
      name: o.name, displayName: o.displayName,
      nutzername: o.email.split('@')[0],
      loginEmail: o.email, passwortHash: null, // eingeladen = noch kein Passwort
      istAdmin: false, aktiv: true, angelegtAm: d('2026-06-15'),
      avatarColor: o.bg, avatarTextColor: o.text,
    },
  });
  await prisma.einladung.create({
    data: {
      personId: p.id, tokenHash: 'seed-invite-' + p.id,
      laeuftAbAm: d('2026-12-31'), status: 'offen',
    },
  });
  return p;
}

async function mitglied(
  personId: string,
  domaeneId: string,
  rolle: 'moderation' | 'logbuchfuehrer' | 'delegierte' | null,
  /** Beitritt; Standard 2024-01-14. Bei später gegründeten Domänen mitgeben,
   *  damit niemand vor der Gründung seines Kreises Mitglied ist. */
  ab = '2024-01-14',
) {
  await prisma.mitgliedschaft.create({ data: { personId, domaeneId, gueltigAb: d(ab) } });
  if (rolle) {
    await prisma.rollenzuweisung.create({ data: { personId, domaeneId, rolleTyp: rolle, gueltigAb: d(ab) } });
  }
}

async function vorschlag(o: {
  domaeneId: string; erfasstVonId: string; titel: string; inhalt: string;
  typ: 'governance' | 'operativ'; status: 'offen' | 'entschieden'; datum: string;
  ersetztBeschlussId?: string;
}) {
  return prisma.vorschlag.create({
    data: {
      domaeneId: o.domaeneId, erfasstVonId: o.erfasstVonId,
      titel: o.titel, inhalt: o.inhalt,
      governanceTyp: o.typ, status: o.status, datum: d(o.datum),
      ersetztBeschlussId: o.ersetztBeschlussId ?? null,
    },
  });
}

/** Vorschlag + zugehöriger Beschluss in einem Schritt (entschieden). */
async function entschieden(o: {
  domaeneId: string; erfasstVonId: string; titel: string; inhalt: string;
  typ: 'governance' | 'operativ'; datum: string; beschlussInhalt: string;
  gueltigAb: string; befristung?: 'befristet' | 'unbefristet';
  status?: 'gueltig' | 'in_ueberpruefung' | 'ersetzt' | 'beendet';
  gueltigBis?: string; ueberpruefungsdatum?: string;
  /** Löst diesen Beschluss ab (Neufassung): setzt Vorschlag- und Beschluss-Bezug. */
  ersetztBeschlussId?: string;
}) {
  const v = await vorschlag({
    domaeneId: o.domaeneId, erfasstVonId: o.erfasstVonId,
    titel: o.titel, inhalt: o.inhalt, typ: o.typ, status: 'entschieden', datum: o.datum,
    ersetztBeschlussId: o.ersetztBeschlussId,
  });
  await beschluss({
    vorschlagId: v.id, erfasstVonId: o.erfasstVonId, inhalt: o.beschlussInhalt,
    befristung: o.befristung ?? 'unbefristet', status: o.status ?? 'gueltig',
    gueltigAb: o.gueltigAb, gueltigBis: o.gueltigBis, ueberpruefungsdatum: o.ueberpruefungsdatum,
    ersetztBeschlussId: o.ersetztBeschlussId,
  });
  return v;
}

async function bedenken(vorschlagId: string, erfasstVonId: string, inhalt: string, datum: string) {
  await prisma.bedenken.create({ data: { vorschlagId, erfasstVonId, inhalt, datum: d(datum) } });
}

async function einwand(vorschlagId: string, erfasstVonId: string, inhalt: string, schweregrad: 'leicht' | 'schwerwiegend', datum: string, integration: string | null) {
  await prisma.einwand.create({ data: { vorschlagId, erfasstVonId, inhalt, schweregrad, integration, datum: d(datum) } });
}

async function beschluss(o: {
  vorschlagId: string; erfasstVonId: string; inhalt: string;
  befristung: 'befristet' | 'unbefristet';
  status: 'gueltig' | 'in_ueberpruefung' | 'ersetzt' | 'beendet';
  gueltigAb: string; gueltigBis?: string; ueberpruefungsdatum?: string;
  ersetztBeschlussId?: string;
}) {
  return prisma.beschluss.create({
    data: {
      vorschlagId: o.vorschlagId, erfasstVonId: o.erfasstVonId, inhalt: o.inhalt,
      befristung: o.befristung, gueltigkeitStatus: o.status,
      gueltigAb: d(o.gueltigAb), gueltigBis: o.gueltigBis ? d(o.gueltigBis) : null,
      ueberpruefungsdatum: o.ueberpruefungsdatum ? d(o.ueberpruefungsdatum) : null,
      datum: d(o.gueltigAb),
      ersetztBeschlussId: o.ersetztBeschlussId ?? null,
    },
  });
}

/** Legt eine „Überprüfung fällig"-Benachrichtigung samt Empfängen an (Demo). */
async function ueberpruefungFaellig(o: {
  beschlussId: string; domaeneId: string; titel: string; faelligAm: string;
  empfaengerIds: string[];
}) {
  const b = await prisma.benachrichtigung.create({
    data: {
      typ: 'ueberpruefung_faellig',
      betrifftBeschlussId: o.beschlussId,
      domaeneId: o.domaeneId,
      inhalt: `Befristeter Beschluss läuft aus: „${o.titel}" (Frist ${o.faelligAm}). Bitte erneut bestätigen, ersetzen oder beenden.`,
      erstelltAm: d(o.faelligAm),
      faelligAm: d(o.faelligAm),
    },
  });
  await prisma.benachrichtigungEmpfang.createMany({
    data: o.empfaengerIds.map((personId) => ({ benachrichtigungId: b.id, personId, gelesen: false })),
  });
}

/** Benachrichtigt die Admins über einen offenen Korrekturantrag (Demo). */
async function korrekturBenachrichtigung(o: {
  korrekturId: string; domaeneId: string; inhalt: string; beantragtAm: string;
  empfaengerIds: string[];
}) {
  const b = await prisma.benachrichtigung.create({
    data: {
      typ: 'korrektur_beantragt',
      betrifftKorrekturId: o.korrekturId,
      domaeneId: o.domaeneId,
      inhalt: o.inhalt,
      erstelltAm: d(o.beantragtAm),
    },
  });
  await prisma.benachrichtigungEmpfang.createMany({
    data: o.empfaengerIds.map((personId) => ({ benachrichtigungId: b.id, personId, gelesen: false })),
  });
}

async function korrektur(o: {
  zielTyp: 'vorschlag' | 'bedenken' | 'einwand' | 'beschluss'; zielId: string; feld: string;
  alt: string; neu: string; status: 'offen' | 'bestaetigt' | 'abgelehnt';
  name: string; vonId?: string; domaene: string; beantragtAm: string; begruendung?: string;
  entschiedenAm?: string; entschiedenVon?: string; entschiedenName?: string; ablehnungsgrund?: string;
}) {
  return prisma.korrekturantrag.create({
    data: {
      zielTyp: o.zielTyp, zielId: o.zielId, feld: o.feld,
      alterInhalt: o.alt, neuerInhalt: o.neu, status: o.status,
      begruendung: o.begruendung ?? null,
      beantragtVonId: o.vonId ?? null,
      beantragtVonName: o.name, beantragtVonRolle: 'Logbuchführend', beantragtVonDomaene: o.domaene,
      beantragtAm: d(o.beantragtAm),
      bestaetigtVonId: o.entschiedenVon ?? null,
      bestaetigtVonName: o.entschiedenName ?? null,
      entschiedenAm: o.entschiedenAm ? d(o.entschiedenAm) : null,
      ablehnungsgrund: o.ablehnungsgrund ?? null,
    },
  });
}

/** Löscht eine Organisation samt aller abhängigen Datensätze (FK-sicher). */
async function raeumeOrgAuf(orgId: string) {
  const domaenen = await prisma.domaene.findMany({ where: { organisationId: orgId }, select: { id: true } });
  const domaeneIds = domaenen.map((x) => x.id);
  const personen = await prisma.person.findMany({ where: { organisationId: orgId }, select: { id: true } });
  const personIds = personen.map((p) => p.id);
  const vorschlaege = await prisma.vorschlag.findMany({ where: { domaeneId: { in: domaeneIds } }, select: { id: true } });
  const vorschlagIds = vorschlaege.map((v) => v.id);

  await prisma.benachrichtigungEmpfang.deleteMany({ where: { personId: { in: personIds } } });
  await prisma.benachrichtigung.deleteMany({ where: { OR: [{ domaeneId: { in: domaeneIds } }, { betrifftBeschluss: { vorschlagId: { in: vorschlagIds } } }, { betrifftKorrektur: { OR: [{ beantragtVonId: { in: personIds } }, { beantragtVonId: null }] } }] } });
  await prisma.korrekturantrag.deleteMany({ where: { OR: [{ beantragtVonId: { in: personIds } }, { beantragtVonId: null }] } });
  await prisma.beschluss.deleteMany({ where: { vorschlagId: { in: vorschlagIds } } });
  await prisma.vorschlag.deleteMany({ where: { id: { in: vorschlagIds } } });
  await prisma.rollenzuweisung.deleteMany({ where: { OR: [{ personId: { in: personIds } }, { domaeneId: { in: domaeneIds } }] } });
  await prisma.mitgliedschaft.deleteMany({ where: { OR: [{ personId: { in: personIds } }, { domaeneId: { in: domaeneIds } }] } });
  await prisma.sitzung.deleteMany({ where: { domaeneId: { in: domaeneIds } } });
  await prisma.einladung.deleteMany({ where: { personId: { in: personIds } } });
  await prisma.passwortReset.deleteMany({ where: { personId: { in: personIds } } });
  await prisma.domaene.updateMany({ where: { id: { in: domaeneIds } }, data: { elternDomaeneId: null } });
  await prisma.domaene.deleteMany({ where: { id: { in: domaeneIds } } });
  await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  await prisma.organisation.delete({ where: { id: orgId } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
