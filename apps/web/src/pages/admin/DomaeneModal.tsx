import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import type { DomaeneKnotenDTO, AdminPersonDTO, RolleTyp, DomaeneTyp } from '@soziolog/shared';
import { MAX_UNTER_UNTER_DOMAENEN, domaeneEbene } from '@soziolog/shared';
import { apiFetch, ApiError } from '../../lib/api-client';
import { ROLLEN, ROLLEN_LABEL } from '../../lib/rollen';
import { Dialog, Knopf, Eingabefeld, Auswahl, useToast } from '@soziolog/ui';

interface BesetzungZeile {
  personId: string;
  rolleTyp: RolleTyp | '';
}

/** Prüft die Gründungsregel a clientseitig (Server bleibt die harte Instanz). */
function regelAHinweis(besetzung: BesetzungZeile[]): string | null {
  const eindeutige = new Set(besetzung.map((b) => b.personId).filter(Boolean));
  if (eindeutige.size < 3) {
    return `Mindestens 3 verschiedene Personen nötig (aktuell ${eindeutige.size}).`;
  }
  const moderatoren = besetzung.filter((b) => b.personId && b.rolleTyp === 'moderation');
  const logbuchfuehrer = besetzung.filter((b) => b.personId && b.rolleTyp === 'logbuchfuehrer');
  if (moderatoren.length === 0)
    return `Es fehlt eine Person mit der Rolle „${ROLLEN_LABEL.moderation}".`;
  if (logbuchfuehrer.length === 0)
    return `Es fehlt eine Person mit der Rolle „${ROLLEN_LABEL.logbuchfuehrer}".`;
  const getrennt = moderatoren.some((m) => logbuchfuehrer.every((l) => l.personId !== m.personId));
  if (!getrennt)
    return `„${ROLLEN_LABEL.moderation}" und „${ROLLEN_LABEL.logbuchfuehrer}" müssen unterschiedliche Personen sein.`;
  return null;
}

/**
 * Modal zum Anlegen oder Bearbeiten einer Domäne (M6). Name, Art (Buttons),
 * übergeordnete Domäne, Ziel (Pflicht) und die Aufgabenliste als nummerierte
 * Zeilen (min. 1, max. 10). Beim Anlegen zusätzlich die Startbesetzung
 * (Gründungsregel a). Speichern ist gesperrt, bis Ziel und ≥1 Aufgabe gesetzt
 * sind (beim Anlegen zusätzlich Regel a erfüllt).
 */
