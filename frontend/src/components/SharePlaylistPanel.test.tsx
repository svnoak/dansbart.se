import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SharePlaylistPanel } from './SharePlaylistPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toast = vi.fn();

vi.mock('@/ui', async () => {
  const actual = await vi.importActual<typeof import('@/ui')>('@/ui');
  return {
    ...actual,
    toast: (...args: unknown[]) => toast(...args),
  };
});

describe('SharePlaylistPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    toast.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it('shows an inline error when copying the page link fails', async () => {
    const clipboardMock = {
      writeText: vi.fn().mockRejectedValue(new Error('Copy failed')),
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      writable: true,
    });

    await act(async () => {
      root.render(
        <SharePlaylistPanel
          playlistId="p1"
          canEdit={false}
          shareToken={null}
          shareUrl={null}
          createLink={vi.fn()}
          copyLink={vi.fn()}
        />
      );
    });

    const copyButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Kopiera länk')
    );
    expect(copyButton).toBeDefined();

    await act(async () => {
      copyButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe('Det gick inte att kopiera länken.');
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), 'error');
  });
});
