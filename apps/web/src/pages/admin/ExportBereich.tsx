import { useState } from 'react';
import { Download } from 'lucide-react';
import type { ExportStartAntwort } from '@soziolog/shared';
import { apiFetch, ApiError } from '../../lib/api-client';
import { useToast, Knopf } from '@soziolog/ui';

/** Verwaltungs-Reiter „Export": org-weiter PDF-Gesamt-Export (asynchron, per Mail). */
export function ExportBereich() {
  const toast = useToast();
  const [laedt, setLaedt] = useState(false);

  async function gesamtExport() {
    setLaedt(true);
    try {
      const antwort = await apiFetch<ExportStartAntwort>('/api/export/organisation/pdf', {
        method: 'POST',
      });
      toast.zeige(`Der Gesamt-Export wird erstellt und an ${antwort.email} geschickt.`);
    } catch (e) {
      toast.zeige(
        e instanceof ApiError ? e.fehler.nachricht : 'Export konnte nicht angefragt werden.',
        'fehler',
      );
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-serif text-xl font-bold text-text">Gesamt-Export</h2>
      <p className="mt-2 text-sm text-leise">
        Erzeugt ein PDF mit allen Vorschlägen und Beschlüssen der gesamten Organisation
        über alle Domänen. Weil das je nach Größe etwas dauern kann, wird es im Hintergrund
        erstellt und dir per E-Mail zugeschickt.
      </p>
      <p className="mt-1 text-sm text-leise">
        Einzelne Beschlüsse und ganze Domänen kannst du direkt in der jeweiligen Ansicht
        über „PDF-Export" herunterladen.
      </p>
      <Knopf variante="primaer" laedt={laedt} onClick={gesamtExport} className="mt-4">
        <Download className="h-4 w-4" aria-hidden="true" />
        Gesamt-Export anfragen
      </Knopf>
    </div>
  );
}
