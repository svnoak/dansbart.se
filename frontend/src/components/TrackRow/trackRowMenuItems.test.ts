import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrackListDto } from '@/api/models/trackListDto';
import { getTrackRowMenuItems } from './trackRowMenuItems';

vi.mock('@/ui', async () => {
  const actual = await vi.importActual('@/ui');
  return {
    ...actual,
    toast: vi.fn(),
  };
});

const { toast } = await import('@/ui');

describe('getTrackRowMenuItems', () => {
  const mockTrack: TrackListDto = {
    id: 'track-1',
    title: 'Test Track',
    artistId: 'artist-1',
    albumId: 'album-1',
  };

  const mockOnAddToQueue = vi.fn();
  const mockOnFlag = vi.fn();
  const mockOnAddToPlaylist = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists the options in menu order when all items are present', () => {
    const items = getTrackRowMenuItems({
      track: mockTrack,
      onAddToQueue: mockOnAddToQueue,
      onFlag: mockOnFlag,
      onAddToPlaylist: mockOnAddToPlaylist,
    });

    expect(items).toHaveLength(6);
    expect(items[0].label).toBe('Lägg i kö');
    expect(items[1].label).toBe('Lägg till i spellista');
    expect(items[2].label).toBe('Dela');
    expect(items[3].label).toBe('Gå till artist');
    expect(items[4].label).toBe('Gå till album');
    expect(items[5].label).toBe('Rapportera problem');
  });

  it('includes the playlist item only when onAddToPlaylist is given', () => {
    const itemsWithPlaylist = getTrackRowMenuItems({
      track: mockTrack,
      onAddToQueue: mockOnAddToQueue,
      onFlag: mockOnFlag,
      onAddToPlaylist: mockOnAddToPlaylist,
    });

    expect(itemsWithPlaylist.some((item) => item.label === 'Lägg till i spellista')).toBe(true);

    const itemsWithoutPlaylist = getTrackRowMenuItems({
      track: mockTrack,
      onAddToQueue: mockOnAddToQueue,
      onFlag: mockOnFlag,
    });

    expect(itemsWithoutPlaylist.some((item) => item.label === 'Lägg till i spellista')).toBe(false);
  });

  it('includes artist and album links only when the track has those ids', () => {
    const trackWithAllIds = getTrackRowMenuItems({
      track: { ...mockTrack, artistId: 'artist-1', albumId: 'album-1' },
      onAddToQueue: mockOnAddToQueue,
      onFlag: mockOnFlag,
    });

    expect(trackWithAllIds.some((item) => item.label === 'Gå till artist')).toBe(true);
    expect(trackWithAllIds.some((item) => item.label === 'Gå till album')).toBe(true);

    const trackWithoutArtistId = getTrackRowMenuItems({
      track: { ...mockTrack, artistId: undefined, albumId: 'album-1' },
      onAddToQueue: mockOnAddToQueue,
      onFlag: mockOnFlag,
    });

    expect(trackWithoutArtistId.some((item) => item.label === 'Gå till artist')).toBe(false);
    expect(trackWithoutArtistId.some((item) => item.label === 'Gå till album')).toBe(true);

    const trackWithoutAlbumId = getTrackRowMenuItems({
      track: { ...mockTrack, artistId: 'artist-1', albumId: undefined },
      onAddToQueue: mockOnAddToQueue,
      onFlag: mockOnFlag,
    });

    expect(trackWithoutAlbumId.some((item) => item.label === 'Gå till artist')).toBe(true);
    expect(trackWithoutAlbumId.some((item) => item.label === 'Gå till album')).toBe(false);
  });

  it('Dela copies the track link and confirms', async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteText,
      },
    });

    const items = getTrackRowMenuItems({
      track: mockTrack,
      onAddToQueue: mockOnAddToQueue,
      onFlag: mockOnFlag,
    });

    const delaItem = items.find((item) => item.label === 'Dela');
    expect(delaItem).toBeDefined();
    expect(delaItem).toHaveProperty('onSelect');

    const mockOnSelect = delaItem?.onSelect as () => Promise<void>;
    await mockOnSelect();

    const expectedUrl = `${window.location.origin}?track=track-1`;
    expect(clipboardWriteText).toHaveBeenCalledWith(expectedUrl);
    expect(toast).toHaveBeenCalledWith('Länk kopierad');
  });

  it('appends extra items', () => {
    const mockExtraItem = { label: 'Ta bort från Mina låtar', onClick: vi.fn() };

    const items = getTrackRowMenuItems({
      track: mockTrack,
      onAddToQueue: mockOnAddToQueue,
      onFlag: mockOnFlag,
      extraItems: [mockExtraItem],
    });

    const lastItem = items[items.length - 1];
    expect(lastItem.label).toBe('Ta bort från Mina låtar');
  });

  it('omits share and flag for a private track', () => {
    const itemsWithoutPrivate = getTrackRowMenuItems({
      track: mockTrack,
      onAddToQueue: mockOnAddToQueue,
      onFlag: mockOnFlag,
    });

    expect(itemsWithoutPrivate.some((item) => item.label === 'Dela')).toBe(true);
    expect(itemsWithoutPrivate.some((item) => item.label === 'Rapportera problem')).toBe(true);

    const itemsWithPrivate = getTrackRowMenuItems({
      track: mockTrack,
      onAddToQueue: mockOnAddToQueue,
      onFlag: mockOnFlag,
      isPrivate: true,
    });

    expect(itemsWithPrivate.some((item) => item.label === 'Dela')).toBe(false);
    expect(itemsWithPrivate.some((item) => item.label === 'Rapportera problem')).toBe(false);
  });
});
