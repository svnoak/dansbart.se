import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { DanceListsPage } from './DanceListsPage';
import { authValue, loggedInAuthValue } from '@/test/authValue';
import { getInputByLabel } from '@/test/getInputByLabel';
import { typeInto } from '@/test/typeInto';
import { ToastContainer } from '@/ui';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getMyDanceLists = vi.fn();
const createDanceList = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/dance-lists/dance-lists', () => ({
  getMyDanceLists: () => getMyDanceLists(),
  createDanceList: (...args: unknown[]) => createDanceList(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

describe('DanceListsPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getMyDanceLists.mockReset();
    createDanceList.mockReset();
    useAuth.mockReset();
    useAuth.mockReturnValue(loggedInAuthValue({}));
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
          <DanceListsPage />
          <ToastContainer />
        </MemoryRouter>,
      );
    });
  }

  function getButtonByText(text: string) {
    return Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(text),
    );
  }

  it('shows my dance lists', async () => {
    getMyDanceLists.mockResolvedValue([
      { id: 'dl1', name: 'Sommarens danser', userId: 'u1' },
      { id: 'dl2', name: 'Vinterns danser', userId: 'u1' },
    ]);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Sommarens danser');
    expect(document.body.textContent).toContain('Vinterns danser');
    const link1 = document.querySelector('a[href="/dance-lists/dl1"]');
    const link2 = document.querySelector('a[href="/dance-lists/dl2"]');
    expect(link1).toBeDefined();
    expect(link2).toBeDefined();
  });

  it('shows an empty text', async () => {
    getMyDanceLists.mockResolvedValue([]);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Du har inga danslistor ännu.');
  });

  it('creates a dance list', async () => {
    getMyDanceLists.mockResolvedValue([]);
    createDanceList.mockResolvedValue({ id: 'dl3', name: 'Sommarens danser', userId: 'u1' });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const newButton = getButtonByText('Ny danslista');
    expect(newButton).toBeDefined();

    await act(async () => {
      newButton?.click();
    });

    const nameInput = getInputByLabel('Danslistans namn');
    expect(nameInput).toBeDefined();

    if (nameInput) typeInto(nameInput, 'Sommarens danser');

    const createButton = getButtonByText('Skapa danslista');
    expect(createButton).toBeDefined();

    await act(async () => {
      createButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(createDanceList).toHaveBeenCalledWith({ name: 'Sommarens danser' });
    expect(document.body.textContent).toContain('Sommarens danser');
  });

  it('shows an error when loading fails', async () => {
    getMyDanceLists.mockRejectedValue(new Error('Network error'));
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Det gick inte att hämta danslistorna.');
  });

  it('asks a visitor to log in', async () => {
    useAuth.mockReturnValue(authValue());
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const loginButton = Array.from(document.body.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Logga in'),
    );
    expect(loginButton).toBeDefined();
    expect(getMyDanceLists).not.toHaveBeenCalled();
  });

  it('renders the new dance list button small', async () => {
    getMyDanceLists.mockResolvedValue([]);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const newButton = getButtonByText('Ny danslista');
    expect(newButton).toBeDefined();
    expect(newButton?.className).toContain('px-3');
    expect(newButton?.className).toContain('py-1.5');
    expect(newButton?.className).not.toContain('px-4');
  });
});
