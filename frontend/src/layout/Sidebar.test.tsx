import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { loggedInAuthValue, authValue } from '@/test/authValue';

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

const countUnreviewedContributions = vi.fn();

vi.mock('@/api/generated/admin-contributions/admin-contributions', () => ({
  countUnreviewedContributions: () => countUnreviewedContributions(),
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
    countUnreviewedContributions.mockReset();
    countUnreviewedContributions.mockResolvedValue({ tracks: 0, styles: 0 });
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

  it('shows a link to Mina låtar for a signed-in person', async () => {
    await renderSidebar();

    const link = Array.from(document.body.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Mina låtar'),
    );
    expect(link).toBeDefined();
    expect(link?.getAttribute('href')).toMatch(/\/mina-latar$/);
  });

  it('hides the Mina låtar link for a signed-out person', async () => {
    useAuth.mockReturnValue(authValue());
    await renderSidebar();

    const link = Array.from(document.body.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Mina låtar'),
    );
    expect(link).toBeUndefined();
  });

  function findLink(text: string) {
    return Array.from(document.body.querySelectorAll('a')).find((a) => a.textContent?.includes(text));
  }

  it('links to the add-track page, also for visitors so they find it', async () => {
    await renderSidebar();
    expect(findLink('Lägg till låt')?.getAttribute('href')).toBe('/lagg-till');

    useAuth.mockReturnValue(authValue());
    await renderSidebar();
    expect(findLink('Lägg till låt')?.getAttribute('href')).toBe('/lagg-till');
  });

  it('hides the add-track link from a banned person', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ banned: true }));
    await renderSidebar();
    expect(findLink('Lägg till låt')).toBeUndefined();
  });

  it('shows an admin how many additions wait for review', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ role: 'ADMIN' }));
    countUnreviewedContributions.mockResolvedValue({ tracks: 2, styles: 1 });
    await renderSidebar();

    const link = findLink('Nya bidrag att granska');
    expect(link?.getAttribute('href')).toBe('/admin/contributions');
    expect(link?.textContent).toContain('3');
  });

  it('shows no review link when nothing waits or the person is not an admin', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ role: 'ADMIN' }));
    await renderSidebar();
    expect(findLink('Nya bidrag')).toBeUndefined();

    useAuth.mockReturnValue(loggedInAuthValue({}));
    countUnreviewedContributions.mockResolvedValue({ tracks: 5, styles: 0 });
    await renderSidebar();
    expect(findLink('Nya bidrag')).toBeUndefined();
    expect(countUnreviewedContributions).toHaveBeenCalledTimes(1);
  });
});
