import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdminAlbumsPage } from './AdminAlbumsPage';
import * as toastEmitter from '@/admin/components/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getAlbums1 = vi.fn();
const rejectAlbum = vi.fn();

vi.mock('@/api/generated/admin-albums/admin-albums', () => ({
  getAlbums1: (...args: unknown[]) => getAlbums1(...args),
  rejectAlbum: (...args: unknown[]) => rejectAlbum(...args),
}));

const mockAlbums = {
  items: [
    { id: 'album-1', name: 'Spelmanslåtar', artistName: 'Testartisten', trackCount: 10, releaseDate: '2020-01-01' },
  ],
  total: 1,
};

describe('AdminAlbumsPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    getAlbums1.mockReset();
    rejectAlbum.mockReset();
    getAlbums1.mockResolvedValue(mockAlbums);
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
          <AdminAlbumsPage />
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

  async function click(button: HTMLButtonElement) {
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('shows a load error banner above the list when fetching albums fails, with a Försök igen button that reloads', async () => {
    getAlbums1.mockRejectedValueOnce(new Error('Server error'));

    await renderPage();

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta album');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');

    await click(clickButton('Försök igen'));

    expect(getAlbums1).toHaveBeenCalledTimes(2);
  });

  it('shows the reject-album error inline next to the modal confirm button, not as a toast', async () => {
    rejectAlbum.mockRejectedValue(new Error('Server error'));

    await renderPage();

    await click(clickButton('Radera & blockera', document.querySelector('table')!));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    await click(clickButton('Radera & blockera', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte avvisa album');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
