import { KonfigService } from './konfig.service';

function baueService(store: Record<string, string> = {}) {
  const prisma = {
    systemkonfiguration: {
      upsert: jest.fn(async ({ where, create }: never) => {
        // vereinfachter In-Memory-Store
        const w = where as { schluessel: string };
        const c = create as { wertVerschluesselt: string };
        store[w.schluessel] = c.wertVerschluesselt;
      }),
      findUnique: jest.fn(async ({ where }: never) => {
        const w = where as { schluessel: string };
        return store[w.schluessel]
          ? { wertVerschluesselt: store[w.schluessel] }
          : null;
      }),
    },
  };
  const config = { get: (k: string) => (k === 'CONFIG_KEY' ? 'test-key' : undefined) };
  return {
    service: new KonfigService(prisma as never, config as never),
    prisma,
    store,
  };
}

describe('KonfigService (AES-256-GCM)', () => {
  it('speichert verschlüsselt (Ciphertext ≠ Klartext) und liest wieder Klartext', async () => {
    const { service, store } = baueService();
    await service.setze('smtp_passwort', 'geheim123');

    // Der gespeicherte Wert darf nicht der Klartext sein.
    expect(store['smtp_passwort']).toBeDefined();
    expect(store['smtp_passwort']).not.toContain('geheim123');
    // Format iv.tag.ciphertext
    expect(store['smtp_passwort'].split('.')).toHaveLength(3);

    expect(await service.hole('smtp_passwort')).toBe('geheim123');
  });

  it('gibt null für unbekannte Schlüssel', async () => {
    const { service } = baueService();
    expect(await service.hole('gibtsnicht')).toBeNull();
  });

  it('holeSmtp liefert die gespeicherte Konfiguration', async () => {
    const { service } = baueService();
    await service.setzeSmtp({
      host: 'mail.example.com',
      port: 1025,
      user: 'u',
      passwort: 'p',
      absender: 'SozioLog <no@reply.test>',
    });
    const smtp = await service.holeSmtp();
    expect(smtp).toEqual({
      host: 'mail.example.com',
      port: 1025,
      user: 'u',
      passwort: 'p',
      absender: 'SozioLog <no@reply.test>',
    });
  });
});
