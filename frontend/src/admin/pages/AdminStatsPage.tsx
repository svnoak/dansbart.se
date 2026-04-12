import { useCallback, useEffect, useState } from 'react';
import { getStats } from '@/api/generated/stats/stats';
import {
  getDashboard,
  getDailyVisits,
  getHourlyVisits,
} from '@/api/generated/admin-analytics/admin-analytics';
import { StatCard } from '@/admin/components/StatCard';
import { Select } from '@/admin/components/forms/Select';

interface DayData {
  date: string;
  visits: number;
}

interface HourData {
  hour: number;
  visits: number;
}

export function AdminStatsPage() {
  const [days, setDays] = useState(30);
  const [libraryStats, setLibraryStats] = useState<Record<string, unknown> | null>(null);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [daily, setDaily] = useState<DayData[]>([]);
  const [hourly, setHourly] = useState<HourData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, dashRes, dailyRes, hourlyRes] = await Promise.all([
        getStats().catch(() => null),
        getDashboard({ days }).catch(() => null),
        getDailyVisits({ days }).catch(() => null),
        getHourlyVisits({ days }).catch(() => null),
      ]);
      setLibraryStats(statsRes as Record<string, unknown> | null);
      setDashboard(dashRes as Record<string, unknown> | null);
      setDaily(Array.isArray(dailyRes) ? dailyRes as DayData[] : []);
      setHourly(Array.isArray(hourlyRes) ? hourlyRes as HourData[] : []);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalTracks = (libraryStats?.totalTracks as number) ?? 0;
  const coveragePct = (libraryStats?.coveragePercent as number) ?? 0;
  const analyzedCount = Math.round((totalTracks * coveragePct) / 100);
  const pendingCount = (dashboard?.pendingTracks as number) ?? 0;
  const failedCount = (dashboard?.failedTracks as number) ?? 0;
  const totalVisitors = (dashboard?.totalVisitors as number) ?? 0;

  const maxDaily = Math.max(1, ...daily.map((d) => d.visits));
  const maxHourly = Math.max(1, ...hourly.map((h) => h.visits));

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Statistik</h1>
        <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Statistik</h1>
        <Select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-auto"
        >
          <option value={7}>Senaste 7 dagar</option>
          <option value={30}>Senaste 30 dagar</option>
          <option value={90}>Senaste 90 dagar</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Totalt antal spår" value={totalTracks} />
        <StatCard
          label="Analyserade"
          value={analyzedCount}
          sub={`${coveragePct}%`}
        />
        <StatCard label="Väntande" value={pendingCount} />
        <StatCard label="Misslyckade" value={failedCount} />
        <StatCard label="Besökare" value={totalVisitors} sub={`Senaste ${days} dagar`} />
        <StatCard
          label="Spår per dag"
          value={daily.length > 0 ? Math.round(daily.reduce((s, d) => s + d.visits, 0) / daily.length) : 0}
          sub="Genomsnitt"
        />
      </div>

      {/* Daily visits chart */}
      {daily.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
          <h2 className="text-sm font-medium text-[rgb(var(--color-text))]">
            Dagliga besök
          </h2>
          <div className="mt-3 flex items-end gap-[2px] h-40">
            {daily.map((d) => (
              <div
                key={d.date}
                className="flex-1 rounded-t bg-[rgb(var(--color-accent))] opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${(d.visits / maxDaily) * 100}%`, minHeight: d.visits > 0 ? '2px' : '0' }}
                title={`${d.date}: ${d.visits} besök`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[rgb(var(--color-text-muted))]">
            <span>{daily[0]?.date ?? ''}</span>
            <span>{daily[daily.length - 1]?.date ?? ''}</span>
          </div>
        </div>
      )}

      {/* Hourly pattern chart */}
      {hourly.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
          <h2 className="text-sm font-medium text-[rgb(var(--color-text))]">
            Besök per timme
          </h2>
          <div className="mt-3 flex items-end gap-1 h-32">
            {hourly.map((h) => (
              <div
                key={h.hour}
                className="flex-1 rounded-t bg-[rgb(var(--color-accent-muted))] border border-[rgb(var(--color-accent))]/30 hover:bg-[rgb(var(--color-accent))]/40 transition-colors"
                style={{ height: `${(h.visits / maxHourly) * 100}%`, minHeight: h.visits > 0 ? '2px' : '0' }}
                title={`${String(h.hour).padStart(2, '0')}:00 - ${h.visits} besök`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[rgb(var(--color-text-muted))]">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>
      )}
    </div>
  );
}
