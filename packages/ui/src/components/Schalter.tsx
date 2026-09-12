/**
 * Barrierefreier Kippschalter (Toggle) im Design der Vorgabe: grün, wenn an,
 * mit gleitendem Knopf. `role="switch"` + `aria-checked` für Screenreader.
 * Der Klick meldet den GEWÜNSCHTEN neuen Zustand über `onUmschalten`; die
 * eigentliche Zustandsführung (inkl. Bestätigungs-Dialog beim Ausschalten)
 * bleibt beim Aufrufer.
 */
export function Schalter({
  an,
  onUmschalten,
  disabled,
  label,
}: {
  an: boolean;
  onUmschalten: (neu: boolean) => void;
  disabled?: boolean;
  /** Zugängliche Beschriftung (aria-label), falls kein sichtbares <label>. */
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-label={label}
      disabled={disabled}
      onClick={() => onUmschalten(!an)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        an ? 'bg-primaer' : 'bg-flaeche-3 ring-1 ring-inset ring-rahmen'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          an ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
