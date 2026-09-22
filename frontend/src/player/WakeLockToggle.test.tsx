import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WakeLockToggle } from './WakeLockToggle';
import type { PlayerContextValue } from './PlayerContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const useScreenWakeLockMock = vi.fn();
const usePlayerMock = vi.fn();

vi.mock('./hooks/useScreenWakeLock', () => ({
  useScreenWakeLock: (...args: unknown[]) => useScreenWakeLockMock(...args),
}));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => usePlayerMock(),
}));

describe('WakeLockToggle', () => {
  let container: HTMLDivElement;
  let root: Root;
  let localStorageGetItem: ReturnType<typeof vi.spyOn>;
  let localStorageSetItem: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useScreenWakeLockMock.mockReset();
    usePlayerMock.mockReset();

    localStorageGetItem = vi.spyOn(Storage.prototype, 'getItem');
    localStorageSetItem = vi.spyOn(Storage.prototype, 'setItem');

    localStorageGetItem.mockReturnValue(null);
    localStorageSetItem.mockImplementation(() => {});

    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: vi.fn() },
      writable: true,
      configurable: true,
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    localStorageGetItem.mockRestore();
    localStorageSetItem.mockRestore();
    root.unmount();
    container.remove();
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('is hidden when the browser has no wakeLock', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    usePlayerMock.mockReturnValue({
      isPlaying: false,
    } as Partial<PlayerContextValue>);

    await act(async () => {
      root.render(<WakeLockToggle />);
    });

    const toggle = container.querySelector('input[type="checkbox"], button');
    expect(toggle).toBeNull();
  });

  it('is off by default', async () => {
    usePlayerMock.mockReturnValue({
      isPlaying: false,
    } as Partial<PlayerContextValue>);

    await act(async () => {
      root.render(<WakeLockToggle />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const checkbox = container.querySelector(
      'input[type="checkbox"], [role="switch"]',
    ) as HTMLInputElement | null;
    expect(checkbox).toBeDefined();
    expect(checkbox?.checked).toBe(false);
    expect(useScreenWakeLockMock).toHaveBeenCalledWith(false);
  });

  it('turning it on keeps the screen on while music plays', async () => {
    usePlayerMock.mockReturnValue({
      isPlaying: true,
    } as Partial<PlayerContextValue>);

    await act(async () => {
      root.render(<WakeLockToggle />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const checkbox = container.querySelector(
      'input[type="checkbox"], [role="switch"]',
    ) as HTMLInputElement | null;

    await act(async () => {
      checkbox?.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(useScreenWakeLockMock).toHaveBeenCalledWith(true);
  });

  it('stays off while music is paused', async () => {
    usePlayerMock.mockReturnValue({
      isPlaying: false,
    } as Partial<PlayerContextValue>);

    await act(async () => {
      root.render(<WakeLockToggle />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const checkbox = container.querySelector(
      'input[type="checkbox"], [role="switch"]',
    ) as HTMLInputElement | null;

    await act(async () => {
      checkbox?.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(useScreenWakeLockMock).toHaveBeenCalledWith(false);
  });

  it('remembers the choice', async () => {
    usePlayerMock.mockReturnValue({
      isPlaying: true,
    } as Partial<PlayerContextValue>);

    await act(async () => {
      root.render(<WakeLockToggle />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const checkbox = container.querySelector(
      'input[type="checkbox"], [role="switch"]',
    ) as HTMLInputElement | null;

    await act(async () => {
      checkbox?.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(localStorageSetItem).toHaveBeenCalled();
    const storageKey = localStorageSetItem.mock.calls[0]?.[0];
    expect(storageKey).toBeDefined();

    localStorageGetItem.mockReturnValue('true');

    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<WakeLockToggle />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const newCheckbox = container.querySelector(
      'input[type="checkbox"], [role="switch"]',
    ) as HTMLInputElement | null;
    expect(newCheckbox?.checked).toBe(true);
  });

  it('renders when localStorage throws', async () => {
    localStorageGetItem.mockImplementation(() => {
      throw new Error('localStorage is not available');
    });
    localStorageSetItem.mockImplementation(() => {
      throw new Error('localStorage is not available');
    });

    usePlayerMock.mockReturnValue({
      isPlaying: false,
    } as Partial<PlayerContextValue>);

    let renderError: unknown;
    await act(async () => {
      try {
        root.render(<WakeLockToggle />);
      } catch (e) {
        renderError = e;
      }
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(renderError).toBeUndefined();
  });
});
