import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import {
  normalisiereOrganisationsname,
  organisationsnameAbdruck,
} from './organisationsname';

const hash = (wert: string): string =>
  createHash('sha256').update(wert, 'utf8').digest('hex');

describe('normalisiereOrganisationsname', () => {
  it('hält Schreibweisen desselben Namens zusammen', () => {
    const kern = normalisiereOrganisationsname('Musterverein Ostend e. V.');
    expect(normalisiereOrganisationsname('Musterverein Ostend e.V.')).toBe(kern);
    expect(normalisiereOrganisationsname('  musterverein  ostend  eV ')).toBe(kern);
    expect(normalisiereOrganisationsname('MUSTERVEREIN-OSTEND-EV')).toBe(kern);
  });

  it('löst Umlaute und Akzente auf', () => {
    expect(normalisiereOrganisationsname('Wohnprojekt Grünzug')).toBe(
      'wohnprojektgruenzug',
    );
    expect(normalisiereOrganisationsname('Höfe & Gärten')).toBe('hoefegaerten');
    expect(normalisiereOrganisationsname('Straßenfest')).toBe('strassenfest');
  });

  it('unterscheidet einen wirklich anderen Namen', () => {
    expect(normalisiereOrganisationsname('Musterverein Ostend')).not.toBe(
      normalisiereOrganisationsname('Wohnprojekt Grünzug'),
    );
  });
});

describe('organisationsnameAbdruck', () => {
  it('ist für dieselbe Schreibweise gleich', () => {
    expect(organisationsnameAbdruck('Musterverein Ostend e. V.', hash)).toBe(
      organisationsnameAbdruck('musterverein ostend e.V.', hash),
    );
  });

  it('ist für einen anderen Namen verschieden', () => {
    expect(organisationsnameAbdruck('Musterverein Ostend', hash)).not.toBe(
      organisationsnameAbdruck('Wohnprojekt Grünzug', hash),
    );
  });

  it('enthält den Namen selbst nicht', () => {
    const abdruck = organisationsnameAbdruck('Musterverein Ostend', hash);
    expect(abdruck).toMatch(/^[0-9a-f]{64}$/);
    expect(abdruck.toLowerCase()).not.toContain('musterverein');
  });
});
