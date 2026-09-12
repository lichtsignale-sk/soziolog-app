# Ansichten (Kurzfassung — Details folgen in Teil 3 des Umsetzungsplans)

Alle Ansichten sind Linsen auf dieselbe Datenbasis; keine speichert eigene Daten.

- **Domänen-Karte**: große Fläche, Kreise als anklickbare Knoten inkl.
  Verschachtelung; Klick führt in den Domänen-Log.
- **Domänen-Log**: eine Domäne im Detail (Vorschlag/Bedenken/Einwände/
  Integration/Beschluss, farbcodiert, mit Gültigkeit).
- **Gesamt-Log (Gantt)**: alle Domänen, vertikal scrollbar, farblich getrennt,
  Beschlüsse als Zeilen mit Gültigkeitsspannen; Modus "Verlauf" und Modus
  "Stand zum Stichtag" (Schieberegler).
- **Statistik**: Nutzer je Domäne; Bedenken je Monat; Domänen mit vielen/wenigen
  Bedenken+Einwänden; Domänen mit vielen/wenigen Entscheidungen.
- **Admin-Verwaltung**: Personen anlegen/löschen, Kreise pflegen, Rollen
  zuweisen; Korrekturanträge bestätigen.
- **Änderungslog**: für alle Teilhabenden lesbar (wer/wann/was bei Korrekturen).
- **Konto**: eigene Daten ändern, Benachrichtigungen schalten, eigene
  Kreise+Rollen einsehen.

## Design-System & Entscheidungen (Schritt 9)

**Tokens** (Tailwind v4, CSS-first in `apps/web/src/index.css`): semantische
CSS-Variablen, die im Dunkelmodus über `prefers-color-scheme` automatisch
umschalten (helles + dunkles Theme, beide WCAG AA). Chrome/Brand = Slate-Neutrals
+ **Indigo** als Primär-/Fokusfarbe (bewusst NICHT Blau, damit Blau exklusiv
„Vorschlag" bleibt). Typografie: **Inter** (variabel, Tabellenziffern für
Datum/Zahlen). Abstände 4/8-Raster, Radien, Elevation als Tokens.

**Eintragsfarben** (docs/03) mit Label **und** Icon — Farbe ist nie das alleinige
Signal (`lib/farben.ts` → `EintragAbzeichen`):
- Vorschlag = blau (FileText), Bedenken = gelb (AlertCircle),
  leichter Einwand = hellrot (AlertTriangle),
  schwerwiegender Einwand = dunkelrot (ShieldAlert),
  Beschluss = grün (CheckCircle2).

**Komponenten** (`apps/web/src/components/ui/`): Karte, Knopf, Abzeichen,
EintragAbzeichen, Eingabefeld, **DatumFeld** (natives `input[type=date]`, gibt/
nimmt ausschließlich `YYYY-MM-DD`, keine Uhrzeit), Dialog (Fokusfalle/Esc/Scrim),
Toast (`aria-live`), Tabelle, Reiter (Tabs), Tooltip (Hover **und** Fokus),
LeerZustand, Ladeanzeige (Spinner/Skeleton).

**App-Shell** (`components/AppShell.tsx`): Skip-Link, Kopfbereich mit
angemeldeter Person + Rollen-Label (Admin/Protokollführer/Teilhabender) + Logout;
adaptive Navigation (Desktop-Sidebar ≥`lg`, mobil Drawer). Ziele: Domänen-Karte
(Start), Gesamt-Log, Statistik, Änderungslog, Konto, **Admin-Verwaltung (nur für
Admins)**. Sichtbarkeit ≠ Autorisierung — die serverseitigen Guards bleiben die
Absicherung.

**Barrierefreiheit:** sichtbare Fokusringe, `aria`-Attribute, Tastaturbedienung,
`prefers-reduced-motion`, AA-Kontraste in hell und dunkel. Vorschauseite unter
`/designsystem`.
