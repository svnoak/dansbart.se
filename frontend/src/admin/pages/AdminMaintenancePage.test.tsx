import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AdminMaintenancePage } from './AdminMaintenancePage';
import * as toastEmitter from '@/admin/components/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const queuePendingTracks = vi.fn();
const cleanupOrphaned = vi.fn();
const backfillIsrcs = vi.fn();
const reclassifyAll = vi.fn();
const apiFetch = vi.fn();

vi.mock('@/api/generated/admin-maintenance/admin-maintenance', () => ({
  queuePendingTracks: (...args: unknown[]) => queuePendingTracks(...args),
  cleanupOrphaned: (...args: unknown[]) => cleanupOrphaned(...args),
  backfillIsrcs: (...args: unknown[]) => backfillIsrcs(...args),
  reclassifyAll: (...args: unknown[]) => reclassifyAll(...args),
}));

vi.mock('@/api/http-client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

const mockPauseStatus = { queues: { audio: false, feature: false, light: false } };

describe('AdminMaintenancePage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    queuePendingTracks.mockReset();
    cleanupOrphaned.mockReset();
    backfillIsrcs.mockReset();
    reclassifyAll.mockReset();
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({ ok: true, json: async () => mockPauseStatus } as Response);
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
      root.render(<AdminMaintenancePage />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function clickButton(text: string, scope: ParentNode = document.body) {
    const button = Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
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

  function findOperationCard(label: string) {
    const heading = Array.from(document.body.querySelectorAll('h3')).find((h) => h.textContent === label);
    expect(heading).toBeDefined();
    return heading!.parentElement as HTMLElement;
  }

  async function click(button: HTMLButtonElement) {
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('shows the queue pause/resume error inline next to that queue button, not as a toast', async () => {
    apiFetch.mockImplementation((url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('pause-status')) {
        return Promise.resolve({ ok: true, json: async () => mockPauseStatus } as Response);
      }
      if (u.includes('/pause?queue=audio')) {
        return Promise.resolve({ ok: false } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });

    await renderPage();

    const queueButton = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Audio'),
    );
    expect(queueButton).toBeDefined();

    await click(queueButton as HTMLButtonElement);

    const card = closestWithText(queueButton as HTMLButtonElement, 'Köer');
    const alert = card.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte ändra kö-status');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the pause-all error inline next to the Pausa alla button, not as a toast', async () => {
    apiFetch.mockImplementation((url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('pause-status')) {
        return Promise.resolve({ ok: true, json: async () => mockPauseStatus } as Response);
      }
      if (u.endsWith('/api/admin/maintenance/pause')) {
        return Promise.resolve({ ok: false } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });

    await renderPage();

    await click(clickButton('Pausa alla'));

    const card = closestWithText(clickButton('Pausa alla'), 'Köer');
    const alert = card.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte ändra kö-status');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the cleanup-orphaned error inline next to that operation\'s Kör button, not as a toast', async () => {
    cleanupOrphaned.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const card = findOperationCard('Rensa fastsittande spår');
    await click(clickButton('Kör', card));

    const alert = card.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Rensa fastsittande misslyckades. Försök igen.');
    expect(alert?.textContent).not.toContain('Server error');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
