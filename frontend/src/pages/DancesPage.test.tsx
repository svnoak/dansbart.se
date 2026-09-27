import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { DancesPage } from './DancesPage';
import { ToastContainer } from '@/ui';
import * as toastEmitter from '@/ui/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const httpClient = vi.fn();
const getStyleOverview = vi.fn();
const getPrimaryTrack = vi.fn();
const getDanceTracks = vi.fn();
const usePlayerMock = { play: vi.fn() };

vi.mock('@/api/http-client', () => ({
  httpClient: (...args: unknown[]) => httpClient(...args),
}));

vi.mock('@/api/generated/discovery/discovery', () => ({
  getStyleOverview: () => getStyleOverview(),
}));

vi.mock('@/api/generated/dances/dances', () => ({
  getPrimaryTrack: (...args: unknown[]) => getPrimaryTrack(...args),
  getDanceTracks: (...args: unknown[]) => getDanceTracks(...args),
}));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => usePlayerMock,
}));

const mockDances = {
  items: [
    { id: 'dance-1', name: 'Familjevals från Ödsmål', danceType: 'Vals', confirmedTrackCount: 2 },
  ],
  total: 1,
};

describe('DancesPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    httpClient.mockReset();
    getStyleOverview.mockReset();
    getPrimaryTrack.mockReset();
    getDanceTracks.mockReset();
    usePlayerMock.play.mockReset();
    getStyleOverview.mockResolvedValue([]);
    httpClient.mockImplementation((input: string) => {
      if (typeof input === 'string' && input.startsWith('/api/dances?')) {
        return Promise.resolve(mockDances);
      }
      return Promise.reject(new Error('unexpected request'));
    });
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
      root.render(
        <MemoryRouter>
          <DancesPage />
          <ToastContainer />
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function getPlayButtonFor(danceName: string) {
    const li = Array.from(document.body.querySelectorAll('li')).find((el) =>
      el.textContent?.includes(danceName),
    );
    expect(li).toBeDefined();
    const button = li!.querySelector(`button[aria-label="Spela ${danceName}"]`) as HTMLButtonElement;
    expect(button).toBeDefined();
    return { li: li!, button };
  }

  it('shows the no-primary-track play error inline next to the play button, not as a toast', async () => {
    getPrimaryTrack.mockRejectedValue(new Error('no primary track'));
    getDanceTracks.mockResolvedValue([]);

    await renderPage();

    const { li, button } = getPlayButtonFor('Familjevals från Ödsmål');
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const alert = li.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Inga låtar länkade till denna dans');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows a play failure inline next to the play button, not as a toast', async () => {
    getPrimaryTrack.mockRejectedValue(new Error('no primary track'));
    getDanceTracks.mockRejectedValue(new Error('network error'));

    await renderPage();

    const { li, button } = getPlayButtonFor('Familjevals från Ödsmål');
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const alert = li.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte spela');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('keeps the play error of one dance when another dance plays', async () => {
    const twoDances = {
      items: [
        { id: 'dance-1', name: 'Familjevals från Ödsmål', danceType: 'Vals', confirmedTrackCount: 2 },
        { id: 'dance-2', name: 'Polska från Bingsjö', danceType: 'Polska', confirmedTrackCount: 1 },
      ],
      total: 2,
    };
    httpClient.mockImplementation((input: string) => {
      if (typeof input === 'string' && input.startsWith('/api/dances?')) {
        return Promise.resolve(twoDances);
      }
      return Promise.reject(new Error('unexpected request'));
    });
    getPrimaryTrack.mockImplementation((danceId: string) =>
      danceId === 'dance-2'
        ? Promise.resolve({ id: 'track-2' })
        : Promise.reject(new Error('no primary track')),
    );
    getDanceTracks.mockResolvedValue([]);

    await renderPage();

    const { li: liA, button: buttonA } = getPlayButtonFor('Familjevals från Ödsmål');
    await act(async () => {
      buttonA.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(liA.querySelector('[role="alert"]')?.textContent).toContain('Inga låtar länkade till denna dans');

    const { button: buttonB } = getPlayButtonFor('Polska från Bingsjö');
    await act(async () => {
      buttonB.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(usePlayerMock.play).toHaveBeenCalledWith(expect.objectContaining({ id: 'track-2' }));
    expect(liA.querySelector('[role="alert"]')?.textContent).toContain('Inga låtar länkade till denna dans');
  });
});
