import { Construction } from 'lucide-react';
import { LeerZustand } from '@soziolog/ui';

/** Platzhalter für Bereiche, die in einem späteren Schritt gebaut werden. */
export function PlatzhalterSeite({ titel }: { titel: string }) {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-text">{titel}</h1>
      <LeerZustand
        Icon={Construction}
        titel="Diese Ansicht folgt in einem späteren Schritt."
        hinweis="Das UI-Fundament steht; der Inhalt dieses Bereichs wird als Nächstes gebaut."
      />
    </div>
  );
}
