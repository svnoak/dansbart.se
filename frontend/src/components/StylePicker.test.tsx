import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StylePicker } from './StylePicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const options = [
  { value: 'Slow', label: 'Långsamt' },
  { value: 'Medium', label: 'Lagom' },
];

describe('StylePicker full presentation disabled state', () => {
  it('disables every button while a submission runs', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <StylePicker
          presentation="full"
          options={options}
          placeholder="Välj tempo..."
          onSelect={() => {}}
          disabled
        />,
      );
    });

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(options.length);
    buttons.forEach((button) => {
      expect(button.disabled).toBe(true);
    });

    root.unmount();
    container.remove();
  });
});
