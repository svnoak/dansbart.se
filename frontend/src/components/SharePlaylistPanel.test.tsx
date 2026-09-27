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

  it('shows the create-link error next to Skapa länk', async () => {
    await act(async () => {
      root.render(
        <SharePlaylistPanel
          playlistId="p1"
          canEdit={true}
          shareToken={null}
          shareUrl={null}
          createLink={vi.fn()}
          copyLink={vi.fn()}
          createLinkError="Kunde inte skapa delningslänk"
        />
      );
    });

    const createButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Skapa länk')
    );
    expect(createButton).toBeDefined();

    const alert = createButton?.parentElement?.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe('Kunde inte skapa delningslänk');
  });

  it('shows the copy-link error next to Kopiera länk and not under Skapa länk', async () => {
    await act(async () => {
      root.render(
        <SharePlaylistPanel
          playlistId="p1"
          canEdit={true}
          shareToken="token-1"
          shareUrl="https://example.com/shared/token-1"
          createLink={vi.fn()}
          copyLink={vi.fn()}
          copyLinkError="Det gick inte att kopiera länken."
        />
      );
    });

    const createButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Skapa länk')
    );
    expect(createButton).toBeUndefined();

    const copyButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Kopiera länk')
    );
    expect(copyButton).toBeDefined();

    const alert = copyButton?.parentElement?.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe('Det gick inte att kopiera länken.');
  });
});
