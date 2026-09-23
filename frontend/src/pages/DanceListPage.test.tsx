import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import DanceListPage from './DanceListPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getDanceList = vi.fn();
const addEntry = vi.fn();
const removeEntry = vi.fn();
const getDances = vi.fn();

vi.mock('@/api/generated/dance-lists/dance-lists', () => ({
  getDanceList: (...args: unknown[]) => getDanceList(...args),
  addEntry: (...args: unknown[]) => addEntry(...args),
  removeEntry: (...args: unknown[]) => removeEntry(...args),
}));

vi.mock('@/api/generated/dances/dances', () => ({
  getDances: (...args: unknown[]) => getDances(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'list-1' }),
  };
});

const mockDanceListFull = {
  id: 'list-1',
  name: 'My Dances',
  description: 'A list of my favorite dances',
  isPublic: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  owner: { id: 'user-1', username: 'testuser', displayName: 'Test User' },
  ownerGroup: null,
  entries: [
    {
      id: 'entry-1',
      danceId: 'dance-1',
      danceName: 'Familjevals från Ödsmål',
      freeTextName: null,
      playMode: 'in_order',
      position: 0,
      tracks: [],
    },
    {
      id: 'entry-2',
      danceId: null,
      danceName: null,
      freeTextName: 'Egen dans',
      playMode: 'in_order',
      position: 1,
      tracks: [],
    },
  ],
  collaborators: [],
};

const mockDanceListEmpty = {
  ...mockDanceListFull,
  entries: [],
};

const mockDanceListReadOnly = {
  ...mockDanceListFull,
  collaborators: [
    {
      id: 'collab-1',
      userId: 'current-user',
      username: 'currentuser',
      displayName: 'Current User',
      permission: 'view',
      status: 'accepted',
    },
  ],
};

const mockSearchResults = {
  content: [
    {
      id: 'dance-familjevals',
      name: 'Familjevals från Ödsmål',
      bpmMin: 110,
      bpmMax: 130,
    },
  ],
  pageNumber: 0,
  pageSize: 20,
  totalElements: 1,
};

const mockEmptySearchResults = {
  content: [],
  pageNumber: 0,
  pageSize: 20,
  totalElements: 0,
};

describe('DanceListPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getDanceList.mockReset();
    addEntry.mockReset();
    removeEntry.mockReset();
    getDances.mockReset();
    getDanceList.mockResolvedValue(mockDanceListFull);
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
        <BrowserRouter>
          <DanceListPage />
        </BrowserRouter>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  }

  function clickButton(text: string) {
    const button = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(text),
    );
    expect(button).toBeDefined();
    return button;
  }

  function getInputByLabel(label: string) {
    const labelElement = Array.from(document.body.querySelectorAll('label')).find((l) =>
      l.textContent?.includes(label),
    );
    if (!labelElement) {
      return null;
    }
    const inputId = labelElement.getAttribute('for');
    if (inputId) {
      return document.getElementById(inputId) as HTMLInputElement | null;
    }
    return labelElement.querySelector('input') as HTMLInputElement | null;
  }

  it('shows the list and its dances', async () => {
    await renderPage();

    const text = document.body.textContent;
    expect(text).toContain('Familjevals från Ödsmål');
    expect(text).toContain('Egen dans');
  });

  it('shows an empty text', async () => {
    getDanceList.mockResolvedValue(mockDanceListEmpty);

    await renderPage();

    const text = document.body.textContent;
    expect(text).toContain('Danslistan har inga danser ännu.');
  });

  it('adds a dance from the site', async () => {
    getDances.mockResolvedValue(mockSearchResults);
    addEntry.mockResolvedValue({
      id: 'entry-3',
      danceId: 'dance-familjevals',
      danceName: 'Familjevals från Ödsmål',
      freeTextName: null,
      playMode: 'in_order',
      position: 2,
      tracks: [],
    });

    await renderPage();

    const addButton = clickButton('Lägg till dans');
    await act(async () => {
      addButton?.click();
    });

    const searchInput = getInputByLabel('Sök efter dans');
    expect(searchInput).toBeDefined();

    await act(async () => {
      searchInput!.value = 'Fam';
      searchInput!.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const resultButton = clickButton('Familjevals från Ödsmål');
    await act(async () => {
      resultButton?.click();
    });

    const addFromResultButton = clickButton('Lägg till');
    await act(async () => {
      addFromResultButton?.click();
    });

    expect(addEntry).toHaveBeenCalledWith('list-1', expect.objectContaining({ danceId: 'dance-familjevals' }));
  });

  it('adds a dance that is missing', async () => {
    getDances.mockResolvedValue(mockEmptySearchResults);
    addEntry.mockResolvedValue({
      id: 'entry-3',
      danceId: null,
      danceName: null,
      freeTextName: 'Egen dans',
      playMode: 'in_order',
      position: 2,
      tracks: [],
    });

    await renderPage();

    const addButton = clickButton('Lägg till dans');
    await act(async () => {
      addButton?.click();
    });

    const searchInput = getInputByLabel('Sök efter dans');
    expect(searchInput).toBeDefined();

    await act(async () => {
      searchInput!.value = 'Egen dans';
      searchInput!.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const addAsTypedButton = clickButton('Lägg till som egen dans');
    await act(async () => {
      addAsTypedButton?.click();
    });

    expect(addEntry).toHaveBeenCalledWith('list-1', expect.objectContaining({ freeTextName: 'Egen dans' }));
  });

  it('removes a dance', async () => {
    removeEntry.mockResolvedValue(undefined);

    await renderPage();

    const removeButton = clickButton('Ta bort');
    await act(async () => {
      removeButton?.click();
    });

    const confirmButton = clickButton('Ja, ta bort');
    await act(async () => {
      confirmButton?.click();
    });

    expect(removeEntry).toHaveBeenCalledWith('list-1', 'entry-1');
  });

  it('a person who may only view sees no add or remove', async () => {
    getDanceList.mockResolvedValue(mockDanceListReadOnly);

    await renderPage();

    const text = document.body.textContent;
    const hasAddButton = Array.from(document.body.querySelectorAll('button')).some((b) =>
      b.textContent?.includes('Lägg till'),
    );
    const hasRemoveButton = Array.from(document.body.querySelectorAll('button')).some((b) =>
      b.textContent?.includes('Ta bort'),
    );

    expect(hasAddButton).toBe(false);
    expect(hasRemoveButton).toBe(false);
  });

  it('shows not found', async () => {
    getDanceList.mockRejectedValue(new Error('not found'));

    await renderPage();

    const text = document.body.textContent;
    expect(text).toContain('Danslistan hittades inte.');
  });
});
