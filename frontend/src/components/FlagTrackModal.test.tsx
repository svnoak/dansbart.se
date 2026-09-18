import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FlagTrackModal } from './FlagTrackModal';
import type { TrackListDto } from '@/api/models/trackListDto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getStyleTree = vi.fn();

vi.mock('@/api/generated/styles/styles', () => ({
  getStyleTree: () => getStyleTree(),
}));

vi.mock('@/api/generated/tracks/tracks', () => ({
  submitFeedback: vi.fn(),
  flagTrack: vi.fn(),
}));

const track: TrackListDto = { id: 'track-1', title: 'Test track', danceStyle: 'Polska' };

describe('FlagTrackModal style-tree fetch', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getStyleTree.mockReset();
    getStyleTree.mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it('fetches the style tree only after the modal opens', async () => {
    await act(async () => {
      root.render(<FlagTrackModal open={false} onClose={() => {}} track={track} />);
    });
    expect(getStyleTree).not.toHaveBeenCalled();

    await act(async () => {
      root.render(<FlagTrackModal open={true} onClose={() => {}} track={track} />);
    });
    expect(getStyleTree).toHaveBeenCalledTimes(1);

    root.unmount();
    container.remove();
  });
});
