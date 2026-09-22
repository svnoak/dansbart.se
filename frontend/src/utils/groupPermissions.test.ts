import { describe, it, expect } from 'vitest';
import { canOpenGroupSettings, hasGroupPermission } from './groupPermissions';

describe('canOpenGroupSettings', () => {
  it('returns false when membership is undefined', () => {
    expect(canOpenGroupSettings(undefined)).toBe(false);
  });

  it('returns false when membership is an empty object', () => {
    expect(canOpenGroupSettings({})).toBe(false);
  });

  it('returns true when isAdmin is true and status is accepted', () => {
    expect(canOpenGroupSettings({ isAdmin: true, status: 'accepted' })).toBe(
      true,
    );
  });

  it('returns true when canEditInfo is true and status is accepted', () => {
    expect(
      canOpenGroupSettings({ canEditInfo: true, status: 'accepted' }),
    ).toBe(true);
  });

  it('returns true when canInviteMembers is true and status is accepted', () => {
    expect(
      canOpenGroupSettings({ canInviteMembers: true, status: 'accepted' }),
    ).toBe(true);
  });

  it('returns true when canRemoveMembers is true and status is accepted', () => {
    expect(
      canOpenGroupSettings({ canRemoveMembers: true, status: 'accepted' }),
    ).toBe(true);
  });

  it('returns false when canManagePlaylists is true and status is accepted', () => {
    expect(
      canOpenGroupSettings({ canManagePlaylists: true, status: 'accepted' }),
    ).toBe(false);
  });

  it('returns false when isAdmin is true but status is not accepted', () => {
    expect(canOpenGroupSettings({ isAdmin: true, status: 'pending' })).toBe(
      false,
    );
  });
});

describe('hasGroupPermission', () => {
  const flags = ['canEditInfo', 'canInviteMembers', 'canRemoveMembers', 'canManagePlaylists'] as const;

  describe('when membership is undefined', () => {
    flags.forEach((flag) => {
      it(`returns false for ${flag}`, () => {
        expect(hasGroupPermission(undefined, flag)).toBe(false);
      });
    });
  });

  describe('when status is pending', () => {
    flags.forEach((flag) => {
      it(`returns false for ${flag}`, () => {
        const membership = {
          status: 'pending' as const,
          [flag]: true,
          isAdmin: false,
        };
        expect(hasGroupPermission(membership, flag)).toBe(false);
      });
    });
  });

  describe('when status is accepted', () => {
    flags.forEach((flag) => {
      it(`returns true for ${flag} when flag is true`, () => {
        const membership = {
          status: 'accepted' as const,
          [flag]: true,
          isAdmin: false,
        };
        expect(hasGroupPermission(membership, flag)).toBe(true);
      });

      it(`returns true for ${flag} when isAdmin is true`, () => {
        const membership = {
          status: 'accepted' as const,
          [flag]: false,
          isAdmin: true,
        };
        expect(hasGroupPermission(membership, flag)).toBe(true);
      });

      it(`returns false for ${flag} when both flag and isAdmin are false`, () => {
        const membership = {
          status: 'accepted' as const,
          [flag]: false,
          isAdmin: false,
        };
        expect(hasGroupPermission(membership, flag)).toBe(false);
      });
    });
  });
});
