import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LoadError } from './LoadError';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('LoadError', () => {
  it('renders the message with role alert', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<LoadError message="Något gick fel" onRetry={vi.fn()} />);
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Något gick fel');

    root.unmount();
    container.remove();
  });

  it('calls onRetry when Försök igen is clicked', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const onRetry = vi.fn();

    await act(async () => {
      root.render(<LoadError message="Något gick fel" onRetry={onRetry} />);
    });

    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Försök igen'),
    );
    expect(button).toBeDefined();

    await act(async () => {
      button?.click();
    });

    expect(onRetry).toHaveBeenCalledTimes(1);

    root.unmount();
    container.remove();
  });
});
