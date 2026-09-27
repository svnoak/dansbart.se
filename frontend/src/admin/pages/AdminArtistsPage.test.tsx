import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdminArtistsPage } from './AdminArtistsPage';
import * as toastEmitter from '@/admin/components/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getArtists1 = vi.fn();
const approveArtist = vi.fn();
const rejectArtist = vi.fn();

vi.mock('@/api/generated/admin-artists/admin-artists', () => ({
  getArtists1: (...args: unknown[]) => getArtists1(...args),
  approveArtist: (...args: unknown[]) => approveArtist(...args),
  rejectArtist: (...args: unknown[]) => rejectArtist(...args),
}));

const mockArtists = {
  items: [
    { id: 'artist-1', name: 'Spelmanslaget', trackCount: 5, approvedTrackCount: 2, pendingTrackCount: 3 },
  ],
  total: 1,
};

describe('AdminArtistsPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    getArtists1.mockReset();
    approveArtist.mockReset();
    rejectArtist.mockReset();
    getArtists1.mockResolvedValue(mockArtists);
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
          <AdminArtistsPage />
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

  it('shows a load error banner above the list when fetching artists fails, with a Försök igen button that reloads', async () => {
    getArtists1.mockRejectedValueOnce(new Error('Server error'));

    await renderPage();

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta artister');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');

    await click(clickButton('Försök igen'));

    expect(getArtists1).toHaveBeenCalledTimes(2);
  });

  it('shows the approve error inline in that artist row, not as a toast', async () => {
    approveArtist.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const row = findRow('Spelmanslaget');
    const menuButton = row.querySelector<HTMLButtonElement>('button[aria-label="Åtgärder"]');
    expect(menuButton).toBeDefined();
    await click(menuButton!);

    await click(clickButton('Godkänn & analysera', row));

    const alert = row.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte godkänna artist');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the reject-artist error inline next to the modal confirm button, not as a toast', async () => {
    rejectArtist.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const row = findRow('Spelmanslaget');
    const menuButton = row.querySelector<HTMLButtonElement>('button[aria-label="Åtgärder"]');
    expect(menuButton).toBeDefined();
    await click(menuButton!);

    await click(clickButton('Radera & blockera', row));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    await click(clickButton('Radera & blockera', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte avvisa artist');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
