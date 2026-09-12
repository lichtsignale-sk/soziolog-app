import { useAuth } from '../context/AuthContext';

/**
 * Schmaler Hinweisstreifen ganz oben, sichtbar nur wenn die Instanz als
 * öffentliche Demo läuft (DEMO_MODE=1 → status.demoModus). Macht transparent,
 * dass Änderungen nicht dauerhaft sind.
 */
export function DemoBanner() {
  const { demoModus } = useAuth();
  if (!demoModus) return null;
  return (
    <div
      role="status"
      className="w-full border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
    >
      <span aria-hidden="true">🔄 </span>
      <span className="font-semibold">Demo-Umgebung.</span>{' '}
      Probier alles aus – alle Änderungen werden{' '}
      <span className="font-semibold">stündlich automatisch zurückgesetzt</span>.
    </div>
  );
}
