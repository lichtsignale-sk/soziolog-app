import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EintragAbzeichen } from './EintragAbzeichen';
import { EINTRAG, type EintragTyp } from '../eintrag-farben';

const TYPEN: EintragTyp[] = [
  'vorschlag',
  'bedenken',
  'einwand',
  'beschluss',
];

describe('EintragAbzeichen', () => {
  it('trägt für jeden Typ ein Text-Label (nicht nur Farbe)', () => {
    for (const typ of TYPEN) {
      const { unmount } = render(<EintragAbzeichen typ={typ} />);
      // Barrierefreiheit: die Bedeutung ist als Text lesbar, nicht nur farblich.
      expect(screen.getByText(EINTRAG[typ].label)).toBeInTheDocument();
      unmount();
    }
  });
});
