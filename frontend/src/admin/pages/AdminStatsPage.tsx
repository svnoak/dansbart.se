import { useCallback, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getStats } from '@/api/generated/stats/stats';
import {
  getDashboard,
  getDailyVisits,
  getHourlyVisits,
  getMostPlayedTracks,
  getPlatformStats,
  getListenTime,
  getNudgeStats,
  getClassifyStats,
  getSessionDuration,
  getBehavioralFlags,
  getTopPaths,
  getSearchStats,
} from '@/api/generated/admin-analytics/admin-analytics';
import { StatCard } from '@/admin/components/StatCard';
import { Select } from '@/admin/components/forms/Select';

interface DayData {
  date: string;
  total: number;
  authenticated: number;
  anonymous: number;
}

interface HourData {
  hour: number;
  total: number;
  authenticated: number;
  anonymous: number;
}

interface BehavioralFlags {
  usedSearch: number;
  usedPlaylists: number;
  usedLibrary: number;
  usedDiscovery: number;
}

interface DeviceFeatureRow {
  deviceType: string | null;
  total: number;
  usedSearch: number;
  usedPlaylists: number;
  usedLibrary: number;
  usedDiscovery: number;
}

interface TopPath {
  path: string;
  total: number;
}

interface MostPlayedTrack {
  trackId: string;
  title: string;
  playCount: number;
  completionRate: number;
  totalDurationSeconds: number;
}

interface PlatformEntry {
  platform: string;
  playCount: number;
  totalDuration: number;
}

interface NudgeEvents {
  nudge_shown?: number;
  nudge_dismissed?: number;
  nudge_completed?: number;
  [key: string]: number | undefined;
}

