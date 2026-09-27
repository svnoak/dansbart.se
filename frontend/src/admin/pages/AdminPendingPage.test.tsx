import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdminPendingPage } from './AdminPendingPage';
import * as toastEmitter from '@/admin/components/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getPendingArtistsForApproval = vi.fn();
const approvePendingArtist = vi.fn();
const rejectPendingArtist = vi.fn();
const getPendingAlbums = vi.fn();

vi.mock('@/api/generated/admin-pending/admin-pending', () => ({
  getPendingArtistsForApproval: (...args: unknown[]) => getPendingArtistsForApproval(...args),
  approvePendingArtist: (...args: unknown[]) => approvePendingArtist(...args),
  rejectPendingArtist: (...args: unknown[]) => rejectPendingArtist(...args),
  getPendingAlbums: (...args: unknown[]) => getPendingAlbums(...args),
}));

const mockPendingArtists = {
  items: [{ id: 'artist-1', name: 'Spelmanslaget', pendingTrackCount: 4 }],
  total: 1,
};

const mockPendingAlbums = {
  items: [{ id: 'album-1', name: 'Spelmanslåtar', artistName: 'Testartisten', pendingTrackCount: 4 }],
  total: 1,
};

describe('AdminPendingPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    getPendingArtistsForApproval.mockReset();
    approvePendingArtist.mockReset();
    rejectPendingArtist.mockReset();
    getPendingAlbums.mockReset();
    getPendingArtistsForApproval.mockResolvedValue(mockPendingArtists);
    getPendingAlbums.mockResolvedValue(mockPendingAlbums);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    toastSpy.mockRestore();
    root.unmount();
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <BrowserRouter>
          <AdminPendingPage />
        </BrowserRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function clickButton(text: string, scope: ParentNode = document.body) {
    const button = Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
  }

  function findRow(name: string) {
    const row = Array.from(document.body.querySelectorAll('tr')).find((tr) => tr.textContent?.includes(name));
    expect(row).toBeDefined();
    return row as HTMLTableRowElement;
  }

  async function click(button: HTMLButtonElement) {
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('shows a load error banner above the list when fetching pending artists fails, with a Försök igen button that reloads', async () => {
    getPendingArtistsForApproval.mockRejectedValueOnce(new Error('Server error'));

    await renderPage();

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta väntande artister');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');

    await click(clickButton('Försök igen'));

    expect(getPendingArtistsForApproval).toHaveBeenCalledTimes(2);
  });

  it('shows a load error banner above the list when fetching pending albums fails, with a Försök igen button that reloads', async () => {
    getPendingAlbums.mockRejectedValueOnce(new Error('Server error'));

    await renderPage();

    await click(clickButton('Album'));

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta väntande album');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');

    await click(clickButton('Försök igen'));

    expect(getPendingAlbums).toHaveBeenCalledTimes(2);
  });

  it('shows the approve error inline in that artist row, not as a toast', async () => {
    approvePendingArtist.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const row = findRow('Spelmanslaget');
    await click(clickButton('Godkänn & importera', row));

    const alert = row.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte godkänna');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the reject error inline next to the modal confirm button, not as a toast', async () => {
    rejectPendingArtist.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const row = findRow('Spelmanslaget');
    await click(clickButton('Avvisa', row));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    await click(clickButton('Avvisa', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte avvisa');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
