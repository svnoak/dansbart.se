import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdminSuggestionsPage } from './AdminSuggestionsPage';
import * as toastEmitter from '@/admin/components/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getAdminSuggestions = vi.fn();
const acceptSuggestion = vi.fn();
const rejectSuggestion = vi.fn();
const getActivationPreview = vi.fn();
const activateSuggestion = vi.fn();

vi.mock('@/api/manual/suggestions', () => ({
  getAdminSuggestions: (...args: unknown[]) => getAdminSuggestions(...args),
  acceptSuggestion: (...args: unknown[]) => acceptSuggestion(...args),
  rejectSuggestion: (...args: unknown[]) => rejectSuggestion(...args),
  getActivationPreview: (...args: unknown[]) => getActivationPreview(...args),
  activateSuggestion: (...args: unknown[]) => activateSuggestion(...args),
}));

const mockContentSuggestions = {
  items: [
    {
      id: 'sugg-1',
      kind: 'content',
      payload: { title: 'Vals i Bingsjö', artistName: 'Testartisten' },
      status: 'pending',
    },
  ],
  total: 1,
};

const mockStyleSuggestions = {
  items: [
    {
      id: 'sugg-2',
      kind: 'dance_style',
      payload: { proposedMainStyle: 'Polska', proposedBeatsPerBar: 3 },
      status: 'accepted',
    },
  ],
  total: 1,
};

describe('AdminSuggestionsPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    getAdminSuggestions.mockReset();
    acceptSuggestion.mockReset();
    rejectSuggestion.mockReset();
    getActivationPreview.mockReset();
    activateSuggestion.mockReset();
    getAdminSuggestions.mockResolvedValue(mockContentSuggestions);
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
          <AdminSuggestionsPage />
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

  it('shows a load error banner above the list when fetching suggestions fails, with a Försök igen button that reloads', async () => {
    getAdminSuggestions.mockRejectedValueOnce(new Error('Server error'));

    await renderPage();

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta förslag');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
    expect(document.body.textContent).not.toContain('Inga förslag.');

    await click(clickButton('Försök igen'));

    expect(getAdminSuggestions).toHaveBeenCalledTimes(2);
  });

  it('shows the accept error inline in that suggestion row, not as a toast', async () => {
    acceptSuggestion.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const row = findRow('Vals i Bingsjö');
    await click(clickButton('Godkänn', row));

    const alert = row.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte godkänna förslaget');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the reject error inline next to the modal confirm button, not as a toast', async () => {
    rejectSuggestion.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const row = findRow('Vals i Bingsjö');
    await click(clickButton('Avvisa', row));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    await click(clickButton('Avvisa', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte avvisa förslaget');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the activation-preview error inline in that suggestion row, not as a toast', async () => {
    getAdminSuggestions.mockResolvedValue(mockStyleSuggestions);
    getActivationPreview.mockRejectedValue(new Error('Server error'));

    await renderPage();
    await click(clickButton('Dansstilar'));

    const row = findRow('Polska');
    await click(clickButton('Aktivera...', row));

    const alert = row.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta förhandsgranskning');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the activate error inline next to the activation modal confirm button, not as a toast', async () => {
    getAdminSuggestions.mockResolvedValue(mockStyleSuggestions);
    getActivationPreview.mockResolvedValue({
      mainStyle: 'Polska',
      proposedBeatsPerBar: 3,
      affectedTrackCount: 5,
    });
    activateSuggestion.mockRejectedValue(new Error('Server error'));

    await renderPage();
    await click(clickButton('Dansstilar'));

    const row = findRow('Polska');
    await click(clickButton('Aktivera...', row));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    await click(clickButton('Aktivera', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte aktivera förslaget');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
