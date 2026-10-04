import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelinkButton } from './RelinkButton';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const relink = vi.fn();
const requestPersistentStorage = vi.fn();

vi.mock('@/library/localCopies', () => ({
  requestPersistentStorage: () => requestPersistentStorage(),
}));

vi.mock('@/library/useRelink', () => ({
  useRelink: () => ({ relink }),
}));

describe('RelinkButton', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    relink.mockReset();
    requestPersistentStorage.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.clearAllMocks();
  });

  it('shows a chip named Välj filen igen with a link icon and the word Hitta filen', async () => {
    const onRelinked = vi.fn();

    await act(async () => {
      root.render(
        <RelinkButton trackId="track-1" onRelinked={onRelinked} />
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Välj filen igen"]');
    expect(button).not.toBeNull();
    expect(button?.title).toBe('Välj filen igen');
    expect(button?.querySelector('svg')).not.toBeNull();
    expect(button?.textContent?.trim()).toBe('Hitta filen');
  });

  it('is at least 44 px tall like the play button', async () => {
    const onRelinked = vi.fn();

    await act(async () => {
      root.render(
        <RelinkButton trackId="track-1" onRelinked={onRelinked} />
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Välj filen igen"]');
    expect(button?.classList.contains('min-h-11')).toBe(true);
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

  it('asks for persistent storage when the person picks the file again', async () => {
    const onRelinked = vi.fn();

    await act(async () => {
      root.render(
        <RelinkButton trackId="track-1" onRelinked={onRelinked} />
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Välj filen igen"]');
    expect(button).toBeDefined();

    await act(async () => {
      button?.click();
    });

    expect(requestPersistentStorage).toHaveBeenCalledTimes(1);
  });
});
