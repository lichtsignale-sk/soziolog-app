const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';

export interface ApiFehler {
  code: string;
  nachricht: string;
  detail?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly fehler: ApiFehler,
    public readonly status: number,
  ) {
    super(fehler.nachricht);
    this.name = 'ApiError';
  }
}

function zeigeToast(nachricht: string) {
  console.error('[API-Fehler]', nachricht);
}

const SICHERE_METHODEN = new Set(['GET', 'HEAD', 'OPTIONS']);

let csrfToken: string | null = null;

/** Liest ein Cookie im Browser (Fallback für das nicht-httpOnly csrf-Cookie). */
function leseCookie(name: string): string | null {
  const treffer = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`));
  return treffer ? decodeURIComponent(treffer.split('=')[1]) : null;
}

/**
 * Holt (falls nötig) ein CSRF-Token vom Server und cacht es. Setzt zugleich das
 * csrf-Cookie. Beim App-Start einmal aufrufen.
 */
export async function holeCsrf(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/csrf`, {
    credentials: 'include',
  });
  const body = (await res.json()) as { csrfToken: string };
  csrfToken = body.csrfToken;
  return csrfToken;
}

async function csrfHeaderWert(): Promise<string> {
  const ausCookie = leseCookie('csrf');
  if (ausCookie) {
    csrfToken = ausCookie;
    return ausCookie;
  }
  if (csrfToken) return csrfToken;
  return holeCsrf();
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const methode = (options?.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };

  // CSRF-Token bei schreibenden Requests mitsenden (Double-Submit).
  if (!SICHERE_METHODEN.has(methode)) {
    headers['x-csrf-token'] = await csrfHeaderWert();
  }

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    credentials: 'include', // Session- und CSRF-Cookie immer mitschicken
    ...options,
    headers,
  });

  if (!res.ok) {
    let fehler: ApiFehler = {
      code: `HTTP_${res.status}`,
      nachricht: `Serverfehler (${res.status})`,
    };
    try {
      const body = (await res.json()) as { fehler?: ApiFehler };
      if (body?.fehler) fehler = body.fehler;
    } catch {
      // Body nicht parsbar — Fallback behalten
    }
    if (import.meta.env['VITE_DEBUG'] === '1') {
      console.debug('[apiFetch] Fehler:', fehler);
    }
    zeigeToast(fehler.nachricht);
    throw new ApiError(fehler, res.status);
  }

  // 204/leere Antworten sauffangen.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Lädt eine Binärdatei (z. B. PDF) per GET herunter und speichert sie im
 * Browser. `apiFetch` scheidet aus, weil es Antworten immer als JSON parst.
 * GET ist CSRF-frei; Session-Cookie wird wie üblich mitgeschickt. Bei Fehlern
 * wird der JSON-Fehlerkörper geparst und als ApiError geworfen.
 */
export async function ladePdf(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!res.ok) {
    let fehler: ApiFehler = {
      code: `HTTP_${res.status}`,
      nachricht: `Serverfehler (${res.status})`,
    };
    try {
      const body = (await res.json()) as { fehler?: ApiFehler };
      if (body?.fehler) fehler = body.fehler;
    } catch {
      // Body nicht parsbar — Fallback behalten
    }
    throw new ApiError(fehler, res.status);
  }
  // Server-Dateiname aus Content-Disposition bevorzugen (schöner Slug + Datum).
  const cd = res.headers.get('Content-Disposition') ?? '';
  const treffer = /filename="?([^"]+)"?/.exec(cd);
  const dateiname = treffer?.[1] ?? fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Lädt eine Datei (multipart/form-data) hoch. Setzt bewusst KEINEN
 * Content-Type-Header, damit der Browser die Multipart-Boundary erzeugt;
 * CSRF- und Session-Cookie werden wie bei apiFetch mitgeschickt.
 */
export async function apiUpload<T>(path: string, formular: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-csrf-token': await csrfHeaderWert() },
    body: formular,
  });

  if (!res.ok) {
    let fehler: ApiFehler = {
      code: `HTTP_${res.status}`,
      nachricht: `Serverfehler (${res.status})`,
    };
    try {
      const body = (await res.json()) as { fehler?: ApiFehler };
      if (body?.fehler) fehler = body.fehler;
    } catch {
      // Body nicht parsbar — Fallback behalten
    }
    zeigeToast(fehler.nachricht);
    throw new ApiError(fehler, res.status);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
