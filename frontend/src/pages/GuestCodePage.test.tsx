import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { GuestCodePage } from './GuestCodePage';
import { ApiError } from '@/api/http-client';
import { authValue } from '@/test/authValue';
import { getInputByLabel } from '@/test/getInputByLabel';
import { typeInto } from '@/test/typeInto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toast = vi.fn();
const getGuestList = vi.fn();
const addGuestTrack = vi.fn();
const addGuestDance = vi.fn();
const searchTracks = vi.fn();
const getDances = vi.fn();

vi.mock('@/ui', async () => {
  const actual = await vi.importActual<typeof import('@/ui')>('@/ui');
  return { ...actual, toast: (...args: unknown[]) => toast(...args) };
});

vi.mock('@/api/generated/guest-codes/guest-codes', () => ({
  getGuestList: (...args: unknown[]) => getGuestList(...args),
  addGuestTrack: (...args: unknown[]) => addGuestTrack(...args),
  addGuestDance: (...args: unknown[]) => addGuestDance(...args),
}));

vi.mock('@/api/generated/tracks/tracks', () => ({
  searchTracks: (...args: unknown[]) => searchTracks(...args),
}));

vi.mock('@/api/generated/dances/dances', () => ({
  getDances: (...args: unknown[]) => getDances(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => authValue(),
}));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => ({ play: vi.fn(), addToQueue: vi.fn(), currentTrack: null, isPlaying: false }),
}));

vi.mock('@/favorites/useFavorites', () => ({
  useFavorites: () => ({ isFavorited: () => false, toggleFavorite: vi.fn() }),
}));

