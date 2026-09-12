import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { apiUpload, ApiError } from '../lib/api-client';
import { initialen, avatarStil } from '../lib/avatar';
import { useToast } from '@soziolog/ui';
import { AvatarZuschneidenModal } from './AvatarZuschneidenModal';

/**
 * Großer Profil-Avatar mit Kamera-Button zum Hochladen eines Fotos. Nach der
 * Auswahl öffnet sich ein Zuschneide-Modal (runder, quadratischer Ausschnitt mit
 * Zoom); erst danach wird das Bild hochgeladen. Zeigt das hochgeladene Bild oder
 * – als Fallback – die Initialen auf farbigem Grund.
 */
export function AvatarUpload({
  name,
  avatarUrl,
  avatarColor,
  avatarTextColor,
  onHochgeladen,
}: {
  name: string;
  avatarUrl: string | null;
  avatarColor?: string | null;
  avatarTextColor?: string | null;
  onHochgeladen: () => Promise<void> | void;
}) {
  const toast = useToast();
  const dateiRef = useRef<HTMLInputElement>(null);
  const [laedt, setLaedt] = useState(false);
  const [zuschneidenDatei, setZuschneidenDatei] = useState<File | null>(null);
  const apiBasis = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';

  function dateiGewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    // Erlaubt erneute Auswahl derselben Datei (onChange feuert sonst nicht).
    if (dateiRef.current) dateiRef.current.value = '';
    if (datei) setZuschneidenDatei(datei);
  }

  async function hochladen(blob: Blob) {
    const formular = new FormData();
    formular.append('datei', blob, 'avatar.webp');
    setLaedt(true);
    try {
      await apiUpload('/api/konto/avatar', formular);
      await onHochgeladen();
      setZuschneidenDatei(null);
      toast.zeige('Profilbild aktualisiert.');
    } catch (err) {
      toast.zeige(
        err instanceof ApiError ? err.fehler.nachricht : 'Upload fehlgeschlagen.',
        'fehler',
      );
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="relative h-[104px] w-[104px]">
      {avatarUrl ? (
        <img
          src={`${apiBasis}${avatarUrl}`}
          alt={`Profilbild von ${name}`}
          className="h-[104px] w-[104px] rounded-full object-cover"
        />
      ) : (
        (() => {
          const stil = avatarStil(name, avatarColor, avatarTextColor);
          return (
            <div
              className={`flex h-[104px] w-[104px] items-center justify-center rounded-full text-3xl font-semibold ${stil.className}`}
              style={stil.style}
              aria-hidden="true"
            >
              {initialen(name)}
            </div>
          );
        })()
      )}
      <button
        type="button"
        onClick={() => dateiRef.current?.click()}
        disabled={laedt}
        aria-label="Profilbild ändern"
        className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border border-rahmen bg-flaeche text-primaer shadow-karte hover:bg-flaeche-3 disabled:opacity-50"
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        ref={dateiRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={dateiGewaehlt}
      />

      <AvatarZuschneidenModal
        datei={zuschneidenDatei}
        offen={zuschneidenDatei !== null}
        onSchliessen={() => setZuschneidenDatei(null)}
        onFertig={hochladen}
        laedt={laedt}
      />
    </div>
  );
}
