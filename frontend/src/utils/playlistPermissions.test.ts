import { describe, it, expect } from 'vitest';
import type { PlaylistDto } from '@/api/models/playlistDto';
import { canEditPlaylist } from './playlistPermissions';

const basePlaylist: PlaylistDto = {
  id: 'p1',
  name: 'Test',
  description: undefined,
  isPublic: false,
  ownerGroup: undefined,
  owner: undefined,
  trackCount: 0,
  tracks: [],
  danceStyle: undefined,
  subStyle: undefined,
  tempoCategory: undefined,
  shareToken: undefined,
  collaborators: [],
};

describe('canEditPlaylist', () => {
  it('viewerCanManage true allows edit', () => {
    const playlist = { ...basePlaylist, viewerCanManage: true };
    expect(canEditPlaylist(playlist, 'user1')).toBe(true);
  });

  it('accepted edit collaborator allows edit', () => {
    const playlist = {
      ...basePlaylist,
      viewerCanManage: false,
      collaborators: [{ userId: 'user1', permission: 'edit', status: 'accepted' }],
    };
    expect(canEditPlaylist(playlist, 'user1')).toBe(true);
  });

  it('pending edit collaborator does not allow edit', () => {
    const playlist = {
      ...basePlaylist,
      viewerCanManage: false,
      collaborators: [{ userId: 'user1', permission: 'edit', status: 'pending' }],
    };
    expect(canEditPlaylist(playlist, 'user1')).toBe(false);
  });

  it('view collaborator does not allow edit', () => {
    const playlist = {
      ...basePlaylist,
      viewerCanManage: false,
      collaborators: [{ userId: 'user1', permission: 'view', status: 'accepted' }],
    };
    expect(canEditPlaylist(playlist, 'user1')).toBe(false);
  });

  it('null playlist does not allow edit', () => {
    expect(canEditPlaylist(null, 'user1')).toBe(false);
  });

  it('no user does not allow edit', () => {
    expect(canEditPlaylist(basePlaylist, undefined)).toBe(false);
  });
});
