import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { InlineError } from './InlineError';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('InlineError', () => {
  it('renders the message with role alert', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<InlineError>Något gick fel</InlineError>);
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe('Något gick fel');

    root.unmount();
    container.remove();
  });

  it('renders nothing when there is no message', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<InlineError>{null}</InlineError>);
    });

    expect(container.querySelector('[role="alert"]')).toBeNull();

    root.unmount();
    container.remove();
  });
});
