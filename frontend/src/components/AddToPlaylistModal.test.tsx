import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import type { TrackListDto } from '@/api/models/trackListDto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getEditablePlaylists = vi.fn();
const getMyPlaylists1 = vi.fn();
const addTrack = vi.fn();
const createPlaylist = vi.fn();

vi.mock('@/api/generated/playlists/playlists', () => ({
  getEditablePlaylists: () => getEditablePlaylists(),
  getMyPlaylists1: () => getMyPlaylists1(),
  addTrack: (id: string, request: { trackId: string }) => addTrack(id, request),
  createPlaylist: (request: { name: string }) => createPlaylist(request),
}));

const track: TrackListDto = { id: 'track-123', title: 'Test track', danceStyle: 'Polska' };

describe('AddToPlaylistModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getEditablePlaylists.mockReset();
    getMyPlaylists1.mockReset();
    addTrack.mockReset();
    createPlaylist.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it('lists every editable playlist', async () => {
    getEditablePlaylists.mockResolvedValue([
      { id: 'p1', name: 'Mina valser', ownerGroupName: null },
      { id: 'p2', name: 'Barnens favoriter', ownerGroupName: 'Barngruppen' },
    ]);

    await act(async () => {
      root.render(
        <AddToPlaylistModal open={true} onClose={() => {}} track={track} />
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const text = document.body.textContent || '';
    expect(text).toContain('Mina valser');
    expect(text).toContain('Barnens favoriter');
  });

  it('names the group under a group playlist', async () => {
    getEditablePlaylists.mockResolvedValue([
      { id: 'p1', name: 'Mina valser', ownerGroupName: null },
      { id: 'p2', name: 'Barnens favoriter', ownerGroupName: 'Barngruppen' },
    ]);

    await act(async () => {
      root.render(
        <AddToPlaylistModal open={true} onClose={() => {}} track={track} />
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const text = document.body.textContent || '';
    expect(text).toContain('Grupp: Barngruppen');
    expect(text).not.toContain('Grupp: null');
    expect(text).not.toContain('Grupp: Mina valser');
  });

  it('adds the track to the chosen playlist', async () => {
    getEditablePlaylists.mockResolvedValue([
      { id: 'p1', name: 'Mina valser', ownerGroupName: null },
      { id: 'p2', name: 'Barnens favoriter', ownerGroupName: 'Barngruppen' },
    ]);
    addTrack.mockResolvedValue({});

    await act(async () => {
      root.render(
        <AddToPlaylistModal open={true} onClose={() => {}} track={track} />
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const buttons = document.body.querySelectorAll('button');
    const barnensButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Barnens favoriter')
    );

    expect(barnensButton).toBeDefined();

    await act(async () => {
      barnensButton?.click();
    });

    expect(addTrack).toHaveBeenCalledWith('p2', { trackId: 'track-123' });
  });

  it('does not load the old list', async () => {
    getEditablePlaylists.mockResolvedValue([
      { id: 'p1', name: 'Mina valser', ownerGroupName: null },
    ]);

    await act(async () => {
      root.render(
        <AddToPlaylistModal open={true} onClose={() => {}} track={track} />
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(getMyPlaylists1).not.toHaveBeenCalled();
  });
});
