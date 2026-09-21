import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StyleVotePanel } from './StyleVotePanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getStyleTree = vi.fn();
const submitFeedback = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/styles/styles', () => ({
  getStyleTree: () => getStyleTree(),
}));

vi.mock('@/api/generated/tracks/tracks', () => ({
  submitFeedback: (...args: unknown[]) => submitFeedback(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

const mockStyleTree = [
  { name: 'Polska', subStyles: ['Värmländska', 'Uppländska'] },
  { name: 'Halling', subStyles: [] },
  { name: 'Springar', subStyles: ['Långa springar', 'Korta springar'] },
];

describe('StyleVotePanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getStyleTree.mockReset();
    getStyleTree.mockResolvedValue(mockStyleTree);
    submitFeedback.mockReset();
    submitFeedback.mockResolvedValue({ styleJustConfirmed: false });
    useAuth.mockReset();
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null, login: vi.fn(), logout: vi.fn() });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function renderPanel(
    props: Partial<{
      currentStyle: string | null;
      open: boolean;
      onClose: () => void;
      onVoted?: (style: string, confirmed: boolean) => void;
    }> = {},
  ) {
    await act(async () => {
      root.render(
        <StyleVotePanel
          trackId="track-1"
          trackTitle="Test Track"
          currentStyle="Polska"
          open
          onClose={() => {}}
          {...props}
        />,
      );
    });
  }

  function clickButton(text: string) {
    const button = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
    expect(button).toBeDefined();
    return button;
  }
  it('fetches the style tree only after the panel opens', async () => {
    await renderPanel({ open: false });
    expect(getStyleTree).not.toHaveBeenCalled();

    await renderPanel();
    expect(getStyleTree).toHaveBeenCalledTimes(1);
  });

  it('shows the current style', async () => {
    await renderPanel();

    const currentStyleText = document.body.textContent;
    expect(currentStyleText).toContain('Nuvarande dansstil: Polska');

    await renderPanel({ currentStyle: null });

    const noStyleText = document.body.textContent;
    expect(noStyleText).toContain('Dansstil saknas');
  });

  it('submits a main style with no sub-styles in one tap', async () => {
    await renderPanel({ currentStyle: null });

    const buttons = document.body.querySelectorAll('button');
    const hallingButton = Array.from(buttons).find((b) => b.textContent?.includes('Halling'));
    expect(hallingButton).toBeDefined();

    await act(async () => {
      hallingButton?.click();
    });

    expect(submitFeedback).toHaveBeenCalledWith(
      'track-1',
      expect.objectContaining({ suggestedStyle: 'Halling' }),
      expect.any(Object),
    );
    expect(vi.mocked(submitFeedback).mock.calls[0][1].tempoCorrection).toBeUndefined();
  });

  it('asks for the sub-style when the main style has sub-styles', async () => {
    await renderPanel({ currentStyle: null });

    const buttons = document.body.querySelectorAll('button');
    const polskaButton = Array.from(buttons).find((b) => b.textContent?.includes('Polska'));

    await act(async () => {
      polskaButton?.click();
    });

    const substyleText = document.body.textContent;
    expect(substyleText).toContain('Värmländska');
    expect(substyleText).toContain('Uppländska');

    const substyleButtons = document.body.querySelectorAll('button');
    const varmlandskButton = Array.from(substyleButtons).find((b) =>
      b.textContent?.includes('Värmländska'),
    );

    await act(async () => {
      varmlandskButton?.click();
    });

    expect(submitFeedback).toHaveBeenCalledWith(
      'track-1',
      expect.objectContaining({ suggestedStyle: 'Värmländska' }),
      expect.any(Object),
    );
  });

  it('keeps the confirmation text after a vote', async () => {
    await renderPanel({ currentStyle: null });

    const buttons = document.body.querySelectorAll('button');
    const hallingButton = Array.from(buttons).find((b) => b.textContent?.includes('Halling'));

    await act(async () => {
      hallingButton?.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const confirmationText = document.body.textContent;
    expect(confirmationText).toContain('Tack! Din röst är sparad.');
  });

  it('shows an error and keeps the styles when the vote fails', async () => {
    submitFeedback.mockRejectedValue(new Error('network'));

    await renderPanel({ currentStyle: null });

    const hallingButton = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Halling'),
    );

    await act(async () => {
      hallingButton?.click();
    });

    expect(document.body.textContent).toContain('Det gick inte att spara din röst. Försök igen.');
    expect(document.body.textContent).not.toContain('Tack! Din röst är sparad.');
    expect(
      Array.from(document.body.querySelectorAll('button')).some((b) => b.textContent?.includes('Halling')),
    ).toBe(true);
  });

  it('closes from the Stäng button', async () => {
    const onClose = vi.fn();

    await renderPanel({ onClose });

    const closeButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Stäng"]');
    expect(closeButton).toBeDefined();

    await act(async () => {
      closeButton?.click();
    });

    expect(onClose).toHaveBeenCalled();
  });

  it.each([[true], [false]])('calls onVoted with confirmed=%s', async (confirmed) => {
    const onVoted = vi.fn();
    submitFeedback.mockResolvedValue({ styleJustConfirmed: confirmed });
    await renderPanel({ currentStyle: null, onVoted });
    const hallingButton = clickButton('Halling');
    await act(async () => {
      hallingButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(onVoted).toHaveBeenCalledWith('Halling', confirmed);
  });

  it("says the style is confirmed when the vote confirms it", async () => {
    submitFeedback.mockResolvedValue({ styleJustConfirmed: true });
    await renderPanel({ currentStyle: null });

    const hallingButton = clickButton('Halling');
    await act(async () => {
      hallingButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Tack! Nu är stilen bekräftad.');
  });

  it('invites an anonymous voter to sign in when the vote does not confirm the style', async () => {
    submitFeedback.mockResolvedValue({ styleJustConfirmed: false });
    await renderPanel({ currentStyle: null });

    const hallingButton = clickButton('Halling');
    await act(async () => {
      hallingButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const text = document.body.textContent;
    expect(text).toContain('Tack! Din röst är sparad.');
    expect(text).not.toContain('Stilen bekräftas');
    expect(text).toContain('Inloggade användare kan bekräfta stilar med enbart en röst');

    const loginButton = clickButton('Logga in eller skapa konto');
    const mockLogin = useAuth().login;
    await act(async () => {
      loginButton?.click();
    });
    expect(mockLogin).toHaveBeenCalled();
  });

  it('shows only the thank-you text to a signed-in voter when the vote does not confirm the style', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, user: null, login: vi.fn(), logout: vi.fn() });
    submitFeedback.mockResolvedValue({ styleJustConfirmed: false });
    await renderPanel({ currentStyle: null });

    const hallingButton = clickButton('Halling');
    await act(async () => {
      hallingButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const text = document.body.textContent;
    expect(text).toContain('Tack! Din röst är sparad.');
    expect(text).not.toContain('Inloggade användare');
    expect(
      Array.from(document.body.querySelectorAll('button')).some((b) => b.textContent?.includes('Logga in'))
    ).toBe(false);
  });
});
