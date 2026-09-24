import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TextField } from './TextField';
import { typeInto } from '@/test/typeInto';
import { getInputByLabel } from '@/test/getInputByLabel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TextField', () => {
  it('associates the label with the input', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<TextField id="test-field" label="Användarnamn" value="" onChange={() => {}} />);
    });

    expect(getInputByLabel('Användarnamn')).toBe(container.querySelector('input'));

    root.unmount();
    container.remove();
  });

  it('calls onChange when the user types', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const onChange = vi.fn();

    await act(async () => {
      root.render(<TextField id="test-field" label="Användarnamn" value="" onChange={onChange} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;
    typeInto(input, 'anna');

    expect(onChange).toHaveBeenCalledWith('anna');

    root.unmount();
    container.remove();
  });
});
