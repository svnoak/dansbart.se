import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StyleBadge } from './StyleBadge';
import { ThemeProvider } from '@/theme/ThemeContext';
import { getStyleColor } from '@/styles/danceStyleColors';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getStyleTree = vi.fn();
const submitFeedback = vi.fn();
vi.mock('@/api/generated/styles/styles', () => ({ getStyleTree: () => getStyleTree() }));
vi.mock('@/api/generated/tracks/tracks', () => ({ submitFeedback: (...a: unknown[]) => submitFeedback(...a) }));
const mockStyleTree = [{ name: 'Polska', subStyles: ['Värmländska', 'Uppländska'] }, { name: 'Halling', subStyles: [] }, { name: 'Springar', subStyles: ['Långa springar', 'Korta springar'] }];

describe('StyleBadge', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getStyleTree.mockReset().mockResolvedValue(mockStyleTree);
    submitFeedback.mockReset().mockResolvedValue({ styleJustConfirmed: false });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function renderAndVoteForHalling(style: string, confidence: number) {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <StyleBadge trackId="track-1" trackTitle="Test Track" danceStyle={style} confidence={confidence} styleColor={getStyleColor(style)} />
        </ThemeProvider>,
      );
    });

    const badgeButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Ändra dansstil"]');
    expect(badgeButton).toBeDefined();
    await act(async () => { badgeButton?.click(); });
    const hallingButton = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Halling'));
    expect(hallingButton).toBeDefined();
    await act(async () => {
      hallingButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    return badgeButton;
  }

  it('renders a button named Ändra dansstil when the track has a style', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <StyleBadge
            trackId="track-1"
            trackTitle="Test Track"
            danceStyle="Polska"
            confidence={0.8}
            styleColor={getStyleColor('Polska')}
          />
        </ThemeProvider>,
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Ändra dansstil"]');
    expect(button).toBeDefined();
    expect(button?.textContent).toContain('Polska');
  });

  it('renders a button named Ange dansstil when the track has no style', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <StyleBadge
            trackId="track-1"
            trackTitle="Test Track"
            danceStyle={null}
            confidence={0}
            styleColor={getStyleColor(null)}
          />
        </ThemeProvider>,
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Ange dansstil"]');
    expect(button).toBeDefined();
    expect(button?.textContent).toContain('Okänd stil');
  });

  it('opens the style vote panel on click', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <StyleBadge
            trackId="track-1"
            trackTitle="Test Track"
            danceStyle="Polska"
            confidence={0.8}
            styleColor={getStyleColor('Polska')}
          />
        </ThemeProvider>,
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Ändra dansstil"]');

    await act(async () => {
      button?.click();
    });

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeDefined();
    expect(dialog?.textContent).toContain('Test Track');
  });

  it('shows an edit icon', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <StyleBadge
            trackId="track-1"
            trackTitle="Test Track"
            danceStyle="Polska"
            confidence={0.8}
            styleColor={getStyleColor('Polska')}
          />
        </ThemeProvider>,
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Ändra dansstil"]');
    const editIconPath = button?.querySelector('path[d*="M11 5H6"]');
    expect(editIconPath).toBeDefined();
  });

  it('shows the confirmed check icon for a confirmed style', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <StyleBadge
            trackId="track-1"
            trackTitle="Test Track"
            danceStyle="Polska"
            confidence={1.0}
            styleColor={getStyleColor('Polska')}
          />
        </ThemeProvider>,
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Ändra dansstil"]');
    const checkIconPath = button?.querySelector('path[d*="M5 13l4 4L19 7"]');
    expect(checkIconPath).toBeDefined();
  });

  it.each([[true, 'Halling'], [false, 'Polska']])('updates badge after vote (confirmed=%s)', async (confirmed, expectedStyle) => {
    submitFeedback.mockResolvedValue({ styleJustConfirmed: confirmed });
    const badgeButton = await renderAndVoteForHalling('Polska', 0.5);
    expect(badgeButton?.textContent).toContain(expectedStyle);
    expect(!!badgeButton?.querySelector('path[d*="M5 13l4 4L19 7"]')).toBe(confirmed);
  });
});
