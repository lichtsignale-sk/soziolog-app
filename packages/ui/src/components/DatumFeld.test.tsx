import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatumFeld } from './DatumFeld';

describe('DatumFeld', () => {
  it('nutzt ausschließlich Kalenderdaten (YYYY-MM-DD, kein Zeitanteil)', () => {
    const onChange = vi.fn();
    render(<DatumFeld label="Datum" value="2026-07-04" onChange={onChange} />);

    const input = screen.getByLabelText('Datum') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2026-07-04');
    expect(input.value).not.toContain('T'); // keine Uhrzeit

    fireEvent.change(input, { target: { value: '2026-12-31' } });
    expect(onChange).toHaveBeenCalledWith('2026-12-31');
  });
});
