import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { TrackActionsModal } from './TrackActionsModal';
import type { TrackListDto } from '@/api/models/trackListDto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/ui', async () => {
  const actual = await vi.importActual('@/ui');
  return {
    ...actual,
    toast: vi.fn(),
  };
});

const track: TrackListDto = {
  id: 'track-1',
  title: 'Test Track',
  artistName: 'Test Artist',
  artistId: 'artist-1',
  danceStyle: 'Polska',
  tempoCategory: 'Medium',
  confidence: 0.85,
  durationMs: 180000,
};

describe('TrackActionsModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.clearAllMocks();
  });

  it('shows the track title and every option', async () => {
    const onClose = vi.fn();
    const onAddToQueue = vi.fn();
    const onFlag = vi.fn();

    await act(async () => {
      root.render(
        <MemoryRouter>
          <TrackActionsModal
            open
            track={track}
            onAddToQueue={onAddToQueue}
            onFlag={onFlag}
            onClose={onClose}
          />
        </MemoryRouter>,
      );
    });

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Test Track');
    expect(dialog?.textContent).toContain('Lägg i kö');
    expect(dialog?.textContent).toContain('Dela');
    expect(dialog?.textContent).toContain('Gå till artist');
    expect(dialog?.textContent).toContain('Rapportera problem');
  });

  it('runs an option and closes', async () => {
    const onClose = vi.fn();
    const onAddToQueue = vi.fn();
    const onFlag = vi.fn();

    await act(async () => {
      root.render(
        <MemoryRouter>
          <TrackActionsModal
            open
            track={track}
            onAddToQueue={onAddToQueue}
            onFlag={onFlag}
            onClose={onClose}
          />
        </MemoryRouter>,
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const addToQueueButton = buttons.find(btn => btn.textContent?.includes('Lägg i kö'));

    expect(addToQueueButton).toBeTruthy();

    await act(async () => {
      addToQueueButton?.click();
    });

    expect(onAddToQueue).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when a link is followed', async () => {
    const onClose = vi.fn();
    const onAddToQueue = vi.fn();
    const onFlag = vi.fn();

    await act(async () => {
      root.render(
        <MemoryRouter>
          <TrackActionsModal
            open
            track={track}
            onAddToQueue={onAddToQueue}
            onFlag={onFlag}
            onClose={onClose}
          />
        </MemoryRouter>,
      );
    });

    const links = Array.from(container.querySelectorAll('a'));
    const artistLink = links.find(a => a.textContent?.includes('Gå till artist'));

    expect(artistLink).toBeTruthy();

    await act(async () => {
      artistLink?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const onAddToQueue = vi.fn();
    const onFlag = vi.fn();

    await act(async () => {
      root.render(
        <MemoryRouter>
          <TrackActionsModal
            open
            track={track}
            onAddToQueue={onAddToQueue}
            onFlag={onFlag}
            onClose={onClose}
          />
        </MemoryRouter>,
      );
    });

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeDefined();

    await act(async () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      dialog.dispatchEvent(event);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', async () => {
    const onClose = vi.fn();
    const onAddToQueue = vi.fn();
    const onFlag = vi.fn();

    await act(async () => {
      root.render(
        <MemoryRouter>
          <TrackActionsModal
            open={false}
            track={track}
            onAddToQueue={onAddToQueue}
            onFlag={onFlag}
            onClose={onClose}
          />
        </MemoryRouter>,
      );
    });

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });
});
