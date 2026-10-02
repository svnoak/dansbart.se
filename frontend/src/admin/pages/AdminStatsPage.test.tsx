import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdminStatsPage } from './AdminStatsPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getStats = vi.fn();
const getAdminStats = vi.fn();
const getDashboard = vi.fn();
const getDailyVisits = vi.fn();
const getHourlyVisits = vi.fn();
const getMostPlayedTracks = vi.fn();
const getPlatformStats = vi.fn();
const getListenTime = vi.fn();
const getNudgeStats = vi.fn();
const getClassifyStats = vi.fn();
const getSessionDuration = vi.fn();
const getBehavioralFlags = vi.fn();
const getTopPaths = vi.fn();
const getSearchStats = vi.fn();

vi.mock('@/api/generated/stats/stats', () => ({
  getStats: (...args: unknown[]) => getStats(...args),
}));

vi.mock('@/api/generated/admin-analytics/admin-analytics', () => ({
  getDashboard: (...args: unknown[]) => getDashboard(...args),
  getDailyVisits: (...args: unknown[]) => getDailyVisits(...args),
  getHourlyVisits: (...args: unknown[]) => getHourlyVisits(...args),
  getMostPlayedTracks: (...args: unknown[]) => getMostPlayedTracks(...args),
  getPlatformStats: (...args: unknown[]) => getPlatformStats(...args),
  getListenTime: (...args: unknown[]) => getListenTime(...args),
  getNudgeStats: (...args: unknown[]) => getNudgeStats(...args),
  getClassifyStats: (...args: unknown[]) => getClassifyStats(...args),
  getSessionDuration: (...args: unknown[]) => getSessionDuration(...args),
  getBehavioralFlags: (...args: unknown[]) => getBehavioralFlags(...args),
  getTopPaths: (...args: unknown[]) => getTopPaths(...args),
  getSearchStats: (...args: unknown[]) => getSearchStats(...args),
  getAdminStats: (...args: unknown[]) => getAdminStats(...args),
}));

describe('AdminStatsPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    getStats.mockResolvedValue(null);
    getAdminStats.mockResolvedValue({
      library: {
        totalTracks: 1000,
        analyzed: 950,
        classified: 900,
        pendingAnalysis: 0,
        pendingClassification: 50,
        failedTracks: 0,
        queuedTracks: 0,
        coveragePercent: 95,
      },
      privateTrackCount: 100,
      publicPlayCount: 5000,
      privatePlayCount: 500,
    });
    getDashboard.mockResolvedValue(null);
    getDailyVisits.mockResolvedValue(null);
    getHourlyVisits.mockResolvedValue(null);
    getMostPlayedTracks.mockResolvedValue(null);
    getPlatformStats.mockResolvedValue(null);
    getListenTime.mockResolvedValue(null);
    getNudgeStats.mockResolvedValue(null);
    getClassifyStats.mockResolvedValue(null);
    getSessionDuration.mockResolvedValue(null);
    getBehavioralFlags.mockResolvedValue(null);
    getTopPaths.mockResolvedValue(null);
    getSearchStats.mockResolvedValue(null);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.removeChild(container);
  });

  it('shows the private track count from the admin stats', async () => {
    await act(async () => {
      root.render(
        <BrowserRouter>
          <AdminStatsPage />
        </BrowserRouter>
      );
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(container.textContent).toContain('Privata låtar');
    expect(container.textContent).toContain('100');
  });

  it('shows the plays of public and private tracks', async () => {
    await act(async () => {
      root.render(
        <BrowserRouter>
          <AdminStatsPage />
        </BrowserRouter>
      );
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(container.textContent).toContain('Spelningar av offentliga låtar');
    expect(container.textContent).toContain('Spelningar av privata låtar');
  });
});
