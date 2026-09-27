import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import type { TrackListDto } from '@/api/models/trackListDto';
import { typeInto } from '@/test/typeInto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getEditablePlaylists = vi.fn();
const getMyPlaylists1 = vi.fn();
const addTrack = vi.fn();
const createPlaylist = vi.fn();
const toast = vi.fn();

vi.mock('@/api/generated/playlists/playlists', () => ({
  getEditablePlaylists: () => getEditablePlaylists(),
  getMyPlaylists1: () => getMyPlaylists1(),
  addTrack: (id: string, request: { trackId: string }) => addTrack(id, request),
  createPlaylist: (request: { name: string }) => createPlaylist(request),
}));

vi.mock('@/ui', async () => {
  const actual = await vi.importActual<typeof import('@/ui')>('@/ui');
  return {
    ...actual,
    toast: (...args: unknown[]) => toast(...args),
  };
});

const track: TrackListDto = { id: 'track-123', title: 'Test track', danceStyle: 'Polska' };

describe('AddToPlaylistModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getEditablePlaylists.mockReset();
    getMyPlaylists1.mockReset();
    addTrack.mockReset();
    createPlaylist.mockReset();
    toast.mockReset();
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

  it('shows an inline error when adding the track fails', async () => {
    getEditablePlaylists.mockResolvedValue([
      { id: 'p1', name: 'Mina valser', ownerGroupName: null },
    ]);
    addTrack.mockRejectedValue(new Error('Add failed'));
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <AddToPlaylistModal open={true} onClose={onClose} track={track} />
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const playlistButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Mina valser')
    );
    expect(playlistButton).toBeDefined();

    await act(async () => {
      playlistButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe('Kunde inte lägga till låt');
    expect(document.body.textContent).toContain('Lägg till i spellista');
    expect(onClose).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), 'error');
  });

  it('clears the add error on a successful retry', async () => {
    getEditablePlaylists.mockResolvedValue([
      { id: 'p1', name: 'Mina valser', ownerGroupName: null },
    ]);
    addTrack.mockRejectedValueOnce(new Error('Add failed')).mockResolvedValueOnce({});
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <AddToPlaylistModal open={true} onClose={onClose} track={track} />
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const playlistButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Mina valser')
    );
    expect(playlistButton).toBeDefined();

    await act(async () => {
      playlistButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
      'Kunde inte lägga till låt'
    );

    await act(async () => {
      playlistButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.querySelector('[role="alert"]')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows an inline error when creating a playlist fails', async () => {
    getEditablePlaylists.mockResolvedValue([]);
    createPlaylist.mockRejectedValue(new Error('Create failed'));
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <AddToPlaylistModal open={true} onClose={onClose} track={track} />
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const newPlaylistButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Ny spellista')
    );
    expect(newPlaylistButton).toBeDefined();

    await act(async () => {
      newPlaylistButton?.click();
    });

    const nameInput = document.body.querySelector('input[type="text"]') as HTMLInputElement;
    expect(nameInput).toBeTruthy();

    await act(async () => {
      typeInto(nameInput, 'Ny spellista namn');
    });

    const form = nameInput.closest('form');
    expect(form).toBeTruthy();

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe('Kunde inte skapa spellista');
    expect(document.body.textContent).toContain('Lägg till i spellista');
    expect(onClose).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), 'error');
  });

  it('clears the create error when the name input changes', async () => {
    getEditablePlaylists.mockResolvedValue([]);
    createPlaylist.mockRejectedValue(new Error('Create failed'));
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <AddToPlaylistModal open={true} onClose={onClose} track={track} />
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const newPlaylistButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Ny spellista')
    );
    expect(newPlaylistButton).toBeDefined();

    await act(async () => {
      newPlaylistButton?.click();
    });

    const nameInput = document.body.querySelector('input[type="text"]') as HTMLInputElement;
    expect(nameInput).toBeTruthy();

    await act(async () => {
      typeInto(nameInput, 'Ny spellista namn');
    });

    const form = nameInput.closest('form');
    expect(form).toBeTruthy();

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
      'Kunde inte skapa spellista'
    );

    await act(async () => {
      typeInto(nameInput, 'Ny spellista namn 2');
    });

    expect(document.body.querySelector('[role="alert"]')).toBeNull();
  });
});
