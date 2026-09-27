import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AdminDuplicatesPage } from './AdminDuplicatesPage';
import * as toastEmitter from '@/admin/components/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getMergeableDuplicates = vi.fn();
const analyzeDuplicates = vi.fn();
const mergeDuplicates = vi.fn();
const mergeAllDuplicates = vi.fn();

vi.mock('@/api/generated/admin-duplicates/admin-duplicates', () => ({
  getMergeableDuplicates: (...args: unknown[]) => getMergeableDuplicates(...args),
  analyzeDuplicates: (...args: unknown[]) => analyzeDuplicates(...args),
  mergeDuplicates: (...args: unknown[]) => mergeDuplicates(...args),
  mergeAllDuplicates: (...args: unknown[]) => mergeAllDuplicates(...args),
}));

const mockGroups = [
  { isrc: 'ISRC1', count: 2, trackTitles: ['Vals i Bingsjö'] },
];

describe('AdminDuplicatesPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    getMergeableDuplicates.mockReset();
    analyzeDuplicates.mockReset();
    mergeDuplicates.mockReset();
    mergeAllDuplicates.mockReset();
    getMergeableDuplicates.mockResolvedValue(mockGroups);
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
      root.render(<AdminDuplicatesPage />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function clickButton(text: string, scope: ParentNode = document.body) {
    const button = Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
  }

  function findRow(isrc: string) {
    const p = Array.from(document.body.querySelectorAll('p')).find((el) => el.textContent === `ISRC: ${isrc}`);
    expect(p).toBeDefined();
    return p!.parentElement!.parentElement as HTMLDivElement;
  }

  async function click(button: HTMLButtonElement) {
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('shows a load error banner above the list when fetching duplicates fails, with a Försök igen button that reloads', async () => {
    getMergeableDuplicates.mockRejectedValueOnce(new Error('Server error'));

    await renderPage();

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta dubbletter');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
    expect(document.body.textContent).not.toContain('Inga sammanfogningsbara dubbletter hittades.');

    await click(clickButton('Försök igen'));

    expect(getMergeableDuplicates).toHaveBeenCalledTimes(2);
  });

  it('shows the analyze error inline in that duplicate group row, not as a toast', async () => {
    analyzeDuplicates.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const row = findRow('ISRC1');
    await click(clickButton('Analysera', row));

    const alert = row.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte analysera dubbletter');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the merge error inline in that duplicate group row, not as a toast', async () => {
    mergeDuplicates.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const row = findRow('ISRC1');
    await click(clickButton('Sammanfoga', row));

    const alert = row.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Sammanslagning misslyckades');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the merge-all error inline next to the confirmation dialog confirm button, not as a toast', async () => {
    mergeAllDuplicates.mockRejectedValue(new Error('Server error'));

    await renderPage();

    await click(clickButton('Sammanfoga alla'));

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();

    await click(clickButton('Sammanfoga alla', dialog));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Masssammanslagning misslyckades');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
