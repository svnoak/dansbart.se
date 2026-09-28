import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdminLibraryPage } from './AdminLibraryPage';
import * as toastEmitter from '@/admin/components/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getTracks1 = vi.fn();
const reanalyzeTrack = vi.fn();
const reclassifyTrack = vi.fn();
const deleteTrack = vi.fn();
const rejectTrack = vi.fn();
const unflagTrack1 = vi.fn();
const getStyleTree = vi.fn();
const apiFetch = vi.fn();

vi.mock('@/api/generated/admin-tracks/admin-tracks', () => ({
  getTracks1: (...args: unknown[]) => getTracks1(...args),
  reanalyzeTrack: (...args: unknown[]) => reanalyzeTrack(...args),
  reclassifyTrack: (...args: unknown[]) => reclassifyTrack(...args),
  deleteTrack: (...args: unknown[]) => deleteTrack(...args),
  rejectTrack: (...args: unknown[]) => rejectTrack(...args),
  unflagTrack1: (...args: unknown[]) => unflagTrack1(...args),
}));

vi.mock('@/api/generated/styles/styles', () => ({
  getStyleTree: (...args: unknown[]) => getStyleTree(...args),
}));

vi.mock('@/api/http-client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => ({
    currentTrack: null,
    isPlaying: false,
    play: vi.fn(),
    togglePlayPause: vi.fn(),
  }),
}));

const mockTracks = {
  items: [
    {
      id: 'track-1',
      title: 'Vals på Bakfoten',
      durationMs: 180000,
      processingStatus: 'DONE',
      isFlagged: false,
      danceStyle: 'Vals',
      artists: [{ name: 'Testartisten' }],
      album: { title: 'Testalbum' },
    },
  ],
  total: 1,
};

const mockTwoTracks = {
  items: [
    mockTracks.items[0],
    {
      id: 'track-2',
      title: 'Polska i Skogen',
      durationMs: 200000,
      processingStatus: 'DONE',
      isFlagged: false,
      danceStyle: 'Polska',
      artists: [{ name: 'Testartisten' }],
      album: { title: 'Testalbum' },
    },
  ],
  total: 2,
};

describe('AdminLibraryPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    getTracks1.mockReset();
    reanalyzeTrack.mockReset();
    reclassifyTrack.mockReset();
    deleteTrack.mockReset();
    rejectTrack.mockReset();
    unflagTrack1.mockReset();
    getStyleTree.mockReset();
    apiFetch.mockReset();
    getTracks1.mockResolvedValue(mockTracks);
    getStyleTree.mockResolvedValue([]);
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
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
          <AdminLibraryPage />
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

  function findRow(text: string) {
    const row = Array.from(document.body.querySelectorAll('tr')).find((tr) => tr.textContent?.includes(text));
    expect(row).toBeDefined();
    return row as HTMLTableRowElement;
  }

  function openActionMenu(row: HTMLElement) {
    const button = row.querySelector('button[aria-label="Åtgärder"]');
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
  }

  function closestWithText(el: Element, text: string): HTMLElement {
    let current: HTMLElement | null = el as HTMLElement;
    while (current && !current.textContent?.includes(text)) {
      current = current.parentElement;
    }
    expect(current).toBeDefined();
    return current as HTMLElement;
  }

  async function click(button: HTMLButtonElement) {
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('shows a load error banner above the list when fetching tracks fails, with a Försök igen button that reloads', async () => {
    getTracks1.mockRejectedValueOnce(new Error('Server error'));

    await renderPage();

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta spår');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
    expect(document.body.textContent).not.toContain('Inga spår hittades. Prova att ändra filter.');

    await click(clickButton('Försök igen'));

    expect(getTracks1).toHaveBeenCalledTimes(2);
  });

  it('shows the dance style update error inline next to the Spara button in the style edit modal, not as a toast', async () => {
    apiFetch.mockImplementation((url: RequestInfo | URL) => {
      if (String(url).includes('/dance-style')) {
        return Promise.reject(new Error('Server error'));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });

    await renderPage();

    const row = findRow('Vals på Bakfoten');
    await click(clickButton('Vals', row));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    await click(clickButton('Spara', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte uppdatera dansstil');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the delete-track error inline next to the modal confirm button, not as a toast', async () => {
    deleteTrack.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const row = findRow('Vals på Bakfoten');
    await click(openActionMenu(row));
    await click(clickButton('Radera', row));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    await click(clickButton('Radera', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte radera spår');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the reject-track error inline next to the modal confirm button, not as a toast', async () => {
    rejectTrack.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const row = findRow('Vals på Bakfoten');
    await click(openActionMenu(row));
    await click(clickButton('Radera & blockera', row));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    await click(clickButton('Radera & blockera', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte avvisa spår');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the bulk reanalyze error inline next to the Omanalysera button in the bulk bar, not as a toast', async () => {
    reanalyzeTrack.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const row = findRow('Vals på Bakfoten');
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => {
      checkbox.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await click(clickButton('Omanalysera'));

    const button = clickButton('Omanalysera');
    const bar = closestWithText(button, 'markerade');
    const alert = bar.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Omanalysera: 1 av 1 misslyckades');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('keeps only the tracks whose bulk action failed selected, after a partial failure', async () => {
    getTracks1.mockResolvedValue(mockTwoTracks);
    reanalyzeTrack.mockImplementation((id: string) =>
      id === 'track-2' ? Promise.reject(new Error('Server error')) : Promise.resolve({}),
    );

    await renderPage();

    const row1 = findRow('Vals på Bakfoten');
    const row2 = findRow('Polska i Skogen');
    for (const row of [row1, row2]) {
      const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
      await act(async () => {
        checkbox.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    await click(clickButton('Omanalysera'));

    const checkbox1 = findRow('Vals på Bakfoten').querySelector('input[type="checkbox"]') as HTMLInputElement;
    const checkbox2 = findRow('Polska i Skogen').querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox1.checked).toBe(false);
    expect(checkbox2.checked).toBe(true);
  });

  it('clears the selection after a bulk action succeeds for every selected track', async () => {
    getTracks1.mockResolvedValue(mockTwoTracks);
    reanalyzeTrack.mockResolvedValue({});

    await renderPage();

    const row1 = findRow('Vals på Bakfoten');
    const row2 = findRow('Polska i Skogen');
    for (const row of [row1, row2]) {
      const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
      await act(async () => {
        checkbox.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    await click(clickButton('Omanalysera'));

    const checkbox1 = findRow('Vals på Bakfoten').querySelector('input[type="checkbox"]') as HTMLInputElement;
    const checkbox2 = findRow('Polska i Skogen').querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox1.checked).toBe(false);
    expect(checkbox2.checked).toBe(false);
  });

  it('clears a bulk error banner when the selection changes', async () => {
    getTracks1.mockResolvedValue(mockTwoTracks);
    reanalyzeTrack.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const checkbox1 = findRow('Vals på Bakfoten').querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => {
      checkbox1.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await click(clickButton('Omanalysera'));

    let bar = closestWithText(clickButton('Omanalysera'), 'markerade');
    expect(bar.querySelector('[role="alert"]')).toBeTruthy();

    const checkbox2 = findRow('Polska i Skogen').querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => {
      checkbox2.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    bar = closestWithText(clickButton('Omanalysera'), 'markerade');
    expect(bar.querySelector('[role="alert"]')).toBeFalsy();
  });
});
