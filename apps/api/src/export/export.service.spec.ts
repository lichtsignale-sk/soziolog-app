import { NotFoundException } from '@nestjs/common';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { ExportService } from './export.service';

const PERSON: SitzungsPerson = {
  id: 'p1',
  organisationId: 'org1',
  name: 'Lena Brandt',
  nutzername: 'lena',
  loginEmail: 'lena@example.org',
  istAdmin: true,
  benachrichtigungenAktiv: true,
};

function vorschlag(domaeneId: string) {
  return {
    id: 'v1',
    domaeneId,
    titel: 'Test',
    inhalt: 'Inhalt',
    governanceTyp: 'governance',
    status: 'entschieden',
    datum: '2026-01-15',
    erfasstVonName: 'Lena Brandt',
    bedenken: [],
    einwaende: [],
    beschluss: null,
    neufassungVon: null,
  };
}

function baue(domaeneGehoertZurOrg: boolean) {
  const prisma = { organisation: { findUnique: jest.fn().mockResolvedValue({ name: 'Org' }) } };
  const domaenen = {
    domaeneDetail: jest.fn(async (_org: string, id: string) => {
      if (!domaeneGehoertZurOrg) throw new NotFoundException('Domäne nicht gefunden.');
      return { id, name: 'Anbaukreis', ziel: '', tasks: [], typ: 'dauerdomaene', elternDomaeneId: null, aktiv: true, archiviert: false, anzahlBeschluesse: 0, anzahlOffeneEinwaende: 0, elternDomaeneName: null };
    }),
  };
  const vorgang = {
    holeVorschlag: jest.fn(async () => vorschlag('d1')),
    holeVorschlaegeFuerDomaene: jest.fn(async () => []),
  };
  const aggregator = { organisationVollstaendig: jest.fn() };
  const mail = { sendeExportFertig: jest.fn() };
  const service = new ExportService(
    prisma as never,
    domaenen as never,
    vorgang as never,
    aggregator as never,
    mail as never,
  );
  return { service, domaenen };
}

describe('ExportService.einzel', () => {
  it('prüft die Org-Grenze über domaeneDetail(organisationId, …) und liefert ein PDF', async () => {
    const { service, domaenen } = baue(true);
    const ergebnis = await service.einzel(PERSON, 'v1');
    expect(domaenen.domaeneDetail).toHaveBeenCalledWith('org1', 'd1');
    expect(ergebnis.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(ergebnis.dateiname).toMatch(/^beschluss-.*\.pdf$/);
  });

  it('verweigert den Export für einen Vorschlag aus fremder Organisation', async () => {
    const { service } = baue(false);
    await expect(service.einzel(PERSON, 'v1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