export function DomaeneModal({
  modus,
  domaene,
  domaenen,
  personen,
  onGespeichert,
  onSchliessen,
}: {
  modus: 'anlegen' | 'bearbeiten';
  domaene?: DomaeneKnotenDTO;
  domaenen: DomaeneKnotenDTO[];
  personen: AdminPersonDTO[];
  onGespeichert: () => void;
  onSchliessen: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(domaene?.name ?? '');
  const [typ, setTyp] = useState<DomaeneTyp>(domaene?.typ ?? 'dauerdomaene');
  const [elternId, setElternId] = useState(domaene?.elternDomaeneId ?? '');
  const [ziel, setZiel] = useState(domaene?.ziel ?? '');
  const [aufgaben, setAufgaben] = useState<string[]>(
    domaene?.tasks?.length ? domaene.tasks : [''],
  );
  const [besetzung, setBesetzung] = useState<BesetzungZeile[]>([
    { personId: '', rolleTyp: '' },
    { personId: '', rolleTyp: '' },
    { personId: '', rolleTyp: '' },
  ]);
  const [sendet, setSendet] = useState(false);

  const gefuellteAufgaben = aufgaben.map((a) => a.trim()).filter(Boolean);
  const regelHinweis = modus === 'anlegen' ? regelAHinweis(besetzung) : null;
  const gueltig = ziel.trim().length > 0 && gefuellteAufgaben.length >= 1 && !regelHinweis;

  // Übergeordnete Domäne wählbar, wenn sie eine gültige Verschachtelung erlaubt:
  // Ebene 2 (Unter-Unterdomäne) scheidet aus (keine vierte Ebene), ebenso eine
  // Ebene-1-Domäne, die bereits die Höchstzahl an Unter-Unterdomänen hat.
  // Beim Bearbeiten ist die Auswahl deaktiviert – dann nur die Anzeige bedienen.
  const elternVon = (id: string) =>
    domaenen.find((d) => d.id === id)?.elternDomaeneId ?? null;
  const aktiveKinder = (id: string) =>
    domaenen.filter((d) => !d.archiviert && d.elternDomaeneId === id).length;
  const elternOptionen = domaenen.filter((k) => {
    if (k.archiviert || k.id === domaene?.id) return false;
    if (modus === 'bearbeiten') return true;
    const ebene = domaeneEbene(k.id, elternVon);
    if (ebene >= 2) return false;
    if (ebene === 1 && aktiveKinder(k.id) >= MAX_UNTER_UNTER_DOMAENEN) return false;
    return true;
  });

  async function speichern() {
    if (!gueltig) return;
    setSendet(true);
    try {
      if (modus === 'anlegen') {
        await apiFetch('/api/admin/domaenen', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            ziel: ziel.trim(),
            tasks: gefuellteAufgaben,
            typ,
            elternDomaeneId: elternId || undefined,
            besetzung: besetzung
              .filter((b) => b.personId)
              .map((b) => ({ personId: b.personId, rolleTyp: b.rolleTyp || undefined })),
          }),
        });
        toast.zeige('Domäne angelegt.');
      } else if (domaene) {
        await apiFetch(`/api/admin/domaenen/${domaene.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            ziel: ziel.trim(),
            tasks: gefuellteAufgaben,
            typ,
          }),
        });
        toast.zeige('Domäne gespeichert.');
      }
      onGespeichert();
      onSchliessen();
    } catch (e) {
      toast.zeige(
        e instanceof ApiError ? e.fehler.nachricht : 'Speichern fehlgeschlagen.',
        'fehler',
      );
    } finally {
      setSendet(false);
    }
  }

  return (
    <Dialog
      offen
      groesse="lg"
      eyebrow={modus === 'anlegen' ? 'Domäne anlegen' : 'Domäne bearbeiten'}
      titel={modus === 'anlegen' ? 'Neue Domäne' : (domaene?.name ?? '')}
      onSchliessen={onSchliessen}
      fussleiste={
        <div className="flex justify-end gap-2">
          <Knopf variante="sekundaer" onClick={onSchliessen}>
            Abbrechen
          </Knopf>
          <Knopf laedt={sendet} disabled={!gueltig} onClick={speichern}>
            {modus === 'anlegen' ? 'Domäne anlegen' : 'Speichern'}
          </Knopf>
        </div>
      }
    >
      <div className="space-y-5">
        <Eingabefeld
          label="Name der Domäne"
          placeholder="z. B. Bildungskreis"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* Art der Domäne */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-text">Art der Domäne</p>
          <div className="flex gap-2">
            {(['dauerdomaene', 'arbeitsdomaene'] as DomaeneTyp[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTyp(t)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  typ === t
                    ? 'border-primaer bg-primaer text-primaer-text'
                    : 'border-rahmen bg-flaeche text-leise hover:bg-flaeche-3'
                }`}
              >
                {t === 'dauerdomaene' ? 'Dauerdomäne' : 'Arbeitsdomäne'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-leise">
            Dauerdomänen bestehen langfristig, Arbeitsdomänen werden für eine
            Aufgabe gebildet und später archiviert.
          </p>
        </div>

        {/* Übergeordnete Domäne */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">
            Übergeordnete Domäne
          </label>
          <Auswahl
            value={elternId}
            disabled={modus === 'bearbeiten'}
            onChange={(e) => setElternId(e.target.value)}
          >
            <option value="">— Keine (Hauptdomäne)</option>
            {elternOptionen.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </Auswahl>
          {modus === 'bearbeiten' && (
            <p className="mt-1 text-xs text-leise">
              Die Verschachtelung kann nachträglich nicht geändert werden.
            </p>
          )}
        </div>

        {/* Ziel der Domäne */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">Ziel der Domäne</label>
          <textarea
            rows={3}
            value={ziel}
            onChange={(e) => setZiel(e.target.value)}
            placeholder="Wofür ist diese Domäne verantwortlich? Eine klare Zielformulierung."
            className="block w-full rounded-lg border border-rahmen bg-flaeche px-3 py-2 font-serif text-sm text-read placeholder:font-sans placeholder:text-leise focus:border-primaer focus:outline-none"
          />
          <p className="mt-1 text-xs text-leise">
            Erscheint in der Domänenübersicht dieser Domäne.
          </p>
        </div>

        {/* Aufgaben der Domäne – nummerierte Zeilen */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-sm font-medium text-text">Aufgaben der Domäne</p>
            <span className="ziffern-tabellarisch text-xs text-leise">{aufgaben.length} / 10</span>
          </div>
          <div className="space-y-2">
            {aufgaben.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="ziffern-tabellarisch grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primaer-soft text-sm font-semibold text-primaer-softtext">
                  {i + 1}
                </span>
                <input
                  value={a}
                  onChange={(e) =>
                    setAufgaben((liste) => liste.map((x, idx) => (idx === i ? e.target.value : x)))
                  }
                  aria-label={`Aufgabe ${i + 1}`}
                  placeholder="Aufgabe beschreiben"
                  className="flex-1 rounded-lg border border-rahmen bg-flaeche px-3 py-2 text-sm text-text placeholder:text-leise focus:border-primaer focus:outline-none"
                />
                {aufgaben.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Aufgabe ${i + 1} entfernen`}
                    onClick={() => setAufgaben((liste) => liste.filter((_, idx) => idx !== i))}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-leise hover:bg-flaeche-3 hover:text-text"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {aufgaben.length < 10 && (
            <Knopf
              variante="sekundaerGruen"
              className="mt-2"
              onClick={() => setAufgaben((liste) => [...liste, ''])}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Aufgabe hinzufügen
            </Knopf>
          )}
        </div>

        {/* Startbesetzung (nur beim Anlegen – Gründungsregel a) */}
        {modus === 'anlegen' && (
          <div className="rounded-xl border border-rahmen bg-flaeche-2 p-4">
            <p className="text-sm font-semibold text-text">Startbesetzung</p>
            <p className="mb-3 mt-0.5 text-xs text-leise">
              Mind. 3 Personen, davon je 1× {ROLLEN_LABEL.moderation} und 1×{' '}
              {ROLLEN_LABEL.logbuchfuehrer}.
            </p>
            <div className="space-y-2">
              {besetzung.map((zeile, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="ziffern-tabellarisch grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primaer-soft text-sm font-semibold text-primaer-softtext">
                    {i + 1}
                  </span>
                  <Auswahl
                    className="min-w-0 flex-1"
                    aria-label={`Person für Startbesetzung, Zeile ${i + 1}`}
                    value={zeile.personId}
                    onChange={(e) =>
                      setBesetzung((b) =>
                        b.map((z, idx) => (idx === i ? { ...z, personId: e.target.value } : z)),
                      )
                    }
                  >
                    <option value="">– Person wählen –</option>
                    {personen.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Auswahl>
                  <Auswahl
                    aria-label={`Rolle für Startbesetzung, Zeile ${i + 1}`}
                    value={zeile.rolleTyp}
                    onChange={(e) =>
                      setBesetzung((b) =>
                        b.map((z, idx) =>
                          idx === i ? { ...z, rolleTyp: e.target.value as RolleTyp | '' } : z,
                        ),
                      )
                    }
                  >
                    <option value="">Teilhabend</option>
                    {ROLLEN.map((r) => (
                      <option key={r} value={r}>
                        {ROLLEN_LABEL[r]}
                      </option>
                    ))}
                  </Auswahl>
                  {besetzung.length > 3 && (
                    <button
                      type="button"
                      aria-label={`Startbesetzung Zeile ${i + 1} entfernen`}
                      onClick={() => setBesetzung((b) => b.filter((_, idx) => idx !== i))}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-rahmen bg-flaeche text-leise hover:bg-flaeche-3 hover:text-text"
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Knopf
              variante="sekundaerGruen"
              className="mt-3"
              onClick={() => setBesetzung((b) => [...b, { personId: '', rolleTyp: '' }])}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Person hinzufügen
            </Knopf>
            {regelHinweis && (
              <p className="mt-3 text-sm text-gefahr" role="alert">
                {regelHinweis}
              </p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
