import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlaylistRoutePage } from './PlaylistRoutePage';
import { authValue, loggedInAuthValue } from '@/test/authValue';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const useAuth = vi.fn();

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/pages/PlaylistPage', () => ({
  PlaylistPage: () => <p>Hela spellistesidan</p>,
}));

vi.mock('@/pages/SharedPlaylistPage', () => ({
  SharedPlaylistPage: ({ source }: { source?: string }) => <p>Läsvy: {source}</p>,
}));

describe('PlaylistRoutePage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useAuth.mockReset();
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
        <MemoryRouter initialEntries={['/playlists/p1']}>
          <Routes>
            <Route path="/playlists/:id" element={<PlaylistRoutePage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  it('gives a signed-in person the full playlist page', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1' }));
    await renderPage();
    expect(document.body.textContent).toContain('Hela spellistesidan');
  });

  it('gives a visitor the read-only page of a public playlist, not a login page', async () => {
    useAuth.mockReturnValue(authValue());
    await renderPage();
    expect(document.body.textContent).toContain('Läsvy: public');
  });

  it('waits for the sign-in check before it chooses', async () => {
    useAuth.mockReturnValue(authValue({ isLoading: true }));
    await renderPage();
    expect(document.body.textContent).not.toContain('Hela spellistesidan');
    expect(document.body.textContent).not.toContain('Läsvy');
  });
});
