import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AddMusicPage } from './AddMusicPage';
import { authValue, loggedInAuthValue } from '@/test/authValue';
import { typeInto } from '@/test/typeInto';
import { getInputByLabel } from '@/test/getInputByLabel';
import { ApiError } from '@/api/http-client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const submitMusicLink = vi.fn();
const getSubmissionBatch = vi.fn();
const useAuth = vi.fn();
const toast = vi.fn();

vi.mock('@/api/generated/track-submissions/track-submissions', () => ({
  submitMusicLink: (...args: unknown[]) => submitMusicLink(...args),
  getSubmissionBatch: (...args: unknown[]) => getSubmissionBatch(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('@/ui', async () => {
  const actual = await vi.importActual<typeof import('@/ui')>('@/ui');
  return { ...actual, toast: (...args: unknown[]) => toast(...args) };
});

const pendingBatch = {
  batchId: 'b1',
  provider: 'spotify',
  sourceKind: 'album',
  sourceName: 'Trio',
  needsReview: true,
  truncated: false,
  items: [
    {
      id: 's1',
      batchId: 'b1',
      title: 'Polska efter Pekkos Per',
      artistName: 'Väsen',
      albumName: 'Trio',
      suggestedMainStyle: 'Polska',
      status: 'pending',
    },
    {
      id: 's2',
      batchId: 'b1',
      title: 'Josefins dopvals',
      artistName: 'Väsen',
      albumName: 'Trio',
      status: 'exists',
      trackId: 't2',
    },
  ],
};

describe('AddMusicPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    submitMusicLink.mockReset();
    getSubmissionBatch.mockReset();
    toast.mockReset();
    useAuth.mockReset();
    useAuth.mockReturnValue(authValue());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AddMusicPage />
        </MemoryRouter>,
      );
    });
  }

  function clickAdd() {
    const button = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Lägg till'),
    );
    expect(button).toBeDefined();
    return act(async () => {
      button!.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }

  it('tells a signed-out person that an admin reviews their tracks', async () => {
    await renderPage();

    expect(document.body.textContent).toContain('Lägg till musik');
    expect(document.body.textContent).toContain('Du behöver inget konto');
  });

  it('does not show the review note to a signed-in person', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({}));
    await renderPage();

    expect(document.body.textContent).not.toContain('Du behöver inget konto');
  });

  it('asks for a link before sending', async () => {
    await renderPage();

    await clickAdd();

    expect(submitMusicLink).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Klistra in en länk först.');
  });

  it('sends the link with the voter id and lists the tracks with suggested styles and statuses', async () => {
    submitMusicLink.mockResolvedValue(pendingBatch);
    await renderPage();

    typeInto(getInputByLabel('Länk till Spotify eller YouTube') as HTMLInputElement, 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3');
    await clickAdd();

    expect(submitMusicLink).toHaveBeenCalledTimes(1);
    expect(submitMusicLink.mock.calls[0][0]).toEqual({ url: 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3' });
    const options = submitMusicLink.mock.calls[0][1] as { headers: Record<string, string> };
    expect(options.headers['X-Voter-ID']).toMatch(/[0-9a-f-]{36}/);

    const text = document.body.textContent ?? '';
    expect(text).toContain('Albumet Trio');
    expect(text).toContain('Polska efter Pekkos Per');
    expect(text).toContain('Polska');
    expect(text).toContain('Väntar på granskning');
    expect(text).toContain('Finns redan');
    expect(text).toContain('1 låt väntar på granskning, 1 låt fanns redan.');
    expect(toast).toHaveBeenCalledWith('Tack! 2 låtar granskas av en administratör innan de syns.');
    expect((getInputByLabel('Länk till Spotify eller YouTube') as HTMLInputElement).value).toBe('');
  });

  it('shows a trusted person that the tracks are being analysed', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({}));
    submitMusicLink.mockResolvedValue({
      ...pendingBatch,
      sourceKind: 'track',
      sourceName: null,
      needsReview: false,
      items: [{ ...pendingBatch.items[0], status: 'approved' }],
    });
    await renderPage();

    typeInto(getInputByLabel('Länk till Spotify eller YouTube') as HTMLInputElement, 'https://youtu.be/dQw4w9WgXcQ');
    await clickAdd();

    const text = document.body.textContent ?? '';
    expect(text).toContain('Hämtas');
    expect(text).not.toContain('En administratör tittar på låtarna');
    expect(toast).toHaveBeenCalledWith('Låten är tillagd och analyseras nu.');
  });

  it('explains an unrecognised link next to the input and keeps the text', async () => {
    submitMusicLink.mockRejectedValue(new ApiError('Request failed: 400', 400));
    await renderPage();

    typeInto(getInputByLabel('Länk till Spotify eller YouTube') as HTMLInputElement, 'https://example.com/x');
    await clickAdd();

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Länken känns inte igen');
    expect((getInputByLabel('Länk till Spotify eller YouTube') as HTMLInputElement).value).toBe('https://example.com/x');
    expect(toast).not.toHaveBeenCalled();
  });
});