function button(text: string): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
  if (!found) throw new Error(`No button with the text "${text}"`);
  return found;
}

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe('GuestCodePage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    for (const mock of [toast, getGuestList, addGuestTrack, addGuestDance, searchTracks, getDances]) {
      mock.mockReset();
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.useRealTimers();
  });

  async function renderAt(path: string) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          <Routes>
            <Route path="/kod" element={<GuestCodePage />} />
            <Route path="/kod/:code" element={<GuestCodePage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  async function search(label: string, text: string) {
    await act(async () => {
      typeInto(getInputByLabel(label)!, text);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
  }

  it('opens the list of a typed code, whatever its case and spacing', async () => {
    getGuestList.mockResolvedValue({ type: 'playlist', name: 'Dansafton', tracks: [] });
    await renderAt('/kod');

    await act(async () => {
      typeInto(getInputByLabel('Kod')!, 'abc 234');
    });
    await act(async () => {
      button('Öppna listan').click();
    });

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/kod/ABC234');
    expect(getGuestList).toHaveBeenCalledWith('ABC234', expect.anything());
  });

  it('tells the person when the typed code is too short', async () => {
    await renderAt('/kod');

    await act(async () => {
      typeInto(getInputByLabel('Kod')!, 'abc');
    });
    await act(async () => {
      button('Öppna listan').click();
    });

    expect(container.textContent).toContain('Koden har 6 tecken');
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/kod');
  });

  it('says that the code does not work when no list has it', async () => {
    getGuestList.mockRejectedValue(new ApiError('Request failed: 404', 404));
    await renderAt('/kod/ZZZZZZ');

    expect(container.textContent).toContain('Koden gäller inte');
    expect(container.textContent).toContain('ZZZ ZZZ');
  });

  it('offers to try again when the list cannot be loaded', async () => {
    getGuestList.mockRejectedValueOnce(new ApiError('Request failed: 500', 500));
    getGuestList.mockResolvedValueOnce({ type: 'playlist', name: 'Dansafton', tracks: [] });
    await renderAt('/kod/ABC234');
    expect(container.textContent).toContain('Det gick inte att öppna listan.');

    await act(async () => {
      button('Försök igen').click();
    });

    expect(container.textContent).toContain('Dansafton');
  });

  it('adds a track to a playlist and shows it in the list', async () => {
    getGuestList.mockResolvedValue({ type: 'playlist', name: 'Dansafton', ownerName: 'Anna', tracks: [] });
    searchTracks.mockResolvedValue({ items: [{ id: 't1', title: 'Hambo från Svärdsjö', artistName: 'Spelmän' }] });
    addGuestTrack.mockResolvedValue({
      type: 'playlist',
      name: 'Dansafton',
      tracks: [{ id: 't1', title: 'Hambo från Svärdsjö', artistName: 'Spelmän' }],
    });
    await renderAt('/kod/ABC234');
    expect(container.textContent).toContain('Spellista av Anna');

    await search('Lägg till en låt', 'hambo');
    await act(async () => {
      button('Hambo från Svärdsjö').click();
    });
    await act(async () => {
      button('Lägg till').click();
    });

    expect(addGuestTrack).toHaveBeenCalledWith('ABC234', { trackId: 't1' });
    expect(toast).toHaveBeenCalledWith('Låten är tillagd');
    expect(container.querySelector('ol')?.textContent).toContain('Hambo från Svärdsjö');
  });

  it('marks a track that is already in the playlist and does not let it be added again', async () => {
    getGuestList.mockResolvedValue({
      type: 'playlist',
      name: 'Dansafton',
      tracks: [{ id: 't1', title: 'Hambo från Svärdsjö' }],
    });
    searchTracks.mockResolvedValue({ items: [{ id: 't1', title: 'Hambo från Svärdsjö' }] });
    await renderAt('/kod/ABC234');

    await search('Lägg till en låt', 'hambo');

    const result = Array.from(container.querySelectorAll('ul button')).find((b) =>
      b.textContent?.includes('Hambo från Svärdsjö'),
    ) as HTMLButtonElement;
    expect(result.disabled).toBe(true);
    expect(result.textContent).toContain('Finns redan');
  });

  it('adds a dance that is not on the site by the name the person typed', async () => {
    getGuestList.mockResolvedValue({ type: 'dance_list', name: 'Kvällens danser', dances: [] });
    getDances.mockResolvedValue({ items: [] });
    addGuestDance.mockResolvedValue({
      type: 'dance_list',
      name: 'Kvällens danser',
      dances: [{ name: 'Slängpolska från Bingsjö' }],
    });
    await renderAt('/kod/ABC234');

    await search('Lägg till en dans', 'Slängpolska från Bingsjö');
    await act(async () => {
      button('Lägg till ”Slängpolska från Bingsjö”').click();
    });

    expect(addGuestDance).toHaveBeenCalledWith('ABC234', { name: 'Slängpolska från Bingsjö' });
    expect(toast).toHaveBeenCalledWith('Dansen är tillagd');
    expect(container.querySelector('ol')?.textContent).toContain('Slängpolska från Bingsjö');
  });

  it('keeps the error next to the search when the list already has the dance', async () => {
    getGuestList.mockResolvedValue({ type: 'dance_list', name: 'Kvällens danser', dances: [] });
    getDances.mockResolvedValue({ items: [{ id: 'd1', name: 'Bakmes' }] });
    addGuestDance.mockRejectedValue(new ApiError('Request failed: 409', 409));
    await renderAt('/kod/ABC234');

    await search('Lägg till en dans', 'bakmes');
    await act(async () => {
      button('Bakmes').click();
    });
    await act(async () => {
      button('Lägg till').click();
    });

    expect(container.textContent).toContain('Dansen finns redan i danslistan.');
  });

  it('shows that the code stopped working when it is turned off while the page is open', async () => {
    getGuestList.mockResolvedValue({ type: 'dance_list', name: 'Kvällens danser', dances: [] });
    getDances.mockResolvedValue({ items: [{ id: 'd1', name: 'Bakmes' }] });
    addGuestDance.mockRejectedValue(new ApiError('Request failed: 404', 404));
    await renderAt('/kod/ABC234');

    await search('Lägg till en dans', 'bakmes');
    await act(async () => {
      button('Bakmes').click();
    });
    await act(async () => {
      button('Lägg till').click();
    });

    expect(container.textContent).toContain('Koden gäller inte');
  });
});
