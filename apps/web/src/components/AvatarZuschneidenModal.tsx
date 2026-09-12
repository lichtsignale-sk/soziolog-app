import { useCallback, useEffect, useMemo, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, Knopf } from '@soziolog/ui';

/** Zielkantenlänge des zugeschnittenen Avatars (der Server verkleinert ebenso). */
const ZIEL_GROESSE = 512;

/** Lädt ein Bild aus einer Objekt-URL. */
function ladeBild(src: string): Promise<HTMLImageElement> {
  return new Promise((aufloesen, ablehnen) => {
    const bild = new Image();
    bild.addEventListener('load', () => aufloesen(bild));
    bild.addEventListener('error', ablehnen);
    bild.src = src;
  });
}

/** Rendert den gewählten Ausschnitt in ein quadratisches WebP-Blob. */
async function schneideAus(src: string, bereich: Area): Promise<Blob> {
  const bild = await ladeBild(src);
  const canvas = document.createElement('canvas');
  canvas.width = ZIEL_GROESSE;
  canvas.height = ZIEL_GROESSE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar.');
  ctx.drawImage(
    bild,
    bereich.x,
    bereich.y,
    bereich.width,
    bereich.height,
    0,
    0,
    ZIEL_GROESSE,
    ZIEL_GROESSE,
  );
  return new Promise((aufloesen, ablehnen) => {
    canvas.toBlob(
      (blob) => (blob ? aufloesen(blob) : ablehnen(new Error('Kein Blob.'))),
      'image/webp',
      0.9,
    );
  });
}

/**
 * Modal zum Zuschneiden eines Profilbilds: quadratischer, runder Ausschnitt mit
 * Zoom und Verschieben (react-easy-crop). „Übernehmen" liefert den fertigen
 * WebP-Ausschnitt an den Aufrufer, der ihn hochlädt.
 */
export function AvatarZuschneidenModal({
  datei,
  offen,
  onSchliessen,
  onFertig,
  laedt,
}: {
  datei: File | null;
  offen: boolean;
  onSchliessen: () => void;
  onFertig: (blob: Blob) => Promise<void> | void;
  laedt?: boolean;
}) {
  const bildUrl = useMemo(() => (datei ? URL.createObjectURL(datei) : null), [datei]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [bereich, setBereich] = useState<Area | null>(null);

  // Objekt-URL wieder freigeben, wenn die Datei wechselt/das Modal schließt.
  useEffect(() => {
    return () => {
      if (bildUrl) URL.revokeObjectURL(bildUrl);
    };
  }, [bildUrl]);

  // Beim Öffnen mit neuer Datei Zoom/Position zurücksetzen.
  useEffect(() => {
    if (offen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [offen, datei]);

  const beiCropFertig = useCallback((_flaeche: Area, pixel: Area) => {
    setBereich(pixel);
  }, []);

  async function uebernehmen() {
    if (!bildUrl || !bereich) return;
    const blob = await schneideAus(bildUrl, bereich);
    await onFertig(blob);
  }

  return (
    <Dialog
      offen={offen}
      titel="Profilbild zuschneiden"
      onSchliessen={onSchliessen}
      groesse="lg"
      fussleiste={
        <div className="flex justify-end gap-2">
          <Knopf variante="ghost" onClick={onSchliessen}>
            Abbrechen
          </Knopf>
          <Knopf onClick={uebernehmen} laedt={laedt} disabled={!bereich}>
            Übernehmen
          </Knopf>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-leise">
          Ziehe das Bild zum Verschieben und nutze den Regler zum Zoomen. Der
          gewählte Ausschnitt wird als rundes Profilbild gespeichert.
        </p>
        <div className="relative h-72 w-full overflow-hidden rounded-xl bg-black">
          {bildUrl && (
            <Cropper
              image={bildUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={beiCropFertig}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <ZoomOut className="h-4 w-4 shrink-0 text-leise" aria-hidden="true" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="h-1.5 w-full cursor-pointer accent-[var(--farbe-primaer)]"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-leise" aria-hidden="true" />
        </div>
      </div>
    </Dialog>
  );
}
