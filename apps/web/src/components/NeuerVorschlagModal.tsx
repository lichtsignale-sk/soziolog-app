import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { VorschlagDTO } from '@soziolog/shared';
import { apiFetch, ApiError } from '../lib/api-client';
import { Dialog, Eingabefeld, Knopf } from '@soziolog/ui';

const schema = z.object({
  titel: z.string().min(1, 'Titel erforderlich.'),
  inhalt: z.string().min(1, 'Inhalt erforderlich.'),
  governanceTyp: z.enum(['governance', 'operativ']),
});
type Formular = z.infer<typeof schema>;

const FELD_KLASSE =
  'w-full rounded-lg border border-rahmen bg-flaeche px-3 py-2 text-text placeholder:text-leise focus:border-primaer focus:outline-none';

const TYPEN = [
  { wert: 'operativ' as const, label: 'Operativ' },
  { wert: 'governance' as const, label: 'Governance' },
];

/** Modal zum Anlegen eines neuen Vorschlags (ersetzt die frühere eigene Seite). */
export function NeuerVorschlagModal({
  offen,
  domaeneId,
  ersetztBeschlussId,
  onSchliessen,
  onErstellt,
}: {
  offen: boolean;
  domaeneId: string;
  /** Gesetzt, wenn der Vorschlag eine Neufassung ist (löst einen Beschluss ab). */
  ersetztBeschlussId?: string;
  onSchliessen: () => void;
  onErstellt: (vorschlag: VorschlagDTO) => void;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Formular>({
    resolver: zodResolver(schema),
    defaultValues: { governanceTyp: 'operativ' },
  });
  const typ = watch('governanceTyp');

  function schliessen() {
    setFehler(null);
    reset();
    onSchliessen();
  }

  const absenden = handleSubmit(async (daten) => {
    setFehler(null);
    try {
      const v = await apiFetch<VorschlagDTO>(`/api/domaenen/${domaeneId}/vorschlaege`, {
        method: 'POST',
        body: JSON.stringify({ ...daten, ersetztBeschlussId }),
      });
      reset();
      onErstellt(v);
    } catch (e) {
      setFehler(e instanceof ApiError ? e.fehler.nachricht : 'Anlegen fehlgeschlagen.');
    }
  });

  return (
    <Dialog
      offen={offen}
      eyebrow={ersetztBeschlussId ? 'Neufassung' : 'Neuer Vorschlag'}
      titel={ersetztBeschlussId ? 'Beschluss durch Neufassung ersetzen' : 'Idee protokollieren'}
      onSchliessen={schliessen}
      groesse="lg"
      fussleiste={
        <>
          <Knopf type="button" variante="sekundaer" onClick={schliessen}>
            Abbrechen
          </Knopf>
          <Knopf type="submit" form="neuer-vorschlag-form" laedt={isSubmitting}>
            Vorschlag anlegen
          </Knopf>
        </>
      }
    >
      <form id="neuer-vorschlag-form" onSubmit={absenden} noValidate>
        {ersetztBeschlussId && (
          <p className="mb-4 rounded-lg border border-beschluss-rahmen/40 bg-beschluss-bg px-3 py-2.5 text-sm text-beschluss-text">
            Diese Neufassung ersetzt den bisherigen Beschluss, sobald hier ein neuer Beschluss
            gefasst wird. Bis dahin bleibt der alte Beschluss gültig.
          </p>
        )}
        <Eingabefeld
          label="Titel"
          placeholder="Kurz und prägnant"
          fehler={errors.titel?.message}
          {...register('titel')}
        />
        <div className="mb-4 text-left">
          <label htmlFor="inhalt" className="mb-1 block text-sm font-medium text-text">
            Inhalt
          </label>
          <textarea
            id="inhalt"
            rows={5}
            placeholder="Beschreibe deinen Vorschlag ausführlich…"
            className={`${FELD_KLASSE} font-serif`}
            {...register('inhalt')}
          />
          {errors.inhalt && <p className="mt-1 text-sm text-gefahr">{errors.inhalt.message}</p>}
        </div>
        <div className="mb-4 text-left">
          <p className="mb-1 text-sm font-medium text-text">Typ</p>
          <input type="hidden" {...register('governanceTyp')} />
          <div className="grid grid-cols-2 gap-3">
            {TYPEN.map((t) => {
              const aktiv = typ === t.wert;
              return (
                <button
                  key={t.wert}
                  type="button"
                  onClick={() => setValue('governanceTyp', t.wert, { shouldDirty: true })}
                  aria-pressed={aktiv}
                  className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    aktiv
                      ? 'border-primaer bg-primaer-soft text-primaer-softtext'
                      : 'border-rahmen bg-flaeche text-text hover:bg-flaeche-3'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 rounded-lg bg-flaeche-2 px-3 py-2.5 text-sm text-leise">
            Operative Vorschläge betreffen konkrete Maßnahmen und Aufgaben. Governance-Vorschläge
            betreffen Strukturen, Rollen oder Regeln der Domäne.
          </p>
        </div>
        {fehler && (
          <p className="mb-4 text-sm text-gefahr" role="alert">
            {fehler}
          </p>
        )}
      </form>
    </Dialog>
  );
}
