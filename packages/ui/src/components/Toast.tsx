import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type ToastTyp = 'erfolg' | 'fehler';
interface ToastEintrag {
  id: number;
  nachricht: string;
  typ: ToastTyp;
}

interface ToastKontext {
  zeige: (nachricht: string, typ?: ToastTyp) => void;
}

const Kontext = createContext<ToastKontext | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<ToastEintrag[]>([]);

  const entferne = useCallback((id: number) => {
    setListe((l) => l.filter((t) => t.id !== id));
  }, []);

  const zeige = useCallback(
    (nachricht: string, typ: ToastTyp = 'erfolg') => {
      const id = Date.now() + Math.random();
      setListe((l) => [...l, { id, nachricht, typ }]);
      // Auto-Dismiss nach 4 s.
      setTimeout(() => entferne(id), 4000);
    },
    [entferne],
  );

  return (
    <Kontext.Provider value={{ zeige }}>
      {children}
      {/* aria-live=polite: kündigt an, ohne den Fokus zu stehlen. */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {liste.map((t) => {
          const Icon = t.typ === 'erfolg' ? CheckCircle2 : AlertCircle;
          return (
            <div
              key={t.id}
              role="status"
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-karte ${
                t.typ === 'erfolg'
                  ? 'border-beschluss-rahmen bg-beschluss-bg text-beschluss-text'
                  : 'border-einwand-rahmen bg-einwand-bg text-einwand-text'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{t.nachricht}</span>
              <button
                onClick={() => entferne(t.id)}
                aria-label="Schließen"
                className="ml-1 opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </Kontext.Provider>
  );
}

export function useToast(): ToastKontext {
  const ctx = useContext(Kontext);
  if (!ctx) throw new Error('useToast muss innerhalb von <ToastProvider> genutzt werden.');
  return ctx;
}
