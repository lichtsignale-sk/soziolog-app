import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DEMO_BANNER_VARIABLE, DemoBanner } from './DemoBanner';

const useAuthMock = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => useAuthMock() }));

const wert = () => document.documentElement.style.getPropertyValue(DEMO_BANNER_VARIABLE);

/**
 * Der Streifen meldet seine Höhe, damit Kopf- und Seitenleiste der Shell sie
 * abziehen können. Ohne Demo darf die Variable nicht stehen bleiben.
 */
describe('DemoBanner', () => {
  afterEach(() => document.documentElement.style.removeProperty(DEMO_BANNER_VARIABLE));

  it('setzt im Demo-Modus die Höhen-Variable und bleibt oben stehen', () => {
    useAuthMock.mockReturnValue({ demoModus: true });
    render(<DemoBanner />);
    const streifen = screen.getByRole('status');
    expect(streifen.className).toContain('sticky');
    expect(streifen.className).toContain('top-0');
    // jsdom misst keine Layouthöhen — gesetzt wird trotzdem ein px-Wert.
    expect(wert()).toMatch(/^\d+px$/);
  });

  it('lässt ohne Demo keine Variable zurück', () => {
    useAuthMock.mockReturnValue({ demoModus: false });
    render(<DemoBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(wert()).toBe('');
  });

  it('räumt die Variable beim Entfernen weg', () => {
    useAuthMock.mockReturnValue({ demoModus: true });
    const { unmount } = render(<DemoBanner />);
    expect(wert()).not.toBe('');
    unmount();
    expect(wert()).toBe('');
  });
});
