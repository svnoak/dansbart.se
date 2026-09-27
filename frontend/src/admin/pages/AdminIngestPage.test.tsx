import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AdminIngestPage } from './AdminIngestPage';
import { typeInto } from '@/test/typeInto';
import * as toastEmitter from '@/admin/components/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getSpotifyArtistAlbums = vi.fn();
const getSpotifyAlbumTracks = vi.fn();
const ingestSpotifyAlbum = vi.fn();
const ingestSpotifyTrack = vi.fn();
const ingest = vi.fn();

vi.mock('@/api/generated/spotify-ingest/spotify-ingest', () => ({
  getSpotifyArtistAlbums: (...args: unknown[]) => getSpotifyArtistAlbums(...args),
  getSpotifyAlbumTracks: (...args: unknown[]) => getSpotifyAlbumTracks(...args),
  ingestSpotifyAlbum: (...args: unknown[]) => ingestSpotifyAlbum(...args),
  ingestSpotifyTrack: (...args: unknown[]) => ingestSpotifyTrack(...args),
}));

vi.mock('@/api/generated/admin-maintenance/admin-maintenance', () => ({
  ingest: (...args: unknown[]) => ingest(...args),
}));

describe('AdminIngestPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    getSpotifyArtistAlbums.mockReset();
    getSpotifyAlbumTracks.mockReset();
    ingestSpotifyAlbum.mockReset();
    ingestSpotifyTrack.mockReset();
    ingest.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    toastSpy.mockRestore();
    root.unmount();
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(<AdminIngestPage />);
    });
  }

  function getUrlInput() {
    const input = Array.from(document.body.querySelectorAll('input')).find((el) =>
      el.placeholder.startsWith('https://open.spotify.com'),
    );
    expect(input).toBeDefined();
    return input as HTMLInputElement;
  }

  function clickButton(text: string, scope: ParentNode = document.body) {
    const button = Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
  }

  function closestWithText(el: Element, text: string): HTMLElement {
    let current: HTMLElement | null = el as HTMLElement;
    while (current && !current.textContent?.includes(text)) {
      current = current.parentElement;
    }
    expect(current).toBeDefined();
    return current as HTMLElement;
  }

  async function click(button: HTMLButtonElement) {
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('shows the invalid-URL error inline next to the Hämta från Spotify button, not as a toast', async () => {
    await renderPage();

    await act(async () => {
      typeInto(getUrlInput(), 'not-a-spotify-url');
    });

    const fetchButton = clickButton('Hämta från Spotify');
    await click(fetchButton);

    const panel = closestWithText(fetchButton, 'Klistra in en Spotify-URL');
    const alert = panel.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Ogiltig Spotify-URL');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the unidentified-resource error inline next to the Hämta från Spotify button, not as a toast', async () => {
    await renderPage();

    await act(async () => {
      typeInto(getUrlInput(), 'a'.repeat(22));
    });

    const fetchButton = clickButton('Hämta från Spotify');
    await click(fetchButton);

    const panel = closestWithText(fetchButton, 'Klistra in en Spotify-URL');
    const alert = panel.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte identifiera resurstyp. Ange fullständig URL.');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the preview-fetch error inline next to the Hämta från Spotify button, not as a toast', async () => {
    getSpotifyArtistAlbums.mockRejectedValue(new Error('Server error'));

    await renderPage();

    await act(async () => {
      typeInto(getUrlInput(), 'https://open.spotify.com/artist/1234567890abcdefghijkl');
    });

    const fetchButton = clickButton('Hämta från Spotify');
    await click(fetchButton);

    const panel = closestWithText(fetchButton, 'Klistra in en Spotify-URL');
    const alert = panel.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta förhandsgranskning');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the import error inline next to the Importera button, not as a toast', async () => {
    ingestSpotifyTrack.mockRejectedValue(new Error('Server error'));

    await renderPage();

    await act(async () => {
      typeInto(getUrlInput(), 'spotify:track:1234567890abcdefghijkl');
    });

    const fetchButton = clickButton('Hämta från Spotify');
    await click(fetchButton);

    const importButton = clickButton('Importera spår');
    await click(importButton);

    const panel = closestWithText(importButton, 'Förhandsgranskning');
    const alert = panel.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Import misslyckades');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the single-album import error inline in that album row, not as a toast', async () => {
    getSpotifyArtistAlbums.mockResolvedValue([
      { id: 'album-9', name: 'Spelmansalbum', totalTracks: 5 },
    ]);
    ingestSpotifyAlbum.mockRejectedValue(new Error('Server error'));

    await renderPage();

    await act(async () => {
      typeInto(getUrlInput(), 'https://open.spotify.com/artist/1234567890abcdefghijkl');
    });

    const fetchButton = clickButton('Hämta från Spotify');
    await click(fetchButton);

    const rowButton = clickButton('Importera album');
    await click(rowButton);

    const row = rowButton.parentElement as HTMLElement;
    const alert = row.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Album-import misslyckades');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
