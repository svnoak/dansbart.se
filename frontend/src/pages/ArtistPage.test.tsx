import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ArtistPage } from './ArtistPage';
import { ToastContainer } from '@/ui';
import * as toastEmitter from '@/ui/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getArtist = vi.fn();
const getArtistAlbums = vi.fn();
const flagArtist = vi.fn();

vi.mock('@/api/generated/artists/artists', () => ({
  getArtist: (...args: unknown[]) => getArtist(...args),
  getArtistAlbums: (...args: unknown[]) => getArtistAlbums(...args),
  flagArtist: (...args: unknown[]) => flagArtist(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'artist-1' }),
  };
});

const mockArtist = {
  id: 'artist-1',
  name: 'Test Artist',
  isVerified: false,
};

describe('ArtistPage flag artist button', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    getArtist.mockReset();
    getArtistAlbums.mockReset();
    flagArtist.mockReset();
    getArtist.mockResolvedValue(mockArtist);
    getArtistAlbums.mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    toastSpy.mockRestore();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ArtistPage />
          <ToastContainer />
        </MemoryRouter>,
      );
    });
  }

  function getFlagButton() {
    return document.body.querySelector<HTMLButtonElement>('[aria-label="Rapportera artist"]');
  }

  function getDialog() {
    return document.body.querySelector<HTMLDivElement>('[role="dialog"]');
  }

  function getButtonInDialog(dialog: HTMLDivElement, text: string) {
    return Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === text);
  }

  it('shows a button named "Rapportera artist" next to the artist name', async () => {
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const reportButton = getFlagButton();
    expect(reportButton).not.toBeNull();
    expect(reportButton?.getAttribute('aria-label')).toBe('Rapportera artist');
    expect(document.body.textContent).toContain('Test Artist');
  });

  it('clicking the button opens a confirm dialog asking to report the artist', async () => {
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const reportButton = getFlagButton();
    expect(reportButton).not.toBeNull();

    await act(async () => {
      reportButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const dialog = getDialog();
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Är du säker på att du vill rapportera Test Artist som inte dansbar?');

    const cancelButton = dialog ? getButtonInDialog(dialog, 'Avbryt') : undefined;
    const reportConfirmButton = dialog ? getButtonInDialog(dialog, 'Rapportera') : undefined;
    expect(cancelButton).toBeDefined();
    expect(reportConfirmButton).toBeDefined();
    expect(flagArtist).not.toHaveBeenCalled();
  });

  it('clicking "Rapportera" calls flagArtist, closes the dialog, and shows a success toast', async () => {
    flagArtist.mockResolvedValue(undefined);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const reportButton = getFlagButton();
    await act(async () => {
      reportButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const dialog = getDialog();
    const reportConfirmButton = dialog ? getButtonInDialog(dialog, 'Rapportera') : undefined;
    await act(async () => {
      reportConfirmButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(flagArtist).toHaveBeenCalledWith('artist-1');
    expect(toastSpy).toHaveBeenCalledWith('Artisten är rapporterad', 'success');

    const dialogAfter = getDialog();
    expect(dialogAfter).toBeNull();
  });

  it('clicking "Avbryt" closes the dialog without calling flagArtist', async () => {
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const reportButton = getFlagButton();
    expect(reportButton).not.toBeNull();

    await act(async () => {
      reportButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const dialog = getDialog();
    const cancelButton = dialog ? getButtonInDialog(dialog, 'Avbryt') : undefined;
    expect(cancelButton).toBeDefined();

    await act(async () => {
      cancelButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(flagArtist).not.toHaveBeenCalled();

    const dialogAfter = getDialog();
    expect(dialogAfter).toBeNull();
  });

  it('when flagArtist rejects, the dialog stays open and shows the error inline', async () => {
    flagArtist.mockRejectedValue(new Error('Network error'));
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const reportButton = getFlagButton();
    await act(async () => {
      reportButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const dialog = getDialog();
    const reportConfirmButton = dialog ? getButtonInDialog(dialog, 'Rapportera') : undefined;
    await act(async () => {
      reportConfirmButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const dialogStillOpen = getDialog();
    expect(dialogStillOpen).not.toBeNull();

    const errorAlert = dialogStillOpen?.querySelector('[role="alert"]');
    expect(errorAlert?.textContent).toBe('Kunde inte rapportera artisten. Försök igen.');

    expect(toastSpy).not.toHaveBeenCalled();

    const cancelButton = dialogStillOpen ? getButtonInDialog(dialogStillOpen, 'Avbryt') : undefined;
    await act(async () => {
      cancelButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await act(async () => {
      getFlagButton()?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const reopenedDialog = getDialog();
    expect(reopenedDialog).not.toBeNull();
    expect(reopenedDialog?.querySelector('[role="alert"]')).toBeNull();
  });
});
