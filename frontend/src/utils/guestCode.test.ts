import { describe, expect, it } from 'vitest';
import { formatGuestCode, guestCodeUrl, normalizeGuestCode } from './guestCode';

describe('guestCode', () => {
  it('reads a typed code without regard to case, spaces and dashes', () => {
    expect(normalizeGuestCode(' abc-2 34 ')).toBe('ABC234');
  });

  it('shows a code in two groups of three', () => {
    expect(formatGuestCode('ABC234')).toBe('ABC 234');
  });

  it('builds the address a guest opens', () => {
    expect(guestCodeUrl('ABC234')).toBe(`${window.location.origin}/kod/ABC234`);
  });
});
