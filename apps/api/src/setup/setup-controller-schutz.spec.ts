import { SetupController } from './setup.controller';
import { SetupGesperrtGuard } from './setup-gesperrt.guard';
import { SetupTokenGuard } from './setup-token.guard';

/** Liest die per @UseGuards an einer Methode hinterlegten Guards. */
function guardsVon(methode: keyof SetupController): unknown[] {
  return (
    Reflect.getMetadata('__guards__', SetupController.prototype[methode]) ?? []
  );
}

describe('Schutz der Setup-Routen', () => {
  it('die Einrichtung selbst ist gesperrt und verlangt das Geheimnis', () => {
    const guards = guardsVon('durchfuehren');
    expect(guards).toContain(SetupGesperrtGuard);
    expect(guards).toContain(SetupTokenGuard);
  });

  /**
   * Regressionstest: Die Route
   * `POST /api/setup/einladung-erneut/:personId` stand ohne jeden Guard offen.
   * Ein Guard allein hätte nicht genügt — `SetupTokenGuard` lässt auf Instanzen
   * OHNE gesetztes SETUP_TOKEN jeden durch. Die Route hatte im Frontend keinen
   * einzigen Aufrufer; benutzt wird das angemeldete Gegenstück hinter
   * AdminGuard. Sie ist deshalb ersatzlos entfernt.
   */
  it('es gibt keinen Einladungsversand mehr im Setup-Controller', () => {
    expect(
      (SetupController.prototype as unknown as Record<string, unknown>)[
        'einladungErneut'
      ],
    ).toBeUndefined();
  });

  it('der Statusabruf bleibt bewusst offen', () => {
    expect(guardsVon('status')).toHaveLength(0);
  });
});
