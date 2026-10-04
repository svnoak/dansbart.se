import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import DanceListPage from './DanceListPage';
import { typeInto } from '@/test/typeInto';
import { ToastContainer } from '@/ui';
import * as toastEmitter from '@/ui/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getDanceList = vi.fn();
const addEntry = vi.fn();
const removeEntry = vi.fn();
const getDances = vi.fn();
const searchTracks = vi.fn();
const addTrackToEntry = vi.fn();
const removeTrackFromEntry = vi.fn();
const setPlayMode = vi.fn();
const reorderEntries = vi.fn();
const usePlayerMock = { play: vi.fn() };

vi.mock('@/api/generated/dance-lists/dance-lists', () => ({
  getDanceList: (...args: unknown[]) => getDanceList(...args),
  addEntry: (...args: unknown[]) => addEntry(...args),
  removeEntry: (...args: unknown[]) => removeEntry(...args),
  addTrackToEntry: (...args: unknown[]) => addTrackToEntry(...args),
  removeTrackFromEntry: (...args: unknown[]) => removeTrackFromEntry(...args),
  setPlayMode: (...args: unknown[]) => setPlayMode(...args),
  reorderEntries: (...args: unknown[]) => reorderEntries(...args),
}));

vi.mock('@/api/generated/dances/dances', () => ({
  getDances: (...args: unknown[]) => getDances(...args),
}));

vi.mock('@/api/generated/tracks/tracks', () => ({
  searchTracks: (...args: unknown[]) => searchTracks(...args),
}));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => usePlayerMock,
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { id: 'user-1' } }),
}));

vi.mock('@/favorites/useFavorites', () => ({
  useFavorites: () => ({ isFavorited: () => false, toggleFavorite: vi.fn() }),
}));

vi.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'list-1' }),
  };
});

const mockDanceListFull = {
  id: 'list-1',
  name: 'My Dances',
  description: 'A list of my favorite dances',
  isPublic: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  owner: { id: 'user-1', username: 'testuser', displayName: 'Test User' },
  ownerGroup: null,
  viewerCanManage: true,
  entries: [
    {
      id: 'entry-1',
      danceId: 'dance-1',
      danceName: 'Familjevals från Ödsmål',
      freeTextName: null,
      playMode: 'in_order',
      position: 0,
      tracks: [
        {
          id: 'pt-1',
          position: 0,
          addedAt: '2026-01-01T00:00:00Z',
          addedByUserId: 'user-1',
          track: {
            id: 'track-1',
            title: 'Första låten',
            durationMs: 180000,
            danceStyle: 'familjevals',
            source: 'spotify',
          },
        },
        {
          id: 'pt-2',
          position: 1,
          addedAt: '2026-01-01T00:00:00Z',
          addedByUserId: 'user-1',
          track: {
            id: 'track-2',
            title: 'Andra låten',
            durationMs: 200000,
            danceStyle: 'familjevals',
            source: 'spotify',
          },
        },
      ],
    },
    {
      id: 'entry-2',
      danceId: null,
      danceName: null,
      freeTextName: 'Egen dans',
      playMode: 'in_order',
      position: 1,
      tracks: [],
    },
  ],
  collaborators: [],
};

const mockDanceListEmpty = {
  ...mockDanceListFull,
  entries: [],
};

const mockDanceListReadOnly = {
  ...mockDanceListFull,
  viewerCanManage: false,
  collaborators: [
    {
      id: 'collab-1',
      userId: 'current-user',
      username: 'currentuser',
      displayName: 'Current User',
      permission: 'view',
      status: 'accepted',
    },
  ],
};

const mockSearchResults = {
  content: [
    {
      id: 'dance-familjevals',
      name: 'Familjevals från Ödsmål',
      bpmMin: 110,
      bpmMax: 130,
    },
  ],
  pageNumber: 0,
  pageSize: 20,
  totalElements: 1,
};

const mockEmptySearchResults = {
  content: [],
  pageNumber: 0,
  pageSize: 20,
  totalElements: 0,
};

