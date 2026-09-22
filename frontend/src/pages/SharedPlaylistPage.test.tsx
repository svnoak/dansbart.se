import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SharedPlaylistPage } from './SharedPlaylistPage';
import { authValue } from '@/test/authValue';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getPlaylistByShareToken = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/playlists/playlists', () => ({
  getPlaylistByShareToken: (...args: unknown[]) => getPlaylistByShareToken(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => ({ play: vi.fn() }),
}));

vi.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

describe('SharedPlaylistPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getPlaylistByShareToken.mockReset();
    useAuth.mockReset();
    useAuth.mockReturnValue(authValue());
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
        <MemoryRouter initialEntries={['/shared/token123']}>
          <Routes>
            <Route path="/shared/:token" element={<SharedPlaylistPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  it('shows the group as owner', async () => {
    getPlaylistByShareToken.mockResolvedValue({
      id: 'p1',
      name: 'Gruppens spellista',
      description: undefined,
      isPublic: false,
      ownerGroup: { id: 'g1', name: 'Barngruppen', isPublic: true },
      owner: undefined,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Av gruppen Barngruppen');
  });

  it('shows the person as owner', async () => {
    getPlaylistByShareToken.mockResolvedValue({
      id: 'p1',
      name: 'Annas spellista',
      description: undefined,
      isPublic: false,
      owner: { id: 'u1', username: 'anna', displayName: 'Anna' },
      ownerGroup: undefined,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Av Anna');
  });
});