interface ClassifyEvents {
  classify_start?: number;
  classify_vote?: number;
  classify_abandon?: number;
  [key: string]: number | undefined;
}

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h} h ${rem} min` : `${h} h`;
}

export function AdminStatsPage() {
  const [days, setDays] = useState(30);
  const [libraryStats, setLibraryStats] = useState<Record<string, unknown> | null>(null);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [daily, setDaily] = useState<DayData[]>([]);
  const [hourly, setHourly] = useState<HourData[]>([]);
  const [mostPlayed, setMostPlayed] = useState<MostPlayedTrack[]>([]);
  const [platforms, setPlatforms] = useState<PlatformEntry[]>([]);
  const [listenTime, setListenTime] = useState<Record<string, unknown> | null>(null);
  const [nudgeEvents, setNudgeEvents] = useState<NudgeEvents>({});
  const [classifyEvents, setClassifyEvents] = useState<ClassifyEvents>({});
  const [sessionDuration, setSessionDuration] = useState<Record<string, unknown> | null>(null);
  const [behavioralFlags, setBehavioralFlags] = useState<{ totals: BehavioralFlags; byDeviceType?: DeviceFeatureRow[] } | null>(null);
  const [prevVisitors, setPrevVisitors] = useState<{ totalVisitors: number; totalPageViews: number; authenticatedVisitors: number; anonymousVisitors: number } | null>(null);
  const [topPaths, setTopPaths] = useState<TopPath[]>([]);
  const [searchStats, setSearchStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, dashRes, dailyRes, hourlyRes, mostPlayedRes, platformRes, listenRes, nudgeRes, classifyRes, durationRes, flagsRes, pathsRes, searchRes] =
        await Promise.all([
          getStats().catch(() => null),
          getDashboard({ days }).catch(() => null),
          getDailyVisits({ days }).catch(() => null),
          getHourlyVisits({ days }).catch(() => null),
          getMostPlayedTracks({ days, limit: 10 }).catch(() => null),
          getPlatformStats({ days }).catch(() => null),
          getListenTime({ days }).catch(() => null),
          getNudgeStats({ days }).catch(() => null),
          getClassifyStats({ days }).catch(() => null),
          getSessionDuration({ days }).catch(() => null),
          getBehavioralFlags({ days }).catch(() => null),
          getTopPaths({ days, limit: 15 }).catch(() => null),
          getSearchStats({ days }).catch(() => null),
        ]);

      setLibraryStats(statsRes as Record<string, unknown> | null);
      setDashboard(dashRes as Record<string, unknown> | null);

      // Daily visits: backend now returns { byDate: [{date, total, loggedIn, anonymous}], days }
      // Fill in missing days so the chart always covers the full selected range.
      const byDateArray: any[] = (dailyRes as any)?.byDate ?? [];
      const dateMap = new Map(byDateArray.map((d: any) => [String(d.date ?? ''), d]));
      const dailyFilled: DayData[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const entry = dateMap.get(key);
        dailyFilled.push({
          date: key,
          total: entry ? Number(entry.total ?? 0) : 0,
          authenticated: entry ? Number(entry.authenticated ?? 0) : 0,
          anonymous: entry ? Number(entry.anonymous ?? 0) : 0,
        });
      }
      setDaily(dailyFilled);

      // Hourly visits: backend now returns { byHour: [{hour, total, loggedIn, anonymous}], days }
      // Always show all 24 hours.
      const byHourArray: any[] = (hourlyRes as any)?.byHour ?? [];
      const hourMap = new Map(byHourArray.map((h: any) => [Number(h.hour), h]));
      setHourly(
        Array.from({ length: 24 }, (_, h) => {
          const entry = hourMap.get(h);
          return {
            hour: h,
            total: entry ? Number(entry.total ?? 0) : 0,
            authenticated: entry ? Number(entry.authenticated ?? 0) : 0,
            anonymous: entry ? Number(entry.anonymous ?? 0) : 0,
          };
        }),
      );

      // Most played tracks
      const tracksData = mostPlayedRes ?? (dashRes as any)?.mostPlayedTracks ?? [];
      setMostPlayed(
        Array.isArray(tracksData)
          ? tracksData.map((t: any) => ({
              trackId: String(t.trackId ?? ''),
              title: String(t.title ?? 'Okänd'),
              playCount: Number(t.playCount ?? 0),
              completionRate: Number(t.completionRate ?? 0),
              totalDurationSeconds: Number(t.totalDurationSeconds ?? 0),
            }))
          : [],
      );

      // Platform stats
      const platformData = (platformRes as any)?.platforms ?? (dashRes as any)?.platformStats?.platforms ?? [];
      setPlatforms(
        Array.isArray(platformData)
          ? platformData.map((p: any) => ({
              platform: String(p.platform ?? ''),
              playCount: Number(p.playCount ?? 0),
              totalDuration: Number(p.totalDuration ?? 0),
            }))
          : [],
      );

      setListenTime(listenRes as Record<string, unknown> | null);
      setNudgeEvents((nudgeRes as any)?.events ?? {});
      setClassifyEvents((classifyRes as any)?.events ?? {});
      setSessionDuration(durationRes as Record<string, unknown> | null);
      setBehavioralFlags((flagsRes as any)?.totals ? (flagsRes as any) : null);
      setTopPaths(Array.isArray(pathsRes) ? (pathsRes as any[]) : []);
      setSearchStats(searchRes as Record<string, unknown> | null);

      const visitors = (dashRes as any)?.visitors ?? {};
      if (visitors.prevTotalVisitors !== undefined) {
        setPrevVisitors({
          totalVisitors: Number(visitors.prevTotalVisitors ?? 0),
          totalPageViews: Number(visitors.prevTotalPageViews ?? 0),
          authenticatedVisitors: Number(visitors.prevAuthenticatedVisitors ?? 0),
          anonymousVisitors: Number(visitors.prevAnonymousVisitors ?? 0),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Library stats
  const totalTracks = (libraryStats?.totalTracks as number) ?? 0;
  const coveragePct = (libraryStats?.coveragePercent as number) ?? 0;
  const analyzedCount = (libraryStats?.analyzed as number) ?? Math.round((totalTracks * coveragePct) / 100);
  const pendingClassification = (libraryStats?.pendingClassification as number) ?? 0;
  const failedTracks = (libraryStats?.failedTracks as number) ?? 0;
  const queuedTracks = (libraryStats?.queuedTracks as number) ?? 0;

  // Visitor stats — nested under dashboard.visitors
  const visitors = (dashboard?.visitors as Record<string, unknown>) ?? {};
  const totalVisitors = (visitors.totalVisitors as number) ?? 0;
  const authenticatedVisitors = (visitors.authenticatedVisitors as number) ?? 0;
  const anonymousVisitors = (visitors.anonymousVisitors as number) ?? 0;
  const totalPageViews = (visitors.totalPageViews as number) ?? 0;

  // User and playlist counts from dashboard
  const mobileVisitors = (visitors.mobileVisitors as number) ?? 0;
  const desktopVisitors = (visitors.desktopVisitors as number) ?? 0;

  const avgDurationSeconds = (sessionDuration?.avgDurationSeconds as number) ?? 0;
  const avgDurationFormatted = avgDurationSeconds >= 60
    ? `${Math.floor(avgDurationSeconds / 60)} min`
    : `${avgDurationSeconds} sek`;

  const behavioralTotals = behavioralFlags?.totals ?? { usedSearch: 0, usedPlaylists: 0, usedLibrary: 0, usedDiscovery: 0 };

  // User and playlist counts from dashboard
  const totalUsers = (dashboard?.totalUsers as number) ?? 0;
  const totalPlaylists = (dashboard?.totalPlaylists as number) ?? 0;

  // Listen time
  const totalHours = (listenTime?.totalHours as number) ?? (dashboard as any)?.listenTime?.totalHours ?? 0;
  const totalMinutesListened = (listenTime?.totalMinutes as number) ?? (dashboard as any)?.listenTime?.totalMinutes ?? 0;

  const showHourly = days === 1;

  const chartData = showHourly
    ? hourly.map((h) => ({ key: String(h.hour), authenticated: h.authenticated, anonymous: h.anonymous }))
    : daily.map((d) => ({ key: d.date, authenticated: d.authenticated, anonymous: d.anonymous }));

  // SmartNudge funnel
  const nudgeShown = nudgeEvents.nudge_shown ?? 0;
  const nudgeDismissed = nudgeEvents.nudge_dismissed ?? 0;
  const nudgeCompleted = nudgeEvents.nudge_completed ?? 0;

  // Classify stats
  const classifyStart = classifyEvents.classify_start ?? 0;
  const classifyVotes = classifyEvents.classify_vote ?? 0;
  const classifyAbandon = classifyEvents.classify_abandon ?? 0;

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
          <option value={1}>Senaste 24 timmar</option>
          <option value={7}>Senaste 7 dagar</option>
          <option value={30}>Senaste 30 dagar</option>
          <option value={90}>Senaste 90 dagar</option>
        </Select>
      </div>

      {/* Library stats */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-[rgb(var(--color-text-muted))]">Bibliotek</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Totalt antal spår" value={totalTracks} />
          <StatCard label="Analyserade" value={analyzedCount} sub={`${coveragePct}%`} />
          <StatCard label="Misslyckade" value={failedTracks} />
          <StatCard label="I kö" value={queuedTracks} />
          <StatCard label="Väntar klassificering" value={pendingClassification} />
          <StatCard label="Spellistor" value={totalPlaylists} />
        </div>
      </div>

      {/* Visitor stats */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-[rgb(var(--color-text-muted))]">Besökare — senaste {days} dagar</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <StatCard label="Unika besökare" value={totalVisitors} delta={prevVisitors ? totalVisitors - prevVisitors.totalVisitors : undefined} />
          <StatCard label="Inloggade" value={authenticatedVisitors} delta={prevVisitors ? authenticatedVisitors - prevVisitors.authenticatedVisitors : undefined} />
          <StatCard label="Anonyma" value={anonymousVisitors} delta={prevVisitors ? anonymousVisitors - prevVisitors.anonymousVisitors : undefined} />
          <StatCard label="Mobila besökare" value={mobileVisitors} />
          <StatCard label="Datorbesökare" value={desktopVisitors} />
          <StatCard label="Sidvisningar" value={totalPageViews} delta={prevVisitors ? totalPageViews - prevVisitors.totalPageViews : undefined} />
          <StatCard label="Snitt sessionslängd" value={avgDurationSeconds > 0 ? avgDurationFormatted : '–'} />
          <StatCard label="Registrerade användare" value={totalUsers} />
        </div>
      </div>

      {/* Listen time */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-[rgb(var(--color-text-muted))]">Lyssning — senaste {days} dagar</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total lyssnad tid"
            value={totalHours > 0 ? `${totalHours} h` : totalMinutesListened > 0 ? `${totalMinutesListened} min` : '0 min'}
          />
          {platforms.map((p) => (
            <StatCard
              key={p.platform}
              label={p.platform === 'youtube' ? 'YouTube-spelningar' : p.platform === 'spotify' ? 'Spotify-spelningar' : `${p.platform}-spelningar`}
              value={p.playCount}
              sub={formatMinutes(p.totalDuration)}
            />
          ))}
        </div>
      </div>

      {/* Most played tracks */}
      <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
        <h2 className="mb-3 text-sm font-medium text-[rgb(var(--color-text))]">
          Mest spelade spår — senaste {days} dagar
        </h2>
        {mostPlayed.length === 0 ? (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">Inga spelningar registrerade ännu.</p>
        ) : (
          <>
            <div className="space-y-2">
              {mostPlayed.map((t, i) => (
                <div key={t.trackId} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-right text-xs text-[rgb(var(--color-text-muted))]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[rgb(var(--color-text))]">{t.title}</p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--color-border))]">
                      <div
                        className="h-full rounded-full bg-[rgb(var(--color-accent))]"
                        style={{ width: `${Math.min(100, t.completionRate)}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium text-[rgb(var(--color-text))]">{t.playCount} spelningar</p>
                    <p className="text-[10px] text-[rgb(var(--color-text-muted))]">{formatMinutes(t.totalDurationSeconds)} totalt</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-[rgb(var(--color-text-muted))]">Stapeln visar genomföringsgrad</p>
          </>
        )}
      </div>

      {/* Visitor chart — hourly when days=1, daily otherwise */}
      <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[rgb(var(--color-text))]">
            {showHourly ? 'Besök per timme' : 'Dagliga besök'}
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-[rgb(var(--color-text-muted))]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: 'rgb(var(--color-accent))' }} />
              Autentiserade
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: 'rgb(var(--color-accent))', opacity: 0.3 }} />
              Anonyma
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 4, left: 0 }}
            barCategoryGap="20%"
          >
            <XAxis
              dataKey="key"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }}
              tickFormatter={
                showHourly
                  ? (v: string) => `${v.padStart(2, '0')}:00`
                  : (v: string) => v.slice(5)
              }
              interval={showHourly ? 5 : days <= 7 ? 0 : days <= 30 ? 4 : 14}
            />
            <YAxis
              width={32}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: 'rgb(var(--color-bg))',
                border: '1px solid rgb(var(--color-border))',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'rgb(var(--color-text))',
              }}
              cursor={{ fill: 'rgb(var(--color-border))', opacity: 0.5 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(label: any) =>
                showHourly ? `${String(label).padStart(2, '0')}:00` : String(label)
              }
            />
            <Bar dataKey="anonymous" name="Anonyma" stackId="a" fill="rgb(var(--color-accent))" fillOpacity={0.3} />
            <Bar dataKey="authenticated" name="Autentiserade" stackId="a" fill="rgb(var(--color-accent))" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* SmartNudge funnel */}
      {nudgeShown > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
          <h2 className="mb-3 text-sm font-medium text-[rgb(var(--color-text))]">
            SmartNudge — senaste {days} dagar
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[rgb(var(--color-text))]">{nudgeShown}</p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">Visade</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{nudgeCompleted}</p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Slutförda
                {nudgeShown > 0 && (
                  <span className="ml-1">({Math.round((nudgeCompleted / nudgeShown) * 100)}%)</span>
                )}
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[rgb(var(--color-text-muted))]">{nudgeDismissed}</p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Avvisade
                {nudgeShown > 0 && (
                  <span className="ml-1">({Math.round((nudgeDismissed / nudgeShown) * 100)}%)</span>
                )}
              </p>
            </div>
          </div>
          {nudgeShown > 0 && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--color-border))]">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${Math.min(100, (nudgeCompleted / nudgeShown) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Behavioral area usage */}
      {totalVisitors > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
          <h2 className="mb-3 text-sm font-medium text-[rgb(var(--color-text))]">
            Funktionsanvändning — senaste {days} dagar
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                { label: 'Bibliotek', value: behavioralTotals.usedLibrary },
                { label: 'Sök', value: behavioralTotals.usedSearch },
                { label: 'Spellistor', value: behavioralTotals.usedPlaylists },
                { label: 'Klassificering', value: behavioralTotals.usedDiscovery },
              ] as const
            ).map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-1">{label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-[rgb(var(--color-text))]">{value}</span>
                  {totalVisitors > 0 && (
                    <span className="text-xs text-[rgb(var(--color-text-muted))]">
                      {Math.round((value / totalVisitors) * 100)}% av besök
                    </span>
                  )}
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--color-border))]">
                  <div
                    className="h-full rounded-full bg-[rgb(var(--color-accent))]"
                    style={{ width: `${Math.min(100, (value / Math.max(1, totalVisitors)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {(() => {
            const byDevice = behavioralFlags?.byDeviceType ?? [];
            const mobile = byDevice.find((r) => r.deviceType === 'mobile');
            const desktop = byDevice.find((r) => r.deviceType === 'desktop');
            if (!mobile && !desktop) return null;
            const rows = [
              { label: 'Mobil', row: mobile },
              { label: 'Dator', row: desktop },
            ].filter((r): r is { label: string; row: DeviceFeatureRow } => r.row !== undefined);
            return (
              <div className="mt-4 border-t border-[rgb(var(--color-border))] pt-3">
                <p className="mb-2 text-xs font-medium text-[rgb(var(--color-text-muted))]">Per enhet</p>
                <div className="space-y-2">
                  {rows.map(({ label, row }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-xs text-[rgb(var(--color-text-muted))]">{label}</span>
                      <span className="w-12 shrink-0 text-xs text-[rgb(var(--color-text))]">{row.total} sessioner</span>
                      {([
                        { key: 'usedLibrary', label: 'Bibliotek' },
                        { key: 'usedSearch', label: 'Sök' },
                        { key: 'usedPlaylists', label: 'Spellistor' },
                        { key: 'usedDiscovery', label: 'Klassificering' },
                      ] as const).map(({ key, label: feat }) => (
                        <span key={key} className="text-xs text-[rgb(var(--color-text-muted))]">
                          {feat} {row.total > 0 ? Math.round((row[key] / row.total) * 100) : 0}%
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Search stats */}
      {(() => {
        const sf = (searchStats?.filters as Record<string, number>) ?? {};
        const total = sf.total ?? 0;
        const topStyles = (searchStats?.topStyles as { style: string; count: number }[]) ?? [];
        if (total === 0) return null;
        const filters = [
          { label: 'Textfråga',      value: sf.withQuery ?? 0 },
          { label: 'Dansstil',       value: sf.withStyle ?? 0 },
          { label: 'Tempo',          value: sf.withTempo ?? 0 },
          { label: 'Längd',          value: sf.withDuration ?? 0 },
          { label: 'Studsfull',      value: sf.withBounciness ?? 0 },
          { label: 'Artikulation',   value: sf.withArticulation ?? 0 },
        ];
        return (
          <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-medium text-[rgb(var(--color-text))]">
                Sökanvändning — senaste {days} dagar
              </h2>
              <span className="text-xs text-[rgb(var(--color-text-muted))]">{total} sökningar</span>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-2">Filtertyp</p>
                <div className="space-y-2">
                  {filters.map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-xs text-[rgb(var(--color-text-muted))]">{label}</span>
                      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--color-border))]">
                        <div
                          className="h-full rounded-full bg-[rgb(var(--color-accent))]/70"
                          style={{ width: `${Math.min(100, (value / Math.max(1, total)) * 100)}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs text-[rgb(var(--color-text))]">
                        {value} ({Math.round((value / Math.max(1, total)) * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {topStyles.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-2">Mest sökta stilar</p>
                  <div className="space-y-2">
                    {topStyles.map(({ style, count }) => (
                      <div key={style} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate text-xs text-[rgb(var(--color-text-muted))]">{style}</span>
                        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--color-border))]">
                          <div
                            className="h-full rounded-full bg-[rgb(var(--color-accent))]"
                            style={{ width: `${Math.min(100, (count / Math.max(1, topStyles[0].count)) * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-medium text-[rgb(var(--color-text))]">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Top paths */}
      {topPaths.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
          <h2 className="mb-3 text-sm font-medium text-[rgb(var(--color-text))]">
            Mest besökta sidor — senaste {days} dagar
          </h2>
          <div className="space-y-2">
            {topPaths.map((p) => (
              <div key={p.path} className="flex items-center gap-3">
                <code className="min-w-0 flex-1 truncate text-xs text-[rgb(var(--color-text-muted))]">{p.path}</code>
                <div className="w-24 shrink-0">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--color-border))]">
                    <div
                      className="h-full rounded-full bg-[rgb(var(--color-accent))]/60"
                      style={{ width: `${Math.min(100, (p.total / Math.max(1, topPaths[0].total)) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 shrink-0 text-right text-xs font-medium text-[rgb(var(--color-text))]">{p.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classify activity */}
      {classifyStart > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
          <h2 className="mb-3 text-sm font-medium text-[rgb(var(--color-text))]">
            Snabbklassificering — senaste {days} dagar
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[rgb(var(--color-text))]">{classifyStart}</p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">Sessioner startade</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[rgb(var(--color-accent))]">{classifyVotes}</p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Röster
                {classifyStart > 0 && (
                  <span className="ml-1">({Math.round(classifyVotes / classifyStart)} snitt/session)</span>
                )}
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[rgb(var(--color-text-muted))]">{classifyAbandon}</p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">Avbrutna sessioner</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
