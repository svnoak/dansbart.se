import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AdminSubmissionsPage } from './AdminSubmissionsPage';
import * as toastEmitter from '@/admin/components/toastEmitter';
import { typeInto } from '@/test/typeInto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const listTrackSubmissions = vi.fn();
const approveTrackSubmission = vi.fn();
const approveTrackSubmissionBatch = vi.fn();
const rejectTrackSubmission = vi.fn();
const getStyleTree = vi.fn();

vi.mock('@/api/generated/admin-track-submissions/admin-track-submissions', () => ({
  listTrackSubmissions: (...args: unknown[]) => listTrackSubmissions(...args),
  approveTrackSubmission: (...args: unknown[]) => approveTrackSubmission(...args),
  approveTrackSubmissionBatch: (...args: unknown[]) => approveTrackSubmissionBatch(...args),
  rejectTrackSubmission: (...args: unknown[]) => rejectTrackSubmission(...args),
}));

vi.mock('@/api/generated/styles/styles', () => ({
  getStyleTree: (...args: unknown[]) => getStyleTree(...args),
}));

const pending = {
  items: [
    {
      id: 's1',
      batchId: 'b1',
      provider: 'spotify',
      sourceKind: 'album',
      sourceName: 'Trio',
      sourceUrl: 'https://open.spotify.com/album/x',
      title: 'Polska efter Pekkos Per',
      artistName: 'Väsen',
      suggestedMainStyle: 'Polska',
      status: 'pending',
      submitterName: 'anna',
      createdAt: '2026-10-11T10:00:00Z',
    },
    {
      id: 's2',
      batchId: 'b1',
      provider: 'spotify',
      sourceKind: 'album',
      sourceName: 'Trio',
      title: 'Josefins dopvals',
      artistName: 'Väsen',
      status: 'pending',
      submitterName: 'anna',
    },
  ],
  total: 2,
  limit: 50,
  offset: 0,
};

describe('AdminSubmissionsPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    listTrackSubmissions.mockReset();
    approveTrackSubmission.mockReset();
    approveTrackSubmissionBatch.mockReset();
    rejectTrackSubmission.mockReset();
    getStyleTree.mockReset();
    getStyleTree.mockResolvedValue([
      { name: 'Polska', subStyles: ['Slängpolska'] },
      { name: 'Vals', subStyles: [] },
    ]);
    listTrackSubmissions.mockResolvedValue(pending);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    toastSpy.mockRestore();
    root.unmount();
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminSubmissionsPage />
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }

  function buttons(label: string) {
    return Array.from(document.body.querySelectorAll('button')).filter((b) => {
      const text = b.textContent?.trim() ?? '';
      return text === label || text.startsWith(`${label} (`);
    });
  }

  it('lists pending tracks grouped by link with the submitter', async () => {
    await renderPage();

    expect(listTrackSubmissions).toHaveBeenCalledWith({ status: 'pending', limit: 50, offset: 0 });
    const text = document.body.textContent ?? '';
    expect(text).toContain('Album: Trio');
    expect(text).toContain('Från anna');
    expect(text).toContain('2 låtar');
    expect(text).toContain('Polska efter Pekkos Per');
    expect(buttons('Godkänn alla (2)')).toHaveLength(1);
  });

  it('approves a track with the suggested style by default', async () => {
    approveTrackSubmission.mockResolvedValue({ ...pending.items[0], status: 'approved' });
    await renderPage();

    await act(async () => {
      buttons('Godkänn')[0]!.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(approveTrackSubmission).toHaveBeenCalledWith('s1', {});
    expect(toastSpy).toHaveBeenCalledWith('Låten är godkänd och analyseras nu');
    expect(listTrackSubmissions).toHaveBeenCalledTimes(2);
  });

  it('sends a changed style with the approval', async () => {
    approveTrackSubmission.mockResolvedValue({ ...pending.items[0], status: 'approved' });
    await renderPage();

    const select = document.getElementById('style-s1') as HTMLSelectElement;
    expect(select.value).toBe('Polska');
    await act(async () => {
      select.value = 'Polska|Slängpolska';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      buttons('Godkänn')[0]!.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(approveTrackSubmission).toHaveBeenCalledWith('s1', { mainStyle: 'Polska', subStyle: 'Slängpolska' });
  });

  it('approves a whole link at once', async () => {
    approveTrackSubmissionBatch.mockResolvedValue([]);
    await renderPage();

    await act(async () => {
      buttons('Godkänn alla')[0]!.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(approveTrackSubmissionBatch).toHaveBeenCalledWith('b1');
    expect(toastSpy).toHaveBeenCalledWith('Alla väntande låtar i gruppen är godkända');
  });

  it('rejects a track with a note', async () => {
    rejectTrackSubmission.mockResolvedValue({ ...pending.items[0], status: 'rejected' });
    await renderPage();

    await act(async () => {
      buttons('Avvisa')[0]!.click();
    });
    const note = document.getElementById('reject-note') as HTMLInputElement;
    expect(note).not.toBeNull();
    await act(async () => {
      typeInto(note, 'Inte dansmusik');
    });
    await act(async () => {
      buttons('Avvisa').at(-1)!.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(rejectTrackSubmission).toHaveBeenCalledWith('s1', { reviewNote: 'Inte dansmusik' });
    expect(toastSpy).toHaveBeenCalledWith('Låten är avvisad');
  });

  it('shows an empty state when nothing waits', async () => {
    listTrackSubmissions.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    await renderPage();

    expect(document.body.textContent).toContain('Inga låtar väntar på granskning');
  });
});
