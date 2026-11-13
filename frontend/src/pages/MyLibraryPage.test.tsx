import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MyLibraryPage } from './MyLibraryPage';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { toastListeners } from '@/ui/toastEmitter';
import { authValue, loggedInAuthValue } from '@/test/authValue';
import { ThemeProvider } from '@/theme/ThemeContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const listMyTracks = vi.fn();
const deleteLibraryTrack = vi.fn();
const useAuth = vi.fn();
const play = vi.fn();
const addToQueue = vi.fn();
const hasLocalFileForTrack = vi.fn();
const getLocalFileForTrack = vi.fn();
const canKeepHandles = vi.fn();
const pickAudioFiles = vi.fn();
const canPickFolder = vi.fn();
const canKeepFolderHandles = vi.fn();
const pickAudioFolder = vi.fn();
const audioFilesFromDrop = vi.fn();

vi.mock('@/api/generated/library/library', () => ({
  listMyTracks: () => listMyTracks(),
  deleteLibraryTrack: (...args: unknown[]) => deleteLibraryTrack(...args),
}));

vi.mock('@/auth/useAuth', () => ({ useAuth: () => useAuth() }));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => ({
    play,
    addToQueue,
    currentTrack: null,
    isPlaying: false,
  }),
}));

vi.mock('@/favorites/useFavorites', () => ({
  useFavorites: () => ({
    isFavorited: () => false,
    toggleFavorite: vi.fn(),
  }),
}));

vi.mock('@/library/localHandles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/library/localHandles')>()),
  hasLocalFileForTrack: (...args: unknown[]) => hasLocalFileForTrack(...args),
  canKeepHandles: () => canKeepHandles(),
  pickAudioFiles: (...args: unknown[]) => pickAudioFiles(...args),
  canPickFolder: () => canPickFolder(),
  canKeepFolderHandles: () => canKeepFolderHandles(),
  pickAudioFolder: () => pickAudioFolder(),
  audioFilesFromDrop: (...args: unknown[]) => audioFilesFromDrop(...args),
  getLocalFileForTrack: (...args: unknown[]) => getLocalFileForTrack(...args),
}));

const importFiles = vi.fn();
vi.mock('@/library/useLibraryImport', () => ({
  useLibraryImport: () => ({ importFiles: importFiles, progress: null, error: null }),
}));

const deleteLocalCopy = vi.fn();
const requestPersistentStorage = vi.fn();
vi.mock('@/library/localCopies', () => ({
  deleteLocalCopy: (...args: unknown[]) => deleteLocalCopy(...args),
  requestPersistentStorage: () => requestPersistentStorage(),
}));

vi.mock('@/components/TrackRow/StyleVotePanel', () => ({
  StyleVotePanel: ({ open, trackId }: { open: boolean; trackId: string }) =>
    open ? <div role="dialog">Röst för {trackId}</div> : null,
}));

const entries = [
  {
    track: {
      id: 't1',
      title: 'Vals efter Anna',
      artistName: 'Anna',
      albumTitle: 'Skiva 1',
      danceStyle: 'Polska',
      tempoCategory: 'Medium',
      playable: true,
      playbackLinks: [],
    },
    linkedToCatalog: true,
    sources: [
      { sourceId: 's1', provider: 'LOCAL' as const },
      { sourceId: 's2', provider: 'GDRIVE' as const },
    ],
  },
  {
    track: {
      id: 't2',
      title: 'Polka',
      artistName: 'Bo',
      danceStyle: 'Polka',
      tempoCategory: 'Fast',
      playable: true,
      playbackLinks: [],
    },
    linkedToCatalog: false,
    sources: [{ sourceId: 's3', provider: 'LOCAL' as const }],
  },
];

