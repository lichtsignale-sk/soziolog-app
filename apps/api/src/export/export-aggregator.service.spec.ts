import { ExportAggregatorService } from './export-aggregator.service';

function knoten(id: string, elternDomaeneId: string | null) {
  return {
    id,
    name: id,
    ziel: '',
    tasks: [],
    typ: 'dauerdomaene',
    elternDomaeneId,
    aktiv: true,
    archiviert: false,
    anzahlBeschluesse: 0,
    anzahlOffeneEinwaende: 0,
  };
}

function baue() {
  const domaenen = {
    // Absichtlich unsortiert: Kind vor Elternteil.
    alleDomaenen: jest.fn().mockResolvedValue([
      knoten('kind', 'wurzel'),
      knoten('wurzel', null),
    ]),
    domaeneDetail: jest.fn(async (_org: string, id: string) => ({
      ...knoten(id, id === 'kind' ? 'wurzel' : null),
      elternDomaeneName: id === 'kind' ? 'wurzel' : null,
    })),
  };
  const vorgang = {
    holeVorschlaegeFuerDomaene: jest.fn(async (id: string) => [
      { id: `v-${id}`, domaeneId: id, titel: id, bedenken: [], einwaende: [], beschluss: null },
    ]),
  };
  const service = new ExportAggregatorService(domaenen as never, vorgang as never);
  return { service, domaenen, vorgang };
}

describe('ExportAggregatorService', () => {
  it('filtert nach organisationId und ordnet Eltern vor Kinder', async () => {
    const { service, domaenen } = baue();
    const gruppen = await service.organisationVollstaendig('org1');

    expect(domaenen.alleDomaenen).toHaveBeenCalledWith('org1');
    // Reihenfolge: Wurzel vor Kind (Tiefensuche), obwohl Eingabe umgekehrt war.
    expect(gruppen.map((g) => g.domaene.id)).toEqual(['wurzel', 'kind']);
    // Grenzprüfung läuft über domaeneDetail(organisationId, …).
    expect(domaenen.domaeneDetail).toHaveBeenCalledWith('org1', 'wurzel');
  });

  it('enthält je Domäne die vollständigen Vorgänge', async () => {
    const { service } = baue();
    const gruppen = await service.organisationVollstaendig('org1');
    expect(gruppen[0].vorschlaege[0].id).toBe('v-wurzel');
    expect(gruppen[1].vorschlaege[0].id).toBe('v-kind');
  });
});
