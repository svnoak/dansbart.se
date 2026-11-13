import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AddTrackPage } from './AddTrackPage';
import { ApiError } from '@/api/http-client';
import { loggedInAuthValue } from '@/test/authValue';
import { getInputByLabel } from '@/test/getInputByLabel';
import { typeInto } from '@/test/typeInto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const previewContributionLink = vi.fn();
const submitTrack = vi.fn();
const createDanceStyle = vi.fn();
const getStyleTree = vi.fn();
const useAuth = vi.fn();
const toast = vi.fn();
const getTrack = vi.fn();

vi.mock('@/api/generated/tracks/tracks', () => ({
  getTrack: (id: string) => getTrack(id),
}));

// The real row needs the player and favourites providers; the page only decides which track it shows.
vi.mock('@/components/TrackRow', () => ({
  TrackRow: ({ track }: { track: { title?: string } }) => <div data-testid="track-row">{track.title}</div>,
}));

vi.mock('@/api/generated/contributions/contributions', () => ({
  previewContributionLink: (...args: unknown[]) => previewContributionLink(...args),
  submitTrack: (...args: unknown[]) => submitTrack(...args),
  createDanceStyle: (...args: unknown[]) => createDanceStyle(...args),
}));

vi.mock('@/api/generated/styles/styles', () => ({
  getStyleTree: () => getStyleTree(),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/ui', async () => {
  const actual = await vi.importActual<typeof import('@/ui')>('@/ui');
  return { ...actual, toast: (...args: unknown[]) => toast(...args) };
});

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('AddTrackPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    previewContributionLink.mockReset();
    submitTrack.mockReset();
    createDanceStyle.mockReset();
    getStyleTree.mockReset();
    toast.mockReset();
    getTrack.mockReset();
    getTrack.mockResolvedValue({ id: 't1', title: 'Polska efter Pelle', playable: true });
    getStyleTree.mockResolvedValue([
      { name: 'Polska', subStyles: ['Slängpolska'] },
      { name: 'Vals', subStyles: [] },
    ]);
    previewContributionLink.mockResolvedValue({
      source: 'YOUTUBE',
      externalId: 'dQw4w9WgXcQ',
      title: 'Polska efter Pelle',
      artistName: 'Spelman',
    });
    submitTrack.mockResolvedValue({ submissionId: 's1', trackId: 't1', status: 'CREATED' });
    useAuth.mockReturnValue(loggedInAuthValue({}));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function wait(ms = 0) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  }

  async function render() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AddTrackPage />
        </MemoryRouter>,
      );
    });
    await wait();
  }

  async function pasteLink(url: string) {
    const input = getInputByLabel('Länk till låten')!;
    await act(async () => {
      typeInto(input, url);
    });
    // The preview waits for the person to stop typing.
    await wait(600);
  }

  async function choose(label: string, value: string) {
    const select = getInputByLabel(label) as unknown as HTMLSelectElement;
    expect(select).toBeTruthy();
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function button(text: string): HTMLButtonElement {
    const found = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
    expect(found).toBeDefined();
    return found as HTMLButtonElement;
  }

  it('fills in title and artist from the link and adds the track', async () => {
    await render();
    await pasteLink(YOUTUBE_URL);

    expect(previewContributionLink).toHaveBeenCalledWith({ url: YOUTUBE_URL });
    expect((getInputByLabel('Låtens titel') as HTMLInputElement).value).toBe('Polska efter Pelle');
    expect((getInputByLabel('Artist eller grupp') as HTMLInputElement).value).toBe('Spelman');

    expect(button('Lägg till låten').disabled).toBe(true);
    await choose('Vilken dans passar låten till?', 'Polska');
    await choose('Variant', 'Slängpolska');
    await choose('Danstempo', 'Lagom');

    await act(async () => {
      button('Lägg till låten').click();
    });
    await wait();

    expect(submitTrack).toHaveBeenCalledWith({
      url: YOUTUBE_URL,
      title: 'Polska efter Pelle',
      artistName: 'Spelman',
      mainStyle: 'Polska',
      subStyle: 'Slängpolska',
      tempoCategory: 'Lagom',
    });
    expect(toast).toHaveBeenCalledWith('Tack! Låten är tillagd och går att spela direkt.');
    expect((getInputByLabel('Länk till låten') as HTMLInputElement).value).toBe('');

    // The new track is shown at once, ready to play, before any analysis.
    expect(getTrack).toHaveBeenCalledWith('t1');
    expect(document.body.textContent).toContain('Låten du lade till');
    expect(document.body.querySelector('[data-testid="track-row"]')?.textContent).toBe('Polska efter Pelle');
  });

  it('has no track to show yet for a Spotify link that is still being fetched', async () => {
    submitTrack.mockResolvedValue({ submissionId: 's2', status: 'QUEUED' });
    await render();
    await pasteLink('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
    await choose('Vilken dans passar låten till?', 'Vals');
    await act(async () => {
      button('Lägg till låten').click();
    });
    await wait();

    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Vi hämtar låten från Spotify'));
    expect(getTrack).not.toHaveBeenCalled();
    expect(document.body.querySelector('[data-testid="track-row"]')).toBeNull();
  });

  it('says so when the library already has the track', async () => {
    previewContributionLink.mockResolvedValue({
      source: 'YOUTUBE',
      externalId: 'dQw4w9WgXcQ',
      existingTrackId: 't9',
      existingTrackTitle: 'Gammal polska',
    });
    await render();
    await pasteLink(YOUTUBE_URL);

    expect(document.body.textContent).toContain('Den här låten finns redan');
    expect(document.body.textContent).toContain('Gammal polska');
    expect(getInputByLabel('Låtens titel')).toBeNull();
    expect(button('Spara min röst')).toBeDefined();
  });

  it('shows why a link cannot be used next to the field', async () => {
    previewContributionLink.mockRejectedValue(new ApiError('Request failed: 422', 422, 'YouTube-videon finns inte.'));
    await render();
    await pasteLink(YOUTUBE_URL);

    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe('YouTube-videon finns inte.');
  });

  it('asks for a YouTube or Spotify link without calling the API for other text', async () => {
    await render();
    await pasteLink('https://example.com/song');

    expect(previewContributionLink).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('YouTube eller Spotify');
  });

  it('adds a missing dance style and selects it', async () => {
    createDanceStyle.mockResolvedValue({ id: 'k1', mainStyle: 'Masurka' });
    await render();
    await pasteLink(YOUTUBE_URL);

    await act(async () => {
      button('Dansen saknas').click();
    });
    await act(async () => {
      typeInto(getInputByLabel('Namn på dansstilen')!, 'Masurka');
    });
    getStyleTree.mockResolvedValue([
      { name: 'Masurka', subStyles: [] },
      { name: 'Polska', subStyles: ['Slängpolska'] },
    ]);
    await act(async () => {
      button('Lägg till dansstilen').click();
    });
    await wait();

    expect(createDanceStyle).toHaveBeenCalledWith({ name: 'Masurka', parentStyle: undefined });
    expect((getInputByLabel('Vilken dans passar låten till?') as unknown as HTMLSelectElement).value).toBe('Masurka');
    expect(toast).toHaveBeenCalledWith('Masurka är tillagd som dansstil.');
  });

  it('tells a banned person that they cannot add tracks', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ banned: true }));
    await render();

    expect(document.body.textContent).toContain('Ditt konto kan inte lägga till låtar');
    expect(getInputByLabel('Länk till låten')).toBeNull();
  });
});
