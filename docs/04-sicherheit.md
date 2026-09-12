# Sicherheit (pragmatischer Weg, kein Zero-Knowledge)

- Passwörter: Argon2id-Hash, nie im Klartext.
- Transport: TLS. Sichere Header: HSTS, CSP, X-Frame-Options, X-Content-Type.
- Sessions/Token: httpOnly + Secure + SameSite-Cookies; CSRF-Schutz.
- Passwort-vergessen: signierte, ablaufende Einmal-Token per E-Mail.
- Brute-Force: Rate-Limiting + Backoff auf Login und Passwort-Reset.
- Autorisierung: serverseitige Guards bei JEDER schreibenden Aktion. Nie dem
  Client vertrauen.
- Injection/XSS: Prisma (parametrisiert) gegen SQL-Injection; Output-Encoding
  im Frontend; Eingabevalidierung (z. B. zod) an der API-Grenze.
- Account-Selbstverwaltung: Nutzer dürfen NUR eigene E-Mail, Name, Nutzername,
  Passwort ändern und Benachrichtigungen an/aus schalten. Anlegen/Löschen von
  Nutzern ausschließlich durch Admin.
- Benachrichtigungen aus: bewusster Hinweis, dass dann auch fällige
  Überprüfungen NICHT per E-Mail kommen, sondern nur im System erscheinen.
- Secrets nur in Umgebungsvariablen. Verschlüsselte Backups. Ruheverschlüsselung
  der DB/des Volumes.
- 2-Faktor optional später vorbereitbar.
