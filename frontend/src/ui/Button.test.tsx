import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Button } from './Button';
import { IconButton } from './IconButton';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Button accessibility', () => {
  it('has a 44px minimum height at every size', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];

    for (const size of sizes) {
      await act(async () => {
        root.render(<Button size={size}>Test</Button>);
      });

      const button = container.querySelector('button');
      expect(button?.classList.contains('min-h-11'), `Button size ${size} should have min-h-11`).toBe(
        true,
      );
      expect(
        button?.classList.contains('text-xs'),
        `Button size ${size} should not use text-xs`,
      ).toBe(false);
    }

    root.unmount();
    container.remove();
  });

  it('primary text uses the accent-foreground token', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<Button variant="primary">Test</Button>);
    });

    const button = container.querySelector('button');
    expect(
      button?.classList.contains('text-[rgb(var(--color-accent-foreground))]'),
      'primary variant should use accent-foreground token',
    ).toBe(true);
    expect(
      button?.classList.contains('text-white'),
      'primary variant should not hardcode text-white',
    ).toBe(false);

    root.unmount();
    container.remove();
  });
});

describe('IconButton accessibility', () => {
  it('is at least 44px square', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<IconButton aria-label="Test button">X</IconButton>);
    });

    const button = container.querySelector('button');
    expect(button?.classList.contains('min-h-11'), 'IconButton should have min-h-11').toBe(true);
    expect(button?.classList.contains('min-w-11'), 'IconButton should have min-w-11').toBe(true);

    root.unmount();
    container.remove();
  });
});
