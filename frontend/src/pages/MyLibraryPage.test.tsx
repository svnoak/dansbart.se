import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MyLibraryPage } from './MyLibraryPage';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { LocalFilePermissionDenied } from '@/library/localHandles';
import { toastListeners } from '@/ui/toastEmitter';
import { authValue, loggedInAuthValue } from '@/test/authValue';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const listTracks = vi.fn();
const deleteSource = vi.fn();
const useAuth = vi.fn();
const play = vi.fn();
const getLocalFileForTrack = vi.fn();
const canKeepHandles = vi.fn();
const pickAudioFiles = vi.fn();

vi.mock('@/api/generated/library/library', () => ({
  listTracks: () => listTracks(),
  deleteSource: (...args: unknown[]) => deleteSource(...args),
}));

vi.mock('@/auth/useAuth', () => ({ useAuth: () => useAuth() }));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => ({ play, currentTrack: null, isPlaying: false }),
}));

vi.mock('@/library/localHandles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/library/localHandles')>()),
  canKeepHandles: () => canKeepHandles(),
  pickAudioFiles: (...args: unknown[]) => pickAudioFiles(...args),
  getLocalFileForTrack: (...args: unknown[]) => getLocalFileForTrack(...args),
}));

const importFiles = vi.fn();
vi.mock('@/library/useLibraryImport', () => ({
  useLibraryImport: () => ({ importFiles: importFiles, progress: null, error: null }),
}));

vi.mock('@/components/TrackRow/StyleVotePanel', () => ({
  StyleVotePanel: ({ open, trackId }: { open: boolean; trackId: string }) =>
    open ? <div role="dialog">Röst för {trackId}</div> : null,
}));

const sources = [
  { sourceId: 's1', trackId: 't1', title: 'Vals efter Anna', artist: 'Anna', provider: 'LOCAL' },
  { sourceId: 's2', trackId: 't2', title: 'Polka', artist: 'Bo', provider: 'LOCAL' },
];

describe('MyLibraryPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    listTracks.mockReset();
    deleteSource.mockReset();
    useAuth.mockReset();
    play.mockReset();
    getLocalFileForTrack.mockReset();
    importFiles.mockReset();
    canKeepHandles.mockReset();
    pickAudioFiles.mockReset();
    canKeepHandles.mockReturnValue(false);
    getLocalFileForTrack.mockResolvedValue(new File(['audio bytes'], 'vals.mp3'));
    useAuth.mockReturnValue(loggedInAuthValue({}));
    listTracks.mockResolvedValue(sources);
    deleteSource.mockResolvedValue({});
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
        </MemoryRouter>,
      );
    });
  }

  function getButtons(text: string) {
    return Array.from(document.body.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes(text),
    );
  }

  it('lists the imported tracks', async () => {
    await renderPage();

    expect(document.body.textContent).toContain('Mina låtar');
    expect(document.body.textContent).toContain('Vals efter Anna');
    expect(document.body.textContent).toContain('Bo');
    expect(getButtons('Importera låtar')).toHaveLength(1);
  });

  it('opens the vote from Kategorisera', async () => {
    await renderPage();

    await act(async () => getButtons('Kategorisera')[1].click());

    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('t2');
  });

  it('plays a track from its row', async () => {
    await renderPage();

    await act(async () => document.body.querySelectorAll<HTMLButtonElement>('button[aria-label="Spela"]')[1].click());

    const polka = {
      id: 't2',
      title: 'Polka',
      artistName: 'Bo',
      playable: true,
      playbackLinks: [],
    };
    expect(play).toHaveBeenCalledWith(polka, [expect.objectContaining({ id: 't1' }), polka]);
  });

  async function clickFirstPlayAndCollectToasts() {
    const messages: unknown[] = [];
    const listener = (message: unknown) => messages.push(message);
    toastListeners.add(listener);
    await renderPage();
    await act(async () =>
      document.body.querySelector<HTMLButtonElement>('button[aria-label="Spela"]')!.click(),
    );
    toastListeners.delete(listener);
    return messages;
  }

  it('shows an error when the file cannot be read', async () => {
    getLocalFileForTrack.mockRejectedValue(new LocalFilePermissionDenied());

    const messages = await clickFirstPlayAndCollectToasts();

    expect(messages).toEqual([
      expect.objectContaining({
        text: 'Dansbart.se kan inte läsa filen. Tillåt åtkomst och försök igen.',
        variant: 'error',
      }),
    ]);
    expect(play).not.toHaveBeenCalled();
  });

  it('offers Välj filen igen when the file is missing', async () => {
    getLocalFileForTrack.mockResolvedValue(undefined);

    await clickFirstPlayAndCollectToasts();

    expect(getButtons('Välj filen igen')).toHaveLength(1);
    expect(document.body.querySelectorAll('button[aria-label="Spela"]')).toHaveLength(1);
    expect(play).not.toHaveBeenCalled();
  });

  it('removes a track with Ta bort', async () => {
    await renderPage();

    await act(async () => getButtons('Ta bort')[0].click());

    expect(deleteSource).toHaveBeenCalledWith('s1');
    expect(document.body.textContent).not.toContain('Vals efter Anna');
    expect(document.body.textContent).toContain('Polka');
  });

  it('shows the empty state', async () => {
    listTracks.mockResolvedValue([]);

    await renderPage();

    expect(document.body.textContent).toContain('Du har inga låtar än. Importera en låt för att börja.');
  });

  it('sends a signed-out person to login', async () => {
    useAuth.mockReturnValue(authValue());

    await renderPage();

    expect(document.body.textContent).toContain('Inloggningssidan');
    expect(listTracks).not.toHaveBeenCalled();
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
});