describe('MyLibraryPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    listMyTracks.mockReset();
    deleteLibraryTrack.mockReset();
    useAuth.mockReset();
    play.mockReset();
    addToQueue.mockReset();
    hasLocalFileForTrack.mockReset();
    getLocalFileForTrack.mockReset();
    importFiles.mockReset();
    canKeepHandles.mockReset();
    pickAudioFiles.mockReset();
    deleteLocalCopy.mockReset();
    requestPersistentStorage.mockReset();
    canPickFolder.mockReset();
    canKeepFolderHandles.mockReset();
    pickAudioFolder.mockReset();
    audioFilesFromDrop.mockReset();
    canPickFolder.mockReturnValue(true);
    canKeepFolderHandles.mockReturnValue(true);
    hasLocalFileForTrack.mockResolvedValue(true);
    canKeepHandles.mockReturnValue(false);
    getLocalFileForTrack.mockResolvedValue(new File(['audio bytes'], 'vals.mp3'));
    useAuth.mockReturnValue(loggedInAuthValue({}));
    listMyTracks.mockResolvedValue(entries);
    deleteLibraryTrack.mockResolvedValue({});
    deleteLocalCopy.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <MemoryRouter initialEntries={['/mina-latar']}>
            <Routes>
              <Route
                path="/mina-latar"
                element={
                  <ProtectedRoute>
                    <MyLibraryPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<p>Inloggningssidan</p>} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>,
      );
    });
  }

  function getButtons(text: string) {
    return Array.from(document.body.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes(text),
    );
  }

  function getMenuButton() {
    return Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Mer',
    );
  }

  it('lists a track once with its style, tempo, album and sources', async () => {
    listMyTracks.mockResolvedValue([entries[0]]);

    await renderPage();

    expect(document.body.textContent).toContain('Polska');
    expect(document.body.textContent).toContain('Lagom');
    expect(document.body.textContent).toContain('Anna · Skiva 1');
    expect(document.body.textContent).toContain('Lokalt');
    expect(document.body.textContent).toContain('Google Drive');
  });

  it('removes a track from Mina låtar through the row menu', async () => {
    listMyTracks.mockResolvedValue([entries[0]]);
    const messages: unknown[] = [];
    const listener = (message: unknown) => messages.push(message);
    toastListeners.add(listener);

    await renderPage();

    const menuButton = getMenuButton();
    expect(menuButton).toBeTruthy();

    await act(async () => {
      menuButton?.click();
    });

    const menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
    const removeItem = menuItems.find((item) =>
      item.textContent?.includes('Ta bort från Mina låtar'),
    );
    expect(removeItem).toBeTruthy();

    await act(async () => {
      (removeItem as HTMLButtonElement)?.click();
    });

    expect(deleteLibraryTrack).toHaveBeenCalledWith('t1');
    expect(document.body.textContent).not.toContain('Vals efter Anna');
    expect(messages).toContainEqual(
      expect.objectContaining({
        text: 'Låten är borttagen',
      }),
    );

    toastListeners.delete(listener);
  });

  it('shows a toast when the removal fails', async () => {
    listMyTracks.mockResolvedValue([entries[0]]);
    deleteLibraryTrack.mockRejectedValue(new Error('Network error'));
    const messages: unknown[] = [];
    const listener = (message: unknown) => messages.push(message);
    toastListeners.add(listener);

    await renderPage();

    const menuButton = getMenuButton();
    expect(menuButton).toBeTruthy();

    await act(async () => {
      menuButton?.click();
    });

    const menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
    const removeItem = menuItems.find((item) =>
      item.textContent?.includes('Ta bort från Mina låtar'),
    );

    await act(async () => {
      (removeItem as HTMLButtonElement)?.click();
    });

    const errorMessage = messages.find(
      (m) => typeof m === 'object' && m !== null && 'variant' in m && (m as { variant: string }).variant === 'error',
    );
    expect(errorMessage).toBeTruthy();
    expect(document.body.textContent).toContain('Vals efter Anna');

    toastListeners.delete(listener);
  });

  it('hides Dela for a private track', async () => {
    listMyTracks.mockResolvedValue([entries[1]]);

    await renderPage();

    const menuButton = getMenuButton();
    expect(menuButton).toBeTruthy();

    await act(async () => {
      menuButton?.click();
    });

    const menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
    const shareItem = menuItems.find((item) => item.textContent?.includes('Dela'));

    expect(shareItem).toBeFalsy();
  });

  it('plays a track from its row', async () => {
    await renderPage();

    await act(async () =>
      document.body.querySelector<HTMLButtonElement>('button[aria-label="Spela"]')?.click(),
    );

    expect(play).toHaveBeenCalledWith(entries[0].track, expect.any(Array));
  });

  it('offers Välj filen igen when the file is missing', async () => {
    listMyTracks.mockResolvedValue([entries[0]]);
    hasLocalFileForTrack.mockResolvedValue(false);
    getLocalFileForTrack.mockResolvedValue(undefined);

    await renderPage();

    expect(document.body.querySelectorAll('button[aria-label="Välj filen igen"]')).toHaveLength(1);
    expect(document.body.querySelectorAll('button[aria-label="Spela"]')).toHaveLength(0);
    expect(play).not.toHaveBeenCalled();
  });

  it('shows the empty state', async () => {
    listMyTracks.mockResolvedValue([]);

    await renderPage();

    expect(document.body.textContent).toContain('Du har inga låtar än. Importera en låt för att börja.');
  });

  it('sends a signed-out person to login', async () => {
    useAuth.mockReturnValue(authValue());

    await renderPage();

    expect(document.body.textContent).toContain('Inloggningssidan');
    expect(listMyTracks).not.toHaveBeenCalled();
  });

  it('shows a load error', async () => {
    listMyTracks.mockRejectedValue(new Error('Network error'));

    await renderPage();

    expect(document.body.textContent).toContain('Det gick inte att hämta dina låtar.');
  });

  it.each([
    { imported: 12, skipped: 288, text: '12 låtar importerade, 288 fanns redan' },
    { imported: 1, skipped: 1, text: '1 låt importerad, 1 fanns redan' },
    { imported: 12, skipped: 0, text: '12 låtar importerade' },
    { imported: 0, skipped: 288, text: '288 låtar fanns redan' },
    { imported: 0, skipped: 1, text: '1 låt fanns redan' },
  ])('shows a toast with imported=$imported, skipped=$skipped', async ({ imported, skipped, text }) => {
    canKeepHandles.mockReturnValue(true);
    pickAudioFiles.mockResolvedValue([{ file: new File(['audio'], 'track.mp3') }]);
    importFiles.mockResolvedValue({ imported, skipped });
    const messages: unknown[] = [];
    const listener = (message: unknown) => messages.push(message);
    toastListeners.add(listener);
    await renderPage();
    await act(async () => getButtons('Importera låtar')[0].click());

    await vi.waitFor(() => {
      expect(messages).toContainEqual(
        expect.objectContaining({ text }),
      );
    });
    toastListeners.delete(listener);
  });

  it('shows no toast when no tracks are imported or skipped', async () => {
    canKeepHandles.mockReturnValue(true);
    pickAudioFiles.mockResolvedValue([{ file: new File(['audio'], 'track.mp3') }]);
    importFiles.mockResolvedValue({ imported: 0, skipped: 0 });
    const messages: unknown[] = [];
    const listener = (message: unknown) => messages.push(message);
    toastListeners.add(listener);
    await renderPage();
    await act(async () => getButtons('Importera låtar')[0].click());

    await vi.waitFor(() => expect(importFiles).toHaveBeenCalled());
    await act(async () => {});
    toastListeners.delete(listener);

    expect(messages).toHaveLength(0);
  });

  it('deletes the local copy after removing a track', async () => {
    listMyTracks.mockResolvedValue([entries[0]]);

    await renderPage();

    const menuButton = getMenuButton();
    expect(menuButton).toBeTruthy();

    await act(async () => {
      menuButton?.click();
    });

    const menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
    const removeItem = menuItems.find((item) =>
      item.textContent?.includes('Ta bort från Mina låtar'),
    );

    await act(async () => {
      (removeItem as HTMLButtonElement)?.click();
    });

    await vi.waitFor(() => expect(deleteLibraryTrack).toHaveBeenCalled());

    expect(deleteLocalCopy).toHaveBeenCalledWith('t1');
  });

  it('keeps the local copy when the removal fails', async () => {
    listMyTracks.mockResolvedValue([entries[0]]);
    deleteLibraryTrack.mockRejectedValue(new Error('Network error'));

    await renderPage();

    const menuButton = getMenuButton();
    expect(menuButton).toBeTruthy();

    await act(async () => {
      menuButton?.click();
    });

    const menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
    const removeItem = menuItems.find((item) =>
      item.textContent?.includes('Ta bort från Mina låtar'),
    );

    await act(async () => {
      (removeItem as HTMLButtonElement)?.click();
    });

    await vi.waitFor(() => expect(deleteLibraryTrack).toHaveBeenCalled());

    expect(deleteLocalCopy).not.toHaveBeenCalled();
  });

  it('asks for persistent storage when an import starts', async () => {
    listMyTracks.mockResolvedValue(entries);
    canKeepHandles.mockReturnValue(true);
    pickAudioFiles.mockResolvedValue([{ file: new File(['audio'], 'track.mp3') }]);
    importFiles.mockResolvedValue({ imported: 1, skipped: 0 });

    await renderPage();

    await act(async () => getButtons('Importera låtar')[0].click());

    expect(requestPersistentStorage).toHaveBeenCalledTimes(1);
  });

  it('imports the audio files of a picked folder', async () => {
    const picked = [{ file: new File(['audio'], 'vals.mp3') }];
    pickAudioFolder.mockResolvedValue(picked);
    importFiles.mockResolvedValue({ imported: 1, skipped: 0 });

    await renderPage();
    await act(async () => getButtons('Importera mapp')[0].click());

    await vi.waitFor(() => expect(importFiles).toHaveBeenCalledWith(picked));
  });

  it('hides Importera mapp when the browser cannot pick a folder', async () => {
    canPickFolder.mockReturnValue(false);

    await renderPage();

    expect(getButtons('Importera mapp')).toHaveLength(0);
    expect(getButtons('Importera låtar')).toHaveLength(1);
  });

  it('says so when a picked folder has no audio files', async () => {
    pickAudioFolder.mockResolvedValue([]);

    await renderPage();
    await act(async () => getButtons('Importera mapp')[0].click());

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Det fanns inga ljudfiler i det du valde.'),
    );
    expect(importFiles).not.toHaveBeenCalled();
  });

  it('imports nothing and shows no message when the person closes the folder picker', async () => {
    pickAudioFolder.mockResolvedValue(null);

    await renderPage();
    await act(async () => getButtons('Importera mapp')[0].click());

    expect(importFiles).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Det fanns inga ljudfiler');
  });

  it('picks the folder with a folder input when the browser keeps no folder handles', async () => {
    canKeepFolderHandles.mockReturnValue(false);
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    await renderPage();
    await act(async () => getButtons('Importera mapp')[0].click());

    const folderInput = click.mock.contexts[0] as HTMLInputElement;
    expect(folderInput.webkitdirectory).toBe(true);
    expect(pickAudioFolder).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('shows a folder read error next to the buttons', async () => {
    pickAudioFolder.mockRejectedValue(new DOMException('Gone', 'NotFoundError'));

    await renderPage();
    await act(async () => getButtons('Importera mapp')[0].click());

    await vi.waitFor(() =>
      expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
        'Det gick inte att läsa mappen. Försök igen.',
      ),
    );
  });

  it('imports dropped files and folders', async () => {
    const dropped = [{ file: new File(['audio'], 'polska.flac') }];
    audioFilesFromDrop.mockResolvedValue(dropped);
    importFiles.mockResolvedValue({ imported: 1, skipped: 0 });
    await renderPage();
    const page = container.querySelector('h1')!.closest('.relative')!;
    const dataTransfer = { types: ['Files'], items: [], dropEffect: 'none' };

    const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
    Object.assign(dragOver, { dataTransfer });
    await act(async () => page.dispatchEvent(dragOver));
    expect(document.body.textContent).toContain('Släpp filer eller mappar för att importera');

    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.assign(drop, { dataTransfer });
    await act(async () => page.dispatchEvent(drop));

    expect(audioFilesFromDrop).toHaveBeenCalledWith(dataTransfer);
    await vi.waitFor(() => expect(importFiles).toHaveBeenCalledWith(dropped));
    expect(document.body.textContent).not.toContain('Släpp filer eller mappar för att importera');
  });
});
