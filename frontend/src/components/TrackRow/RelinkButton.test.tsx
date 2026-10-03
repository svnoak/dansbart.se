import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelinkButton } from './RelinkButton';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const relink = vi.fn();
vi.mock('@/library/useRelink', () => ({
  useRelink: () => ({ relink }),
}));

describe('RelinkButton', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    relink.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.clearAllMocks();
  });

  it('shows a circular arrow button named Välj filen igen without visible text', async () => {
    const onRelinked = vi.fn();

    await act(async () => {
      root.render(
        <RelinkButton trackId="track-1" onRelinked={onRelinked} />
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Välj filen igen"]');
    expect(button).toBeDefined();
    expect(button?.title).toBe('Välj filen igen');
    expect(button?.querySelector('svg')).toBeDefined();
    expect(button?.textContent?.trim()).toBe('');
  });

  it('matches the size of the play button', async () => {
    const onRelinked = vi.fn();

    await act(async () => {
      root.render(
        <RelinkButton trackId="track-1" onRelinked={onRelinked} />
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Välj filen igen"]');
    // PlayButton uses h-12 w-12 for size
    expect(button?.classList.contains('h-12')).toBe(true);
    expect(button?.classList.contains('w-12')).toBe(true);
  });

  it.each([[true, 1], [false, 0]])('calls onRelinked after a successful relink (relink resolves %s)', async (relinkResult, expectedCalls) => {
    const onRelinked = vi.fn();
    relink.mockResolvedValue(relinkResult);

    await act(async () => {
      root.render(
        <RelinkButton trackId="track-1" onRelinked={onRelinked} />
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button).toBeDefined();

    // Click and wait for promise resolution
    button?.click();

    // Wait for the async click handler to resolve
    await vi.waitFor(() => {
      expect(onRelinked).toHaveBeenCalledTimes(expectedCalls);
    });
  });
});
