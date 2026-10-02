import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MyLibraryPage } from './MyLibraryPage';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { authValue, loggedInAuthValue } from '@/test/authValue';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const listTracks = vi.fn();
const deleteSource = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/library/library', () => ({
  listTracks: () => listTracks(),
  deleteSource: (...args: unknown[]) => deleteSource(...args),
}));

vi.mock('@/auth/useAuth', () => ({ useAuth: () => useAuth() }));

vi.mock('@/library/useLibraryImport', () => ({
  useLibraryImport: () => ({ importFiles: vi.fn(), progress: null, error: null }),
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
});
