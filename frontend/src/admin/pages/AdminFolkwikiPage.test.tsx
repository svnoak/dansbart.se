import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdminFolkwikiPage } from './AdminFolkwikiPage';
import * as toastEmitter from '@/admin/components/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getCounts = vi.fn();
const getMatches = vi.fn();
const postImport = vi.fn();
const putAction = vi.fn();
const putStyle = vi.fn();
const postKeyword = vi.fn();
const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes('/api/admin/folkwiki/matches/counts')) return getCounts();
  if (url.includes('/api/admin/folkwiki/matches?')) return getMatches();
  if (url.includes('/api/admin/folkwiki/import')) return postImport();
  if (url.includes('/api/admin/style-keywords')) return postKeyword();
  if (/\/tunes\/\d+\/style/.test(url)) return putStyle();
  if (/\/matches\/[^/]+\/\d+\/(confirm|reject)/.test(url)) return putAction();
  throw new Error(`unexpected apiFetch call: ${String(init?.method)} ${url}`);
});

vi.mock('@/api/http-client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

const getStyleTree = vi.fn();
vi.mock('@/api/generated/styles/styles', () => ({
  getStyleTree: (...args: unknown[]) => getStyleTree(...args),
}));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => ({
    currentTrack: null,
    isPlaying: false,
    play: vi.fn(),
    togglePlayPause: vi.fn(),
  }),
}));

const mockMatch = {
  trackId: 'track-1',
  trackTitle: 'Vals i Bingsjö',
  dbStyle: 'Vals',
  dbSubStyle: null,
  dbConfidence: 0.9,
  classificationSource: null,
  folkwikiTuneId: 42,
  folkwikiId: 'fw-42',
  folkwikiTitle: 'Vals fran Bingsjo (fw)',
  folkwikiStyle: 'Vals',
  folkwikiMeter: '3/4',
  folkwikiBpb: 3,
  folkwikiUrl: 'https://folkwiki.se/t/42',
  matchType: 'exact',
  matchStatus: 'pending',
  playbackLinks: [],
};

const mockMatchesData = { items: [mockMatch], total: 1 };
const mockCountsData = { pending: 1, confirmed: 0, rejected: 0, total: 1 };
const mockStyleTree = [{ name: 'Polska', subStyles: ['Bingsjöpolska'] }];

describe('AdminFolkwikiPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    apiFetch.mockClear();
    getCounts.mockReset();
    getMatches.mockReset();
    postImport.mockReset();
    putAction.mockReset();
    putStyle.mockReset();
    postKeyword.mockReset();
    getStyleTree.mockReset();
    getCounts.mockResolvedValue({ ok: true, json: async () => mockCountsData });
    getMatches.mockResolvedValue({ ok: true, json: async () => mockMatchesData });
    getStyleTree.mockResolvedValue(mockStyleTree);
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
          <AdminFolkwikiPage />
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

  function findMatchRow(trackTitle: string) {
    const span = Array.from(document.body.querySelectorAll('span')).find((el) => el.textContent === trackTitle);
    expect(span).toBeDefined();
    const row = span!.closest('.rounded-lg');
    expect(row).toBeDefined();
    return row as HTMLDivElement;
  }

  async function click(button: HTMLButtonElement) {
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('shows a load error banner above the list when fetching folkwiki matches fails, with a Försök igen button that reloads', async () => {
    getMatches.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await renderPage();

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hamta folkwiki-matchningar');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
    expect(document.body.textContent).not.toContain('Inga matchningar att visa');

    await click(clickButton('Försök igen'));

    expect(getMatches).toHaveBeenCalledTimes(2);
  });

  it('shows the import error inline next to the import button, not as a toast', async () => {
    await renderPage();

    postImport.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const fileInput = document.body.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(fileInput).toBeTruthy();
    const file = new File(['{}'], 'import.json', { type: 'application/json' });
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const button = clickButton('Importera JSON');
    const alert = button.parentElement?.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Import misslyckades');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the confirm-match error inline in that match row, not as a toast', async () => {
    putAction.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await renderPage();

    const row = findMatchRow('Vals i Bingsjö');
    await click(clickButton('Bekrafta', row));

    const alert = row.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Misslyckades');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the reject-modal-prefetch error inline in that match row, not as a toast', async () => {
    getStyleTree.mockRejectedValueOnce(new Error('Server error'));

    await renderPage();

    const row = findMatchRow('Vals i Bingsjö');
    await click(clickButton('Avvisa', row));

    const alert = row.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hamta stilar');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the correct-style error inline next to the style dialog confirm button, not as a toast', async () => {
    putAction.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'style_unknown', folkwikiStyle: 'Vals fran Bingsjo' }),
    });
    putStyle.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await renderPage();

    const row = findMatchRow('Vals i Bingsjö');
    await click(clickButton('Bekrafta', row));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    await click(clickButton('Rätta och bekräfta', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte spara stil');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the add-keyword error inline next to the style dialog confirm button, not as a toast', async () => {
    putAction.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'style_unknown', folkwikiStyle: 'Vals fran Bingsjo' }),
    });
    postKeyword.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await renderPage();

    const row = findMatchRow('Vals i Bingsjö');
    await click(clickButton('Bekrafta', row));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    await click(clickButton('Ny huvudstil', dialog));
    await click(clickButton('Lagg till och bekrafta', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte skapa nyckelord');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the reject-with-override error inline next to the reject dialog confirm button, not as a toast', async () => {
    putAction.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await renderPage();

    const row = findMatchRow('Vals i Bingsjö');
    await click(clickButton('Avvisa', row));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    const select = dialog.querySelector('select')!;
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value',
      )!.set!;
      nativeSetter.call(select, 'Polska');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await click(clickButton('Avvisa och satt Polska', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Misslyckades');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