describe('DanceListPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    getDanceList.mockReset();
    addEntry.mockReset();
    removeEntry.mockReset();
    getDances.mockReset();
    searchTracks.mockReset();
    addTrackToEntry.mockReset();
    removeTrackFromEntry.mockReset();
    setPlayMode.mockReset();
    reorderEntries.mockReset();
    usePlayerMock.play.mockReset();
    getDanceList.mockResolvedValue(mockDanceListFull);
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    toastSpy.mockRestore();
    root.unmount();
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <BrowserRouter>
          <DanceListPage />
          <ToastContainer />
        </BrowserRouter>,
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
  }

  function clickButton(text: string) {
    const button = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(text),
    );
    expect(button).toBeDefined();
    return button;
  }

  function getInputByLabel(label: string) {
    const labelElement = Array.from(document.body.querySelectorAll('label')).find((l) =>
      l.textContent?.includes(label),
    );
    if (!labelElement) {
      return null;
    }
    const inputId = labelElement.getAttribute('for');
    if (inputId) {
      return document.getElementById(inputId) as HTMLInputElement | null;
    }
    return labelElement.querySelector('input') as HTMLInputElement | null;
  }

  function getRemoveTrackButtons() {
    return Array.from(document.body.querySelectorAll('button')).filter((b) => {
      const label = b.getAttribute('aria-label') ?? '';
      return label.startsWith('Ta bort ') && label.includes(' från ');
    });
  }

  function getPlayModeButton(danceName: string, label: string) {
    const group = document.body.querySelector(`[role="group"][aria-label="Spelläge för ${danceName}"]`);
    expect(group).not.toBeNull();
    const button = Array.from(group!.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
  }

  async function openRemoveDanceItem(danceName: string) {
    const menuButton = document.body.querySelector(
      `button[aria-label="Fler alternativ för ${danceName}"]`,
    ) as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    await act(async () => {
      menuButton!.click();
    });
    return clickButton('Ta bort dansen');
  }

  function getSearchResultRow(title: string) {
    const results = document.body.querySelector('ul[aria-label="Sökträffar"]');
    expect(results).not.toBeNull();
    const row = Array.from(results!.querySelectorAll('li')).find((li) => li.textContent?.includes(title));
    expect(row).toBeDefined();
    return row as HTMLLIElement;
  }

  function addButtonInResult(title: string) {
    const row = getSearchResultRow(title);
    const button = Array.from(row.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Lägg till');
    expect(button).toBeDefined();
    return button;
  }

  function confirmButtonFor(resultButton: HTMLButtonElement | undefined) {
    const row = resultButton?.closest('li');
    expect(row).toBeDefined();
    const button = Array.from(row!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Lägg till');
    expect(button).toBeDefined();
    return button;
  }

  it('shows the list and its dances', async () => {
    await renderPage();

    const text = document.body.textContent;
    expect(text).toContain('Familjevals från Ödsmål');
    expect(text).toContain('Egen dans');
  });

  it('shows an empty text', async () => {
    getDanceList.mockResolvedValue(mockDanceListEmpty);

    await renderPage();

    const text = document.body.textContent;
    expect(text).toContain('Danslistan har inga danser ännu.');
  });

  it('adds a dance from the site', async () => {
    getDances.mockResolvedValue(mockSearchResults);
    addEntry.mockResolvedValue({
      id: 'entry-3',
      danceId: 'dance-familjevals',
      danceName: 'Familjevals från Ödsmål',
      freeTextName: null,
      playMode: 'in_order',
      position: 2,
      tracks: [],
    });

    await renderPage();

    const addButton = clickButton('Lägg till dans');
    await act(async () => {
      addButton?.click();
    });

    const searchInput = getInputByLabel('Sök efter dans');
    expect(searchInput).toBeDefined();

    await act(async () => {
      typeInto(searchInput!, 'Fam');
      vi.advanceTimersByTime(300);
    });

    const resultButton = clickButton('Familjevals från Ödsmål');
    await act(async () => {
      resultButton?.click();
    });

    const addFromResultButton = confirmButtonFor(resultButton);
    await act(async () => {
      addFromResultButton?.click();
    });

    expect(addEntry).toHaveBeenCalledWith('list-1', expect.objectContaining({ danceId: 'dance-familjevals' }));
  });

  it('adds a dance that is missing', async () => {
    getDances.mockResolvedValue(mockEmptySearchResults);
    addEntry.mockResolvedValue({
      id: 'entry-3',
      danceId: null,
      danceName: null,
      freeTextName: 'Egen dans',
      playMode: 'in_order',
      position: 2,
      tracks: [],
    });

    await renderPage();

    const addButton = clickButton('Lägg till dans');
    await act(async () => {
      addButton?.click();
    });

    const searchInput = getInputByLabel('Sök efter dans');
    expect(searchInput).toBeDefined();

    await act(async () => {
      typeInto(searchInput!, 'Egen dans');
      vi.advanceTimersByTime(300);
    });

    const addAsTypedButton = clickButton('Lägg till som egen dans');
    await act(async () => {
      addAsTypedButton?.click();
    });

    expect(addEntry).toHaveBeenCalledWith('list-1', expect.objectContaining({ freeTextName: 'Egen dans' }));
  });

  it('removes a dance', async () => {
    removeEntry.mockResolvedValue(undefined);

    await renderPage();

    const removeButton = await openRemoveDanceItem('Familjevals från Ödsmål');
    await act(async () => {
      removeButton?.click();
    });

    const confirmButton = clickButton('Ja, ta bort');
    await act(async () => {
      confirmButton?.click();
    });

    expect(removeEntry).toHaveBeenCalledWith('list-1', 'entry-1');
  });

  it('a person who may only view sees no add or remove', async () => {
    getDanceList.mockResolvedValue(mockDanceListReadOnly);

    await renderPage();

    const hasAddButton = Array.from(document.body.querySelectorAll('button')).some((b) =>
      b.textContent?.includes('Lägg till'),
    );
    const hasRemoveButton = Array.from(document.body.querySelectorAll('button')).some((b) =>
      b.textContent?.includes('Ta bort'),
    );

    expect(hasAddButton).toBe(false);
    expect(hasRemoveButton).toBe(false);
  });

  it('shows not found', async () => {
    getDanceList.mockRejectedValue(new Error('not found'));

    await renderPage();

    const text = document.body.textContent;
    expect(text).toContain('Danslistan hittades inte.');
  });

  it('shows the tracks of a dance', async () => {
    await renderPage();

    const text = document.body.textContent;
    expect(text).toContain('Första låten');
    expect(text).toContain('Andra låten');
  });

  it('links a track to a dance', async () => {
    const mockTrack = {
      id: 'track-3',
      title: 'Ny låt',
      artistName: 'Testartisten',
      durationMs: 190000,
      danceStyle: 'familjevals',
      source: 'spotify',
    };
    searchTracks.mockResolvedValue({
      items: [mockTrack],
      total: 1,
      page: 0,
      size: 20,
      hasMore: false,
    });
    addTrackToEntry.mockResolvedValue({
      id: 'pt-3',
      position: 2,
      addedAt: '2026-01-01T00:00:00Z',
      addedByUserId: 'user-1',
    });

    await renderPage();

    const addTrackButtons = Array.from(document.body.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Lägg till låt'),
    );
    const firstAddButton = addTrackButtons[0];
    expect(firstAddButton).toBeDefined();

    await act(async () => {
      firstAddButton?.click();
    });

    const searchInput = getInputByLabel('Lägg till låt i');
    expect(searchInput).toBeDefined();

    await act(async () => {
      typeInto(searchInput!, 'Ny');
      vi.advanceTimersByTime(300);
    });

    const addFromResultButton = addButtonInResult('Ny låt');
    await act(async () => {
      addFromResultButton?.click();
    });

    expect(addTrackToEntry).toHaveBeenCalledWith('list-1', 'entry-1', expect.objectContaining({ trackId: 'track-3' }));
  });

  it('unlinks a track', async () => {
    removeTrackFromEntry.mockResolvedValue(undefined);

    await renderPage();

    const removeTrackButtons = getRemoveTrackButtons();
    const firstRemoveButton = removeTrackButtons[0];
    expect(firstRemoveButton).toBeDefined();

    await act(async () => {
      firstRemoveButton?.click();
    });

    const confirmButton = clickButton('Ja, ta bort');
    await act(async () => {
      confirmButton?.click();
    });

    expect(removeTrackFromEntry).toHaveBeenCalledWith('list-1', 'entry-1', 'pt-1');
  });

  it('plays the first track in order', async () => {
    await renderPage();

    const playButtons = Array.from(document.body.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Spela'),
    );
    const firstPlayButton = playButtons[0];
    expect(firstPlayButton).toBeDefined();

    await act(async () => {
      firstPlayButton?.click();
    });

    expect(usePlayerMock.play).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'track-1' }),
      expect.any(Array),
    );
  });

  it('plays a random track', async () => {
    const mockDanceListWithRandomMode = {
      ...mockDanceListFull,
      entries: [
        {
          ...mockDanceListFull.entries[0],
          playMode: 'random',
        },
        mockDanceListFull.entries[1],
      ],
    };
    getDanceList.mockResolvedValue(mockDanceListWithRandomMode);

    const originalRandom = Math.random;
    Math.random = vi.fn(() => 0.5);

    await renderPage();

    const playButtons = Array.from(document.body.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Spela'),
    );
    const firstPlayButton = playButtons[0];
    expect(firstPlayButton).toBeDefined();

    await act(async () => {
      firstPlayButton?.click();
    });

    expect(usePlayerMock.play).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'track-2' }),
      expect.any(Array),
    );

    Math.random = originalRandom;
  });

  it('changes the play mode', async () => {
    setPlayMode.mockResolvedValue(undefined);

    await renderPage();

    const randomButton = getPlayModeButton('Familjevals från Ödsmål', 'Slumpvis');

    await act(async () => {
      randomButton.click();
      vi.advanceTimersByTime(300);
    });

    expect(setPlayMode).toHaveBeenCalledWith('list-1', 'entry-1', expect.objectContaining({ playMode: 'random' }));
  });

  it('a person who may only view sees no track controls', async () => {
    getDanceList.mockResolvedValue(mockDanceListReadOnly);

    await renderPage();

    const hasAddTrackButton = Array.from(document.body.querySelectorAll('button')).some((b) =>
      b.textContent?.includes('Lägg till låt'),
    );
    const hasRemoveTrackButton = getRemoveTrackButtons().length > 0;
    const hasPlayModeSelect =
      document.body.querySelector('[role="group"][aria-label^="Spelläge för"]') !== null;

    const hasPlayButton = Array.from(document.body.querySelectorAll('button')).some((b) =>
      b.textContent?.includes('Spela'),
    );

    expect(hasAddTrackButton).toBe(false);
    expect(hasRemoveTrackButton).toBe(false);
    expect(hasPlayModeSelect).toBe(false);
    expect(hasPlayButton).toBe(true);
  });

  it('shows an error when adding a dance fails', async () => {
    getDances.mockResolvedValue(mockSearchResults);
    addEntry.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const addButton = clickButton('Lägg till dans');
    await act(async () => {
      addButton?.click();
    });

    const searchInput = getInputByLabel('Sök efter dans');
    expect(searchInput).toBeDefined();

    await act(async () => {
      typeInto(searchInput!, 'Fam');
      vi.advanceTimersByTime(300);
    });

    const resultButton = clickButton('Familjevals från Ödsmål');
    await act(async () => {
      resultButton?.click();
    });

    const addFromResultButton = confirmButtonFor(resultButton);
    await act(async () => {
      addFromResultButton?.click();
      vi.advanceTimersByTime(300);
    });

    expect(document.body.textContent).toContain('Det gick inte att lägga till dansen.');
  });

  it('shows an error when adding a track fails', async () => {
    const mockTrack = {
      id: 'track-3',
      title: 'Ny låt',
      artistName: 'Testartisten',
      durationMs: 190000,
      danceStyle: 'familjevals',
      source: 'spotify',
    };
    searchTracks.mockResolvedValue({
      items: [mockTrack],
      total: 1,
      page: 0,
      size: 20,
      hasMore: false,
    });
    addTrackToEntry.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const addTrackButtons = Array.from(document.body.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Lägg till låt'),
    );
    const firstAddButton = addTrackButtons[0];
    expect(firstAddButton).toBeDefined();

    await act(async () => {
      firstAddButton?.click();
    });

    const searchInput = getInputByLabel('Lägg till låt i');
    expect(searchInput).toBeDefined();

    await act(async () => {
      typeInto(searchInput!, 'Ny');
      vi.advanceTimersByTime(300);
    });

    const addFromResultButton = addButtonInResult('Ny låt');
    await act(async () => {
      addFromResultButton?.click();
      vi.advanceTimersByTime(300);
    });

    expect(document.body.textContent).toContain('Det gick inte att lägga till låten.');
  });

  it('shows an error when removing a dance fails', async () => {
    removeEntry.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const removeButton = await openRemoveDanceItem('Familjevals från Ödsmål');
    await act(async () => {
      removeButton?.click();
    });

    const confirmButton = clickButton('Ja, ta bort');
    await act(async () => {
      confirmButton?.click();
      vi.advanceTimersByTime(300);
    });

    expect(document.body.textContent).toContain('Det gick inte att ta bort dansen.');
  });

  it('shows an error when removing a track fails', async () => {
    removeTrackFromEntry.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const removeTrackButtons = getRemoveTrackButtons();
    const firstRemoveButton = removeTrackButtons[0];
    expect(firstRemoveButton).toBeDefined();

    await act(async () => {
      firstRemoveButton?.click();
    });

    const confirmButton = clickButton('Ja, ta bort');
    await act(async () => {
      confirmButton?.click();
      vi.advanceTimersByTime(300);
    });

    expect(document.body.textContent).toContain('Det gick inte att ta bort låten.');
  });

  it('a failed dance search says so', async () => {
    getDances.mockRejectedValue(new Error('Network error'));

    await renderPage();

    const addButton = clickButton('Lägg till dans');
    await act(async () => {
      addButton?.click();
    });

    const searchInput = getInputByLabel('Sök efter dans');
    expect(searchInput).toBeDefined();

    await act(async () => {
      typeInto(searchInput!, 'Fam');
      vi.advanceTimersByTime(300);
    });

    expect(document.body.textContent).toContain('Sökningen misslyckades. Försök igen.');
    const addAsTypedButton = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Lägg till som egen dans'),
    );
    expect(addAsTypedButton).toBeUndefined();
  });

  it('a failed track search says so', async () => {
    searchTracks.mockRejectedValue(new Error('Network error'));

    await renderPage();

    const addTrackButtons = Array.from(document.body.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Lägg till låt'),
    );
    const firstAddButton = addTrackButtons[0];
    expect(firstAddButton).toBeDefined();

    await act(async () => {
      firstAddButton?.click();
    });

    const searchInput = getInputByLabel('Lägg till låt i');
    expect(searchInput).toBeDefined();

    await act(async () => {
      typeInto(searchInput!, 'Test');
      vi.advanceTimersByTime(300);
    });

    expect(document.body.textContent).toContain('Sökningen misslyckades. Försök igen.');
    expect(document.body.textContent).not.toContain('Inga låtar hittades');
  });

  it('a track already on the dance cannot be added twice', async () => {
    const existingTrack = {
      id: 'track-1',
      title: 'Första låten',
      artistName: 'Test Artist',
      durationMs: 180000,
      danceStyle: 'familjevals',
      source: 'spotify',
    };
    searchTracks.mockResolvedValue({
      items: [existingTrack],
      total: 1,
      page: 0,
      size: 20,
      hasMore: false,
    });

    await renderPage();

    const addTrackButtons = Array.from(document.body.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Lägg till låt'),
    );
    const firstAddButton = addTrackButtons[0];
    expect(firstAddButton).toBeDefined();

    await act(async () => {
      firstAddButton?.click();
    });

    const searchInput = getInputByLabel('Lägg till låt i');
    expect(searchInput).toBeDefined();

    await act(async () => {
      typeInto(searchInput!, 'Första');
      vi.advanceTimersByTime(300);
    });

    const row = getSearchResultRow('Första låten');
    expect(row.textContent).toContain('Redan tillagd');
    const hasAddButton = Array.from(row.querySelectorAll('button')).some(
      (b) => b.textContent?.trim() === 'Lägg till',
    );
    expect(hasAddButton).toBe(false);
    expect(addTrackToEntry).not.toHaveBeenCalled();
  });

  it('a dance with no tracks has no play button', async () => {
    await renderPage();

    const entries = Array.from(document.body.querySelectorAll('li')).filter((li) =>
      li.textContent?.includes('Egen dans'),
    );
    expect(entries.length).toBeGreaterThan(0);

    const secondDanceEntry = entries[0];
    const playButtons = Array.from(secondDanceEntry.querySelectorAll('button'));
    const hasPlayButton = playButtons.some((b) => b.textContent?.includes('Spela'));

    expect(hasPlayButton).toBe(false);
  });

  it('shows the add-dance error inline next to the search panel, not as a toast', async () => {
    getDances.mockResolvedValue(mockSearchResults);
    addEntry.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const addButton = clickButton('Lägg till dans');
    await act(async () => {
      addButton?.click();
    });

    const searchInput = getInputByLabel('Sök efter dans');
    await act(async () => {
      typeInto(searchInput!, 'Fam');
      vi.advanceTimersByTime(300);
    });

    const resultButton = clickButton('Familjevals från Ödsmål');
    await act(async () => {
      resultButton?.click();
    });

    const addFromResultButton = confirmButtonFor(resultButton);
    await act(async () => {
      addFromResultButton?.click();
      vi.advanceTimersByTime(300);
    });

    const searchPanel = getInputByLabel('Sök efter dans')!.closest('div')!.parentElement!;
    const alert = searchPanel.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Det gick inte att lägga till dansen.');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the add-track error inline next to the track search panel, not as a toast', async () => {
    const mockTrack = {
      id: 'track-3',
      title: 'Ny låt',
      artistName: 'Testartisten',
      durationMs: 190000,
      danceStyle: 'familjevals',
      source: 'spotify',
    };
    searchTracks.mockResolvedValue({
      items: [mockTrack],
      total: 1,
      page: 0,
      size: 20,
      hasMore: false,
    });
    addTrackToEntry.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const addTrackButtons = Array.from(document.body.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Lägg till låt'),
    );
    await act(async () => {
      addTrackButtons[0]?.click();
    });

    const searchInput = getInputByLabel('Lägg till låt i');
    await act(async () => {
      typeInto(searchInput!, 'Ny');
      vi.advanceTimersByTime(300);
    });

    const addFromResultButton = addButtonInResult('Ny låt');
    await act(async () => {
      addFromResultButton?.click();
      vi.advanceTimersByTime(300);
    });

    const trackSearchPanel = getInputByLabel('Lägg till låt i')!.closest('div')!.parentElement!;
    const alert = trackSearchPanel.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Det gick inte att lägga till låten.');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the remove-dance error inline next to that dance entry, not as a toast', async () => {
    removeEntry.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const removeButton = await openRemoveDanceItem('Familjevals från Ödsmål');
    await act(async () => {
      removeButton?.click();
    });

    const confirmButton = clickButton('Ja, ta bort');
    await act(async () => {
      confirmButton?.click();
      vi.advanceTimersByTime(300);
    });

    const entry = Array.from(document.body.querySelectorAll('li')).find((li) =>
      li.textContent?.includes('Familjevals från Ödsmål'),
    );
    expect(entry).toBeDefined();
    const alert = entry!.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Det gick inte att ta bort dansen.');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the remove-track error inline next to that track, not as a toast', async () => {
    removeTrackFromEntry.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const removeTrackButtons = getRemoveTrackButtons();
    await act(async () => {
      removeTrackButtons[0]?.click();
    });

    const confirmButton = clickButton('Ja, ta bort');
    await act(async () => {
      confirmButton?.click();
      vi.advanceTimersByTime(300);
    });

    const entry = Array.from(document.body.querySelectorAll('li')).find((li) =>
      li.textContent?.includes('Familjevals från Ödsmål'),
    );
    expect(entry).toBeDefined();
    const alert = entry!.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Det gick inte att ta bort låten.');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the play-mode error inline next to the play-mode control, not as a toast', async () => {
    setPlayMode.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const randomButton = getPlayModeButton('Familjevals från Ödsmål', 'Slumpvis');

    await act(async () => {
      randomButton.click();
      vi.advanceTimersByTime(300);
    });

    const entry = Array.from(document.body.querySelectorAll('li')).find((li) =>
      li.textContent?.includes('Familjevals från Ödsmål'),
    );
    expect(entry).toBeDefined();
    const alert = entry!.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Det gick inte att ändra spelläget.');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('keeps the remove error of one entry when another entry is removed', async () => {
    removeEntry.mockImplementation((_listId: string, entryId: string) =>
      entryId === 'entry-1' ? Promise.reject(new Error('Server error')) : Promise.resolve(undefined),
    );

    await renderPage();

    function findEntry(danceName: string) {
      const li = Array.from(document.body.querySelectorAll('li')).find((el) =>
        el.textContent?.includes(danceName),
      );
      expect(li).toBeDefined();
      return li as HTMLLIElement;
    }

    function clickIn(el: HTMLElement, text: string) {
      const button = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
      expect(button).toBeDefined();
      button!.click();
    }

    function clickByLabelIn(el: HTMLElement, label: string) {
      const button = el.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
      expect(button).not.toBeNull();
      button!.click();
    }

    const entryA = findEntry('Familjevals från Ödsmål');
    await act(async () => {
      clickByLabelIn(entryA, 'Fler alternativ för Familjevals från Ödsmål');
    });
    await act(async () => {
      clickIn(entryA, 'Ta bort dansen');
    });
    await act(async () => {
      clickIn(entryA, 'Ja, ta bort');
      vi.advanceTimersByTime(300);
    });

    expect(entryA.querySelector('[role="alert"]')?.textContent).toContain('Det gick inte att ta bort dansen.');

    const entryB = findEntry('Egen dans');
    await act(async () => {
      clickByLabelIn(entryB, 'Fler alternativ för Egen dans');
    });
    await act(async () => {
      clickIn(entryB, 'Ta bort dansen');
    });
    await act(async () => {
      clickIn(entryB, 'Ja, ta bort');
      vi.advanceTimersByTime(300);
    });

    expect(removeEntry).toHaveBeenCalledWith('list-1', 'entry-2');
    expect(entryA.querySelector('[role="alert"]')?.textContent).toContain('Det gick inte att ta bort dansen.');
  });
  it('folds the tracks of a dance away and back', async () => {
    await renderPage();

    const toggle = document.body.querySelector(
      'button[aria-label="Visa eller dölj låtar för Familjevals från Ödsmål"]',
    ) as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).toContain('Första låten');

    await act(async () => {
      toggle!.click();
    });

    expect(toggle!.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.textContent).not.toContain('Första låten');

    await act(async () => {
      toggle!.click();
    });

    expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).toContain('Första låten');
  });

  it('moves a dance down with the keyboard and saves the order', async () => {
    reorderEntries.mockResolvedValue(undefined);

    await renderPage();

    const grip = document.body.querySelector('button[aria-label="Flytta dans 1"]') as HTMLButtonElement | null;
    expect(grip).not.toBeNull();

    await act(async () => {
      grip!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      vi.advanceTimersByTime(300);
    });

    expect(reorderEntries).toHaveBeenCalledWith('list-1', { entryIds: ['entry-2', 'entry-1'] });
    const names = Array.from(document.body.querySelectorAll('ol > li'))
      .map((li) => li.textContent ?? '')
      .filter((t) => t.length > 0);
    expect(names[0]).toContain('Egen dans');
    expect(names[1]).toContain('Familjevals från Ödsmål');
  });

  it('puts the order back and says so when saving the order fails', async () => {
    reorderEntries.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const grip = document.body.querySelector('button[aria-label="Flytta dans 1"]') as HTMLButtonElement | null;
    await act(async () => {
      grip!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      vi.advanceTimersByTime(300);
    });

    expect(toastSpy).toHaveBeenCalledWith('Kunde inte ändra ordning', 'error');
    const names = Array.from(document.body.querySelectorAll('ol > li'))
      .map((li) => li.textContent ?? '')
      .filter((t) => t.length > 0);
    expect(names[0]).toContain('Familjevals från Ödsmål');
  });

  it('a person who may only view sees no reorder handle or menu', async () => {
    getDanceList.mockResolvedValue(mockDanceListReadOnly);

    await renderPage();

    expect(document.body.querySelector('button[aria-label^="Flytta dans"]')).toBeNull();
    expect(document.body.querySelector('button[aria-label^="Fler alternativ för"]')).toBeNull();
  });
});
