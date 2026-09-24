import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { loggedInAuthValue } from '@/test/authValue';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getInvitations = vi.fn();
const getGroupInvitations = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/playlists/playlists', () => ({
  getInvitations: (...args: unknown[]) => getInvitations(...args),
}));

vi.mock('@/api/generated/groups/groups', () => ({
  getGroupInvitations: (...args: unknown[]) => getGroupInvitations(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/consent/useConsent', () => ({
  useConsent: () => ({ consentStatus: null, openCookieSettings: vi.fn() }),
}));

describe('Sidebar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getInvitations.mockReset();
    getGroupInvitations.mockReset();
    useAuth.mockReset();
    getInvitations.mockResolvedValue([]);
    getGroupInvitations.mockResolvedValue([]);
    useAuth.mockReturnValue(loggedInAuthValue({}));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function renderSidebar() {
    await act(async () => {
      root.render(
        <BrowserRouter>
          <Sidebar />
        </BrowserRouter>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  }

  it('shows a link to dance lists for a logged-in person', async () => {
    await renderSidebar();

    const text = document.body.textContent;
    expect(text).toContain('Danslistor');

    const link = Array.from(document.body.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Danslistor'),
    );
    expect(link).toBeDefined();
    expect(link?.getAttribute('href')).toBe('/dance-lists');
  });
});
