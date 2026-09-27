import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useLongPress } from './useLongPress';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function firePointerEvent(
  target: EventTarget,
  type: string,
  options: { pointerType: string; clientX?: number; clientY?: number; pointerId?: number },
) {
  const { pointerType, clientX = 0, clientY = 0, pointerId = 1 } = options;
  let event: Event;
  if (typeof PointerEvent === 'function') {
    event = new PointerEvent(type, { bubbles: true, cancelable: true, clientX, clientY, pointerType, pointerId });
  } else {
    event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
  }
  target.dispatchEvent(event);
}

function LongPressTarget({
  onLongPress,
  onChildClick,
}: {
  onLongPress: () => void;
  onChildClick: () => void;
}) {
  const handlers = useLongPress(onLongPress);
  return (
    <div data-testid="target" {...handlers}>
      <button data-testid="child" onClick={onChildClick}>
        Child
      </button>
    </div>
  );
}

describe('useLongPress', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    root.unmount();
    container.remove();
  });

  it('calls onLongPress after holding a touch pointer for 500 ms', async () => {
    const onLongPress = vi.fn();

    await act(async () => {
      root.render(<LongPressTarget onLongPress={onLongPress} onChildClick={() => {}} />);
    });

    const target = container.querySelector<HTMLDivElement>('[data-testid="target"]')!;

    act(() => {
      firePointerEvent(target, 'pointerdown', { pointerType: 'touch', clientX: 0, clientY: 0 });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onLongPress if the pointer lifts early', async () => {
    const onLongPress = vi.fn();

    await act(async () => {
      root.render(<LongPressTarget onLongPress={onLongPress} onChildClick={() => {}} />);
    });

    const target = container.querySelector<HTMLDivElement>('[data-testid="target"]')!;

    act(() => {
      firePointerEvent(target, 'pointerdown', { pointerType: 'touch', clientX: 0, clientY: 0 });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    act(() => {
      firePointerEvent(target, 'pointerup', { pointerType: 'touch', clientX: 0, clientY: 0 });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels when the pointer moves more than 10 px', async () => {
    const onLongPress = vi.fn();

    await act(async () => {
      root.render(<LongPressTarget onLongPress={onLongPress} onChildClick={() => {}} />);
    });

    const target = container.querySelector<HTMLDivElement>('[data-testid="target"]')!;

    act(() => {
      firePointerEvent(target, 'pointerdown', { pointerType: 'touch', clientX: 0, clientY: 0 });
    });

    act(() => {
      firePointerEvent(target, 'pointermove', { pointerType: 'touch', clientX: 20, clientY: 0 });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels when the page scrolls', async () => {
    const onLongPress = vi.fn();

    await act(async () => {
      root.render(<LongPressTarget onLongPress={onLongPress} onChildClick={() => {}} />);
    });

    const target = container.querySelector<HTMLDivElement>('[data-testid="target"]')!;

    act(() => {
      firePointerEvent(target, 'pointerdown', { pointerType: 'touch', clientX: 0, clientY: 0 });
    });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does nothing for a mouse pointer', async () => {
    const onLongPress = vi.fn();

    await act(async () => {
      root.render(<LongPressTarget onLongPress={onLongPress} onChildClick={() => {}} />);
    });

    const target = container.querySelector<HTMLDivElement>('[data-testid="target"]')!;

    act(() => {
      firePointerEvent(target, 'pointerdown', { pointerType: 'mouse', clientX: 0, clientY: 0 });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('swallows the click that follows a long press', async () => {
    const onLongPress = vi.fn();
    const onChildClick = vi.fn();

    await act(async () => {
      root.render(<LongPressTarget onLongPress={onLongPress} onChildClick={onChildClick} />);
    });

    const target = container.querySelector<HTMLDivElement>('[data-testid="target"]')!;
    const child = container.querySelector<HTMLButtonElement>('[data-testid="child"]')!;

    act(() => {
      firePointerEvent(target, 'pointerdown', { pointerType: 'touch', clientX: 0, clientY: 0 });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);

    act(() => {
      firePointerEvent(target, 'pointerup', { pointerType: 'touch', clientX: 0, clientY: 0 });
    });

    act(() => {
      child.click();
    });

    expect(onChildClick).not.toHaveBeenCalled();

    act(() => {
      child.click();
    });

    expect(onChildClick).toHaveBeenCalledTimes(1);
  });

  it('a tap after a long press without a click is not swallowed', async () => {
    const onLongPress = vi.fn();
    const onChildClick = vi.fn();

    await act(async () => {
      root.render(<LongPressTarget onLongPress={onLongPress} onChildClick={onChildClick} />);
    });

    const target = container.querySelector<HTMLDivElement>('[data-testid="target"]')!;
    const child = container.querySelector<HTMLButtonElement>('[data-testid="child"]')!;

    act(() => {
      firePointerEvent(target, 'pointerdown', { pointerType: 'touch', clientX: 0, clientY: 0 });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);

    act(() => {
      firePointerEvent(target, 'pointercancel', { pointerType: 'touch', clientX: 0, clientY: 0 });
    });

    act(() => {
      firePointerEvent(target, 'pointerdown', { pointerType: 'touch', clientX: 0, clientY: 0 });
    });

    act(() => {
      firePointerEvent(target, 'pointerup', { pointerType: 'touch', clientX: 0, clientY: 0 });
    });

    act(() => {
      child.click();
    });

    expect(onChildClick).toHaveBeenCalledTimes(1);
  });

  it('a second finger does not disturb the first press', async () => {
    const onLongPress = vi.fn();
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    await act(async () => {
      root.render(<LongPressTarget onLongPress={onLongPress} onChildClick={() => {}} />);
    });

    const target = container.querySelector<HTMLDivElement>('[data-testid="target"]')!;

    act(() => {
      firePointerEvent(target, 'pointerdown', { pointerType: 'touch', clientX: 0, clientY: 0, pointerId: 1 });
    });

    act(() => {
      firePointerEvent(target, 'pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100, pointerId: 2 });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);

    act(() => {
      firePointerEvent(target, 'pointerup', { pointerType: 'touch', clientX: 100, clientY: 100, pointerId: 2 });
    });

    act(() => {
      firePointerEvent(target, 'pointerup', { pointerType: 'touch', clientX: 0, clientY: 0, pointerId: 1 });
    });

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });
});
