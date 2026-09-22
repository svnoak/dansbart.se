import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ConfirmDeleteByName } from './ConfirmDeleteByName';
import { typeInto } from '@/test/typeInto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ConfirmDeleteByName', () => {
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

  it('reveals the name input after the first button', async () => {
    await act(async () => {
      root.render(
        <ConfirmDeleteByName
          name="My Playlist"
          buttonLabel="Radera spellista"
          onConfirm={() => {}}
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input');
    expect(input).toBeNull();

    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Radera spellista'),
    );
    expect(button).toBeDefined();

    await act(async () => {
      button?.click();
    });

    const inputAfterClick = container.querySelector<HTMLInputElement>('input');
    expect(inputAfterClick).toBeDefined();
  });

  it('keeps the confirm button disabled until the typed text matches the name exactly', async () => {
    await act(async () => {
      root.render(
        <ConfirmDeleteByName
          name="My Playlist"
          buttonLabel="Radera spellista"
          onConfirm={() => {}}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Radera spellista'),
    );

    await act(async () => {
      button?.click();
    });

    const input = container.querySelector<HTMLInputElement>('input');
    expect(input).toBeDefined();

    await act(async () => {
      typeInto(input!, 'My Play');
    });

    const confirmButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Radera permanent'),
    );
    expect(confirmButton).toBeDefined();
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      typeInto(input!, 'My Playlist');
    });

    expect((confirmButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onConfirm when confirmed', async () => {
    const onConfirm = vi.fn();

    await act(async () => {
      root.render(
        <ConfirmDeleteByName
          name="My Playlist"
          buttonLabel="Radera spellista"
          onConfirm={onConfirm}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Radera spellista'),
    );

    await act(async () => {
      button?.click();
    });

    const input = container.querySelector<HTMLInputElement>('input');

    await act(async () => {
      typeInto(input!, 'My Playlist');
    });

    const confirmButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Radera permanent'),
    );

    await act(async () => {
      confirmButton?.click();
    });

    expect(onConfirm).toHaveBeenCalled();
  });

  it('cancel hides the input and clears the text', async () => {
    await act(async () => {
      root.render(
        <ConfirmDeleteByName
          name="My Playlist"
          buttonLabel="Radera spellista"
          onConfirm={() => {}}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Radera spellista'),
    );

    await act(async () => {
      button?.click();
    });

    const input = container.querySelector<HTMLInputElement>('input');

    await act(async () => {
      typeInto(input!, 'My Playlist');
    });

    const cancelButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Avbryt'),
    );

    await act(async () => {
      cancelButton?.click();
    });

    const inputAfterCancel = container.querySelector<HTMLInputElement>('input');
    expect(inputAfterCancel).toBeNull();

    await act(async () => {
      button?.click();
    });

    const inputAfterReopen = container.querySelector<HTMLInputElement>('input');
    expect(inputAfterReopen?.value).toBe('');
  });

  it('moves focus to the name input when opened', async () => {
    await act(async () => {
      root.render(
        <ConfirmDeleteByName
          name="My Playlist"
          buttonLabel="Radera spellista"
          onConfirm={() => {}}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Radera spellista'),
    );

    await act(async () => {
      button?.click();
    });

    const input = container.querySelector<HTMLInputElement>('input');
    expect(document.activeElement).toBe(input);
  });
});
