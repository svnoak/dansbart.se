import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AdminContributionsPage } from './AdminContributionsPage';
import * as toastEmitter from '@/admin/components/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getUnreviewedContributions = vi.fn();
const approveTrackContribution = vi.fn();
const removeTrackContribution = vi.fn();
const approveStyleContribution = vi.fn();
const removeStyleContribution = vi.fn();
const banUser = vi.fn();

vi.mock('@/api/generated/admin-contributions/admin-contributions', () => ({
  getUnreviewedContributions: () => getUnreviewedContributions(),
  approveTrackContribution: (id: string) => approveTrackContribution(id),
  removeTrackContribution: (id: string) => removeTrackContribution(id),
  approveStyleContribution: (id: string) => approveStyleContribution(id),
  removeStyleContribution: (id: string) => removeStyleContribution(id),
}));

vi.mock('@/api/generated/admin-users/admin-users', () => ({
  banUser: (id: string) => banUser(id),
}));

const contributions = {
  tracks: [
    {
      submissionId: 'sub-1',
      trackId: 'track-1',
      trackTitle: 'Polska efter Pelle',
      source: 'YOUTUBE',
      externalId: 'dQw4w9WgXcQ',
      artistName: 'Spelman',
      mainStyle: 'Polska',
      status: 'LINKED',
      createdTrack: true,
      processingStatus: 'PROCESSING',
      userId: 'user-1',
      username: 'kalle',
      userBanned: false,
      createdAt: '2026-11-09T10:00:00Z',
    },
  ],
  styles: [
    {
      id: 'style-1',
      mainStyle: 'Masurka',
      userId: 'user-2',
      username: 'lisa',
      userBanned: true,
      createdAt: '2026-11-09T11:00:00Z',
    },
  ],
};

describe('AdminContributionsPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    for (const fn of [getUnreviewedContributions, approveTrackContribution, removeTrackContribution,
      approveStyleContribution, removeStyleContribution, banUser]) {
      fn.mockReset();
      fn.mockResolvedValue(undefined);
    }
    getUnreviewedContributions.mockResolvedValue(contributions);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    toastSpy.mockRestore();
    root.unmount();
    container.remove();
  });

  async function render() {
    await act(async () => {
      root.render(<AdminContributionsPage />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function buttons(text: string): HTMLButtonElement[] {
    return Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent?.trim() === text);
  }

  async function click(button: HTMLButtonElement) {
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('lists added tracks and styles with their state in words', async () => {
    await render();
    const text = document.body.textContent;
    expect(text).toContain('Polska efter Pelle');
    expect(text).toContain('Analyseras');
    expect(text).toContain('kalle');
    expect(text).toContain('Masurka');
    expect(text).toContain('Egen dans');
    expect(text).toContain('Avstängd');
    const link = Array.from(document.body.querySelectorAll('a')).find((a) => a.textContent?.includes('Öppna på YouTube'));
    expect(link?.getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('keeps a track and refreshes the list', async () => {
    await render();
    await click(buttons('Behåll')[0]);

    expect(approveTrackContribution).toHaveBeenCalledWith('sub-1');
    expect(toastSpy).toHaveBeenCalledWith('Låten är granskad');
    expect(getUnreviewedContributions).toHaveBeenCalledTimes(2);
  });

  it('asks before removing a track', async () => {
    await render();
    await click(buttons('Ta bort')[0]);

    expect(removeTrackContribution).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('tas bort ur biblioteket för alla');
    const confirm = buttons('Ta bort').at(-1)!;
    await click(confirm);
    expect(removeTrackContribution).toHaveBeenCalledWith('sub-1');
  });

  it('bans the person who added a track after confirming', async () => {
    await render();
    await click(buttons('Stäng av')[0]);
    expect(document.body.textContent).toContain('kalle kan inte längre lägga till');

    await click(buttons('Stäng av').at(-1)!);
    expect(banUser).toHaveBeenCalledWith('user-1');
    expect(toastSpy).toHaveBeenCalledWith('kalle är avstängd');
  });

  it('shows a retry when the list cannot load', async () => {
    getUnreviewedContributions.mockRejectedValue(new Error('down'));
    await render();
    expect(document.body.textContent).toContain('Kunde inte hämta nya bidrag');
    expect(buttons('Försök igen').length).toBe(1);
  });
});
