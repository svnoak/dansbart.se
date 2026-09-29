import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/dance-lists/fd65acf9-e550-4c4b-b296-71294ae4c96c']}>
        {children}
      </MemoryRouter>
    ),
  };
});

vi.mock('./layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./analytics/PageTracker', () => ({
  PageTracker: () => null,
}));

vi.mock('@grafana/faro-react', async () => {
  const actual = await vi.importActual('react-router-dom');
  const { Routes } = actual as typeof import('react-router-dom');
  return {
    FaroRoutes: ({ children }: { children: React.ReactNode }) => <Routes>{children}</Routes>,
  };
});

vi.mock('@/consent/ConsentContext', () => ({
  ConsentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/consent/CookieBanner', () => ({
  CookieBanner: () => null,
}));

vi.mock('@/player/PlayerContext', () => ({
  PlayerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/favorites/FavoritesContext', () => ({
  FavoritesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/theme/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/admin/layout/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/pages/DanceListPage', () => ({
  default: () => <div data-testid="dance-list-page">Dance List Page Content</div>,
}));

describe('App', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it('runs', () => {
    expect(true).toBe(true);
  });

  it('renders the dance list page at /dance-lists/:id', async () => {
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    const danceListPage = container.querySelector('[data-testid="dance-list-page"]');
    const notFoundText = container.textContent?.includes('Sidan hittades inte');

    expect(danceListPage).not.toBeNull();
    expect(notFoundText).toBe(false);
  });
});
