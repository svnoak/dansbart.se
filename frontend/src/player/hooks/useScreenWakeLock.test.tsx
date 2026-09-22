import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useScreenWakeLock } from './useScreenWakeLock';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRelease = vi.fn();
const mockAddEventListener = vi.fn();
const mockRequest = vi.fn();

const mockWakeLockSentinel = {
  release: mockRelease,
  addEventListener: mockAddEventListener,
};

describe('useScreenWakeLock', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest.mockResolvedValue(mockWakeLockSentinel);
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: mockRequest,
      },
      writable: true,
      configurable: true,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  function TestComponent({ active }: { active: boolean }) {
    useScreenWakeLock(active);
    return null;
  }

  it('requests the screen lock when active', async () => {
    await act(async () => {
      root.render(<TestComponent active={true} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    expect(mockRequest).toHaveBeenCalledWith('screen');
  });

  it('does not request when inactive', async () => {
    await act(async () => {
      root.render(<TestComponent active={false} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('releases the lock when it becomes inactive', async () => {
    await act(async () => {
      root.render(<TestComponent active={true} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRequest).toHaveBeenCalledOnce();

    await act(async () => {
      root.render(<TestComponent active={false} />);
    });

    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it('requests again when the page becomes visible', async () => {
    await act(async () => {
      root.render(<TestComponent active={true} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRequest).toHaveBeenCalledOnce();

    const releaseCallback = mockAddEventListener.mock.calls[0]?.[1];
    expect(releaseCallback).toBeDefined();

    await act(async () => {
      if (releaseCallback) releaseCallback();
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });

    await act(async () => {
      const event = new Event('visibilitychange');
      document.dispatchEvent(event);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('releases on unmount', async () => {
    await act(async () => {
      root.render(<TestComponent active={true} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRequest).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    expect(mockRelease).toHaveBeenCalled();
  });

  it('releases a lock that arrives after it became inactive', async () => {
    let resolveRequest: (sentinel: typeof mockWakeLockSentinel) => void;
    mockRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    await act(async () => {
      root.render(<TestComponent active={true} />);
    });

    await act(async () => {
      root.render(<TestComponent active={false} />);
    });

    await act(async () => {
      resolveRequest(mockWakeLockSentinel);
      await Promise.resolve();
    });

    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it('requests only once per visibility change after several releases', async () => {
    await act(async () => {
      root.render(<TestComponent active={true} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRequest).toHaveBeenCalledOnce();

    const firstReleaseCallback = mockAddEventListener.mock.calls[0]?.[1];
    await act(async () => {
      firstReleaseCallback();
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);

    const secondReleaseCallback = mockAddEventListener.mock.calls[1]?.[1];
    await act(async () => {
      secondReleaseCallback();
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it('does nothing when the browser has no wakeLock', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    let error: unknown;
    await act(async () => {
      try {
        root.render(<TestComponent active={true} />);
      } catch (e) {
        error = e;
      }
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(error).toBeUndefined();
  });
});
