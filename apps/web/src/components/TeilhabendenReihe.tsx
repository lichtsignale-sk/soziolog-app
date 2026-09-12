import type { DomaeneMitgliedNameDTO } from '@soziolog/shared';
import { initialen, avatarStil } from '../lib/avatar';

function Avatar({
  name,
  avatarColor,
  avatarTextColor,
}: {
  name: string;
  avatarColor: string | null;
  avatarTextColor: string | null;
}) {
  const stil = avatarStil(name, avatarColor, avatarTextColor);
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${stil.className}`}
      style={stil.style}
      aria-hidden="true"
    >
      {initialen(name)}
    </div>
  );
}

/**
 * Teilhabenden-Anzeige im Domänen-Log-Kopf: „TEILHABENDE"-Eyebrow und eine
 * umbrechende Reihe aus Avatar + Name (personenspezifische Farben aus Seed/
 * Profil, sonst deterministisch).
 */
export function TeilhabendenReihe({ mitglieder }: { mitglieder: DomaeneMitgliedNameDTO[] }) {
  if (mitglieder.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 font-sans text-xs font-semibold uppercase tracking-wide text-leise">
        Teilhabende
      </h2>
      <ul className="flex flex-wrap gap-x-5 gap-y-3">
        {mitglieder.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <Avatar
              name={m.name}
              avatarColor={m.avatarColor}
              avatarTextColor={m.avatarTextColor}
            />
            <span className="text-sm text-text">{m.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
