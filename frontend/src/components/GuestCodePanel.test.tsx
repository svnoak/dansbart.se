import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GuestCodePanel } from './GuestCodePanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toast = vi.fn();
const createPlaylistGuestCode = vi.fn();
const removePlaylistGuestCode = vi.fn();
const createDanceListGuestCode = vi.fn();
const removeDanceListGuestCode = vi.fn();

vi.mock('@/ui', async () => {
  const actual = await vi.importActual<typeof import('@/ui')>('@/ui');
  return { ...actual, toast: (...args: unknown[]) => toast(...args) };
});

vi.mock('@/api/generated/guest-codes/guest-codes', () => ({
  createPlaylistGuestCode: (...args: unknown[]) => createPlaylistGuestCode(...args),
  removePlaylistGuestCode: (...args: unknown[]) => removePlaylistGuestCode(...args),
  createDanceListGuestCode: (...args: unknown[]) => createDanceListGuestCode(...args),
  removeDanceListGuestCode: (...args: unknown[]) => removeDanceListGuestCode(...args),
}));

function button(container: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
  if (!found) throw new Error(`No button with the text "${text}"`);
  return found;
}

describe('GuestCodePanel', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChange = vi.fn();

  beforeEach(() => {
    for (const mock of [
      toast,
      onChange,
      createPlaylistGuestCode,
      removePlaylistGuestCode,
      createDanceListGuestCode,
      removeDanceListGuestCode,
    ]) {
      mock.mockReset();
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function render(kind: 'playlist' | 'danceList', code: string | null) {
    await act(async () => {
      root.render(<GuestCodePanel kind={kind} listId="list-1" code={code} onChange={onChange} />);
    });
  }

  it('creates a code for a playlist and hands it to the page', async () => {
    createPlaylistGuestCode.mockResolvedValue({ code: 'ABC234' });
    await render('playlist', null);
    expect(container.textContent).toContain('lägga till låtar i spellistan');

    await act(async () => {
      button(container, 'Skapa kod').click();
    });

    expect(createPlaylistGuestCode).toHaveBeenCalledWith('list-1');
    expect(onChange).toHaveBeenCalledWith('ABC234');
    expect(toast).toHaveBeenCalledWith('Koden är skapad');
  });

  it('shows the code, the QR code and the link a guest opens', async () => {
    await render('danceList', 'ABC234');

    expect(container.textContent).toContain('ABC 234');
    expect(container.textContent).toContain('lägga till danser i danslistan');
    expect(container.querySelector('svg[role="img"]')).not.toBeNull();
    const link = container.querySelector<HTMLInputElement>('input[readonly]');
    expect(link?.value).toBe(`${window.location.origin}/kod/ABC234`);
  });

  it('turns the code of a dance list off', async () => {
    removeDanceListGuestCode.mockResolvedValue(undefined);
    await render('danceList', 'ABC234');

    await act(async () => {
      button(container, 'Stäng av koden').click();
    });

    expect(removeDanceListGuestCode).toHaveBeenCalledWith('list-1');
    expect(onChange).toHaveBeenCalledWith(null);
    expect(toast).toHaveBeenCalledWith('Koden är avstängd');
  });

  it('keeps the code and shows an error next to the button when turning it off fails', async () => {
    removePlaylistGuestCode.mockRejectedValue(new Error('offline'));
    await render('playlist', 'ABC234');

    await act(async () => {
      button(container, 'Stäng av koden').click();
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Det gick inte att stänga av koden. Försök igen.');
  });

  it('shows an error when a code cannot be created', async () => {
    createPlaylistGuestCode.mockRejectedValue(new Error('offline'));
    await render('playlist', null);

    await act(async () => {
      button(container, 'Skapa kod').click();
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Det gick inte att skapa en kod. Försök igen.');
  });
});
