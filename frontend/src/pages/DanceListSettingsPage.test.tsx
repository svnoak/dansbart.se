import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DanceListSettingsPage } from './DanceListSettingsPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getDanceList = vi.fn();
const updateDanceList = vi.fn();
const deleteDanceList = vi.fn();
const toast = vi.fn();

vi.mock('@/api/generated/dance-lists/dance-lists', () => ({
  getDanceList: (...args: unknown[]) => getDanceList(...args),
  updateDanceList: (...args: unknown[]) => updateDanceList(...args),
  deleteDanceList: (...args: unknown[]) => deleteDanceList(...args),
}));

vi.mock('@/components/GuestCodePanel', () => ({
  GuestCodePanel: () => <div>Gästkod</div>,
}));

vi.mock('@/ui', async () => {
  const actual = await vi.importActual<typeof import('@/ui')>('@/ui');
  return { ...actual, toast: (...args: unknown[]) => toast(...args) };
});

const groupList = {
  id: 'd1',
  name: 'Gruppens danslista',
  isPublic: false,
  ownerGroup: { id: 'g1', name: 'Barngruppen', isPublic: true },
  viewerCanManage: true,
  viewerHasFullControl: true,
  entries: [],
};

describe('DanceListSettingsPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getDanceList.mockReset();
    updateDanceList.mockReset();
    deleteDanceList.mockReset();
    toast.mockReset();
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
        <MemoryRouter initialEntries={['/dance-lists/d1/settings']}>
          <Routes>
            <Route path="/dance-lists/:id/settings" element={<DanceListSettingsPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  it('a group dance list shows its group and a way to manage the members', async () => {
    getDanceList.mockResolvedValue(groupList);
    await renderPage();

    expect(container.textContent).toContain('Ägs av gruppen Barngruppen');
    const membersLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Hantera gruppens medlemmar'),
    );
    expect(membersLink?.getAttribute('href')).toBe('/groups/g1/settings');
    expect(container.textContent).toContain('Bara gruppens medlemmar ser den.');
  });

  it('makes the dance list public', async () => {
    getDanceList.mockResolvedValue(groupList);
    updateDanceList.mockResolvedValue({});
    await renderPage();

    const toggle = container.querySelector<HTMLInputElement>('#dance-list-public');
    expect(toggle?.checked).toBe(false);
    await act(async () => {
      toggle?.click();
    });

    expect(updateDanceList).toHaveBeenCalledWith('d1', { isPublic: true });
    expect(container.querySelector<HTMLInputElement>('#dance-list-public')?.checked).toBe(true);
    expect(toast).toHaveBeenCalledWith('Danslistan är nu offentlig');
  });

  it('shows an error next to the switch when the change fails', async () => {
    getDanceList.mockResolvedValue(groupList);
    updateDanceList.mockRejectedValue(new Error('fail'));
    await renderPage();

    await act(async () => {
      container.querySelector<HTMLInputElement>('#dance-list-public')?.click();
    });

    expect(container.textContent).toContain('Det gick inte att ändra synligheten.');
    expect(container.querySelector<HTMLInputElement>('#dance-list-public')?.checked).toBe(false);
  });

  it('does not show the settings to a person without full control', async () => {
    getDanceList.mockResolvedValue({ ...groupList, viewerHasFullControl: false });
    await renderPage();

    expect(container.textContent).toContain('Du kan inte ändra inställningarna');
    expect(container.querySelector('#dance-list-public')).toBeNull();
  });
});
