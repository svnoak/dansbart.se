import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { usePlaylistShareLink } from './usePlaylistShareLink';
import { toastListeners } from '@/ui/toastEmitter';
import type { UsePlaylistShareLinkResult } from './usePlaylistShareLink';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/api/generated/playlists/playlists', () => ({
  generateShareToken: vi.fn(),
  invalidateShareToken: vi.fn(),
}));

describe('usePlaylistShareLink', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it('creates a link', async () => {
    const { generateShareToken } = await import('@/api/generated/playlists/playlists');
    const token = 'share-token-123';
    vi.mocked(generateShareToken).mockResolvedValue({ shareToken: token });

    const resultBox: { current: UsePlaylistShareLinkResult | null } = { current: null };

    function TestComponent({ onResultChange }: { onResultChange: (r: UsePlaylistShareLinkResult) => void }) {
      const hookResult = usePlaylistShareLink('p1', undefined);
      useEffect(() => {
        onResultChange(hookResult);
      }, [hookResult, onResultChange]);
      return (
        <button onClick={hookResult.createLink}>Create Link</button>
      );
    }

    await act(async () => {
      root.render(
        <TestComponent onResultChange={(r: UsePlaylistShareLinkResult) => { resultBox.current = r; }} />
      );
    });

    const button = container.querySelector('button');
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(vi.mocked(generateShareToken)).toHaveBeenCalledWith('p1');
    expect(resultBox.current?.shareToken).toBe(token);
    expect(resultBox.current?.shareUrl).toBe(`${window.location.origin}/shared/${token}`);
  });

  it('removes a link', async () => {
    const { invalidateShareToken } = await import('@/api/generated/playlists/playlists');
    vi.mocked(invalidateShareToken).mockResolvedValue(undefined);

    const initialToken = 'initial-token';
    const resultBox: { current: UsePlaylistShareLinkResult | null } = { current: null };

    function TestComponent({ onResultChange }: { onResultChange: (r: UsePlaylistShareLinkResult) => void }) {
      const hookResult = usePlaylistShareLink('p1', initialToken);
      useEffect(() => {
        onResultChange(hookResult);
      }, [hookResult, onResultChange]);
      return (
        <button onClick={hookResult.removeLink}>Remove Link</button>
      );
    }

    await act(async () => {
      root.render(
        <TestComponent onResultChange={(r: UsePlaylistShareLinkResult) => { resultBox.current = r; }} />
      );
    });

    const button = container.querySelector('button');
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(vi.mocked(invalidateShareToken)).toHaveBeenCalledWith('p1');
    expect(resultBox.current?.shareToken).toBeNull();
  });

  it('copies the link', async () => {
    const token = 'share-token-456';
    const clipboardMock = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      writable: true,
    });

    function TestComponent({ onResultChange }: { onResultChange: (r: UsePlaylistShareLinkResult) => void }) {
      const hookResult = usePlaylistShareLink('p1', token);
      useEffect(() => {
        onResultChange(hookResult);
      }, [hookResult, onResultChange]);
      return (
        <button onClick={hookResult.copyLink}>Copy Link</button>
      );
    }

    await act(async () => {
      root.render(
        <TestComponent onResultChange={() => {}} />
      );
    });

    const button = container.querySelector('button');
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const expectedUrl = `${window.location.origin}/shared/${token}`;
    expect(clipboardMock.writeText).toHaveBeenCalledWith(expectedUrl);
  });

  it('a failed copy shows an error', async () => {
    const token = 'share-token-789';
    const clipboardMock = {
      writeText: vi.fn().mockRejectedValue(new Error('Copy failed')),
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      writable: true,
    });

    const toastMessages: Array<{ text: string; variant: 'success' | 'error' }> = [];
    const toastListener = (msg: { text: string; variant: 'success' | 'error' }) => {
      toastMessages.push(msg);
    };
    toastListeners.add(toastListener);

    function TestComponent({ onResultChange }: { onResultChange: (r: UsePlaylistShareLinkResult) => void }) {
      const hookResult = usePlaylistShareLink('p1', token);
      useEffect(() => {
        onResultChange(hookResult);
      }, [hookResult, onResultChange]);
      return (
        <button onClick={hookResult.copyLink}>Copy Link</button>
      );
    }

    await act(async () => {
      root.render(
        <TestComponent onResultChange={() => {}} />
      );
    });

    const button = container.querySelector('button');
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    toastListeners.delete(toastListener);

    const errorToast = toastMessages.find((msg) => msg.variant === 'error' && msg.text === 'Det gick inte att kopiera länken.');
    expect(errorToast).toBeDefined();
  });
});
