# Erst-Setup & Einladungen

## Reihenfolge
1. Datenbankverbindung kommt VOR dem ersten Start über Umgebungsvariablen
   (.env / Docker), nicht über ein Web-Formular.
2. Beim ersten Start mit leerer/uninitialisierter DB läuft ein geführter
   Setup-Assistent, der erfasst:
   - SMTP-Zugangsdaten (Host, Port, Benutzer, Passwort, Absender)
   - Organisationsname
   - mindestens einen Hauptkreis (Name, Ziel, Domäne)
   - die 3 Startpersonen: 1 Admin, 1 Moderator, 1 Teilhabender (je Name + E-Mail)
3. Der Assistent verschickt an die 3 Personen eine Einladungs-E-Mail mit
   signiertem Einmal-Token. Darüber legen sie ihren Account an (Passwort setzen)
   und erhalten die vom Admin zugewiesene Rolle.
4. Nach Abschluss wird organisation.setupAbgeschlossen = true gesetzt; der
   Assistent ist gesperrt und nicht erneut aufrufbar (idempotent).

## Hinweise
- Der Moderator ist eine soziokratische Funktionsrolle im Hauptkreis; der Admin
  ist die organisationsweite Berechtigung. Eine Person kann beides sein.
- Token: nur den HASH speichern, Ablaufdatum (7 Tage) setzen, Einmalgebrauch erzwingen.
