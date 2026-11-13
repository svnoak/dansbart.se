import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DanceListSettingsPage } from './DanceListSettingsPage';
import { ApiError } from '@/api/http-client';
import { typeInto } from '@/test/typeInto';
import { getInputByLabel } from '@/test/getInputByLabel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getDanceList = vi.fn();
const updateDanceList = vi.fn();
const deleteDanceList = vi.fn();
const inviteDanceListCollaborator = vi.fn();
const updateDanceListCollaborator = vi.fn();
const removeDanceListCollaborator = vi.fn();
const transferDanceListOwnership = vi.fn();
const generateDanceListShareToken = vi.fn();
const toast = vi.fn();

vi.mock('@/api/generated/dance-lists/dance-lists', () => ({
  getDanceList: (...args: unknown[]) => getDanceList(...args),
  updateDanceList: (...args: unknown[]) => updateDanceList(...args),
  deleteDanceList: (...args: unknown[]) => deleteDanceList(...args),
  inviteDanceListCollaborator: (...args: unknown[]) => inviteDanceListCollaborator(...args),
  updateDanceListCollaborator: (...args: unknown[]) => updateDanceListCollaborator(...args),
  removeDanceListCollaborator: (...args: unknown[]) => removeDanceListCollaborator(...args),
  transferDanceListOwnership: (...args: unknown[]) => transferDanceListOwnership(...args),
  generateDanceListShareToken: (...args: unknown[]) => generateDanceListShareToken(...args),
  invalidateDanceListShareToken: vi.fn(),
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
    inviteDanceListCollaborator.mockReset();
    updateDanceListCollaborator.mockReset();
    removeDanceListCollaborator.mockReset();
    transferDanceListOwnership.mockReset();
    generateDanceListShareToken.mockReset();
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

  function buttonByText(text: string) {
    return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
  }

  it('a group dance list shows its group and a way to manage the members', async () => {
    getDanceList.mockResolvedValue(groupList);
    await renderPage();

    expect(container.textContent).toContain('Ägs av gruppen Barngruppen');
    const membersLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Hantera gruppens medlemmar'),
    );
    expect(membersLink?.getAttribute('href')).toBe('/groups/g1/settings');
    expect(container.textContent).toContain('Bara gruppens medlemmar och de ni delar med ser den.');
    expect(container.textContent).not.toContain('Överlåt ägarskap');
  });

  it('invites a person by username', async () => {
    getDanceList.mockResolvedValue(groupList);
    inviteDanceListCollaborator.mockResolvedValue({ id: 'c1' });
    await renderPage();

    await act(async () => typeInto(getInputByLabel('Användarnamn')!, 'kalle'));
    await act(async () => {
      buttonByText('Bjud in')?.click();
    });

    expect(inviteDanceListCollaborator).toHaveBeenCalledWith('d1', { username: 'kalle', permission: 'view' });
    expect(toast).toHaveBeenCalledWith('Inbjudan skickad');
  });

  it('invites a group by name and explains an unknown name', async () => {
    getDanceList.mockResolvedValue(groupList);
    inviteDanceListCollaborator.mockRejectedValue(new ApiError('Unprocessable', 422));
    await renderPage();

    await act(async () => {
      buttonByText('Grupp')?.click();
    });
    await act(async () => typeInto(getInputByLabel('Gruppnamn')!, 'Polskegruppen'));
    await act(async () => {
      buttonByText('Bjud in')?.click();
    });

    expect(inviteDanceListCollaborator).toHaveBeenCalledWith('d1', { groupName: 'Polskegruppen', permission: 'view' });
    expect(container.textContent).toContain('Ingen grupp heter så. Kontrollera stavningen.');
  });

  it('changes and removes a collaborator by its id', async () => {
    getDanceList.mockResolvedValue({
      ...groupList,
      collaborators: [
        { id: 'c1', userId: 'u2', username: 'kalle', displayName: 'Kalle', permission: 'view', status: 'accepted' },
      ],
    });
    updateDanceListCollaborator.mockResolvedValue({});
    removeDanceListCollaborator.mockResolvedValue(undefined);
    await renderPage();

    const select = container.querySelector<HTMLSelectElement>('#permission-c1');
    await act(async () => {
      if (select) {
        select.value = 'edit';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    expect(updateDanceListCollaborator).toHaveBeenCalledWith('d1', 'c1', { permission: 'edit' });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Ta bort Kalle"]')?.click();
    });
    expect(removeDanceListCollaborator).toHaveBeenCalledWith('d1', 'c1');
    expect(container.textContent).not.toContain('Kalle');
  });

  it('creates a share link to the shared dance list page', async () => {
    getDanceList.mockResolvedValue(groupList);
    generateDanceListShareToken.mockResolvedValue({ shareToken: 'tok' });
    await renderPage();

    await act(async () => {
      buttonByText('Skapa länk')?.click();
    });

    expect(container.querySelector<HTMLInputElement>('#dance-list-share-url')?.value).toBe(
      `${window.location.origin}/dance-lists/shared/tok`,
    );
  });

  it('a personal owner can transfer the list to an accepted collaborator', async () => {
    getDanceList.mockResolvedValue({
      ...groupList,
      ownerGroup: undefined,
      owner: { id: 'u1', username: 'user1', displayName: 'User 1' },
      collaborators: [
        { id: 'c1', userId: 'u2', username: 'kalle', displayName: 'Kalle', permission: 'edit', status: 'accepted' },
      ],
    });
    await renderPage();

    expect(container.textContent).toContain('Överlåt ägarskap');
  });

  it('an edit collaborator sees the share link but not the owner controls', async () => {
    getDanceList.mockResolvedValue({ ...groupList, viewerHasFullControl: false });
    await renderPage();

    expect(container.textContent).toContain('Delningslänk');
    expect(container.querySelector('#dance-list-public')).toBeNull();
    expect(container.textContent).not.toContain('Radera danslista');
    expect(container.textContent).not.toContain('Bjud in');
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

  it('does not show the settings to a person who cannot edit', async () => {
    getDanceList.mockResolvedValue({ ...groupList, viewerCanManage: false, viewerHasFullControl: false });
    await renderPage();

    expect(container.textContent).toContain('Du kan inte ändra inställningarna');
    expect(container.querySelector('#dance-list-public')).toBeNull();
  });
});
