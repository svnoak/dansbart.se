import { useCallback, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ReactNode } from 'react';
import {
  getAdminStats,
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
import { Card, RowSkeleton } from '@/ui';

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
  const [privateTrackCount, setPrivateTrackCount] = useState(0);
  const [libraryUserCount, setLibraryUserCount] = useState(0);
  const [publicPlayCount, setPublicPlayCount] = useState(0);
  const [privatePlayCount, setPrivatePlayCount] = useState(0);
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
      const [adminStatsRes, dashRes, dailyRes, hourlyRes, mostPlayedRes, platformRes, listenRes, nudgeRes, classifyRes, durationRes, flagsRes, pathsRes, searchRes] =
        await Promise.all([
          getAdminStats().catch(() => null),
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

      const adminStats = adminStatsRes as Record<string, unknown> | null;
      setLibraryStats(adminStats?.library as Record<string, unknown> | null);
      setPrivateTrackCount(Number(adminStats?.privateTrackCount ?? 0));
      setLibraryUserCount(Number(adminStats?.libraryUserCount ?? 0));
      setPublicPlayCount(Number(adminStats?.publicPlayCount ?? 0));
      setPrivatePlayCount(Number(adminStats?.privatePlayCount ?? 0));
      setDashboard(dashRes as Record<string, unknown> | null);

      // Daily visits: backend now returns { byDate: [{date, total, loggedIn, anonymous}], days }
      // Fill in missing days so the chart always covers the full selected range.
      const byDateArray =
        ((dailyRes as Record<string, unknown> | null)?.byDate as Record<string, unknown>[] | undefined) ?? [];
      const dateMap = new Map(byDateArray.map((d) => [String(d.date ?? ''), d]));
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
      const byHourArray =
        ((hourlyRes as Record<string, unknown> | null)?.byHour as Record<string, unknown>[] | undefined) ?? [];
      const hourMap = new Map(byHourArray.map((h) => [Number(h.hour), h]));
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
      const tracksData = mostPlayedRes ?? (dashRes as Record<string, unknown> | null)?.mostPlayedTracks ?? [];
      setMostPlayed(
        Array.isArray(tracksData)
          ? tracksData.map((t) => ({
              trackId: String(t.trackId ?? ''),
              title: String(t.title ?? 'Okänd'),
              playCount: Number(t.playCount ?? 0),
              completionRate: Number(t.completionRate ?? 0),
              totalDurationSeconds: Number(t.totalDurationSeconds ?? 0),
            }))
          : [],
      );

      // Platform stats
      const dashPlatformStats = (dashRes as Record<string, unknown> | null)?.platformStats as
        | Record<string, unknown>
        | undefined;
      const platformData =
        (platformRes as Record<string, unknown> | null)?.platforms ?? dashPlatformStats?.platforms ?? [];
      setPlatforms(
        Array.isArray(platformData)
          ? platformData.map((p) => ({
              platform: String(p.platform ?? ''),
              playCount: Number(p.playCount ?? 0),
              totalDuration: Number(p.totalDuration ?? 0),
            }))
          : [],
      );

      setListenTime(listenRes as Record<string, unknown> | null);
      setNudgeEvents(((nudgeRes as Record<string, unknown> | null)?.events as NudgeEvents | undefined) ?? {});
      setClassifyEvents(
        ((classifyRes as Record<string, unknown> | null)?.events as ClassifyEvents | undefined) ?? {},
      );
      setSessionDuration(durationRes as Record<string, unknown> | null);
      const flags = flagsRes as { totals: BehavioralFlags; byDeviceType?: DeviceFeatureRow[] } | null;
      setBehavioralFlags(flags?.totals ? flags : null);
      setTopPaths(Array.isArray(pathsRes) ? (pathsRes as unknown as TopPath[]) : []);
      setSearchStats(searchRes as Record<string, unknown> | null);

      const visitors =
        ((dashRes as Record<string, unknown> | null)?.visitors as Record<string, unknown> | undefined) ?? {};
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
  const dashListenTime = dashboard?.listenTime as Record<string, unknown> | undefined;
  const totalHours = (listenTime?.totalHours as number) ?? (dashListenTime?.totalHours as number) ?? 0;
  const totalMinutesListened =
    (listenTime?.totalMinutes as number) ?? (dashListenTime?.totalMinutes as number) ?? 0;

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


  const periodLabel = days === 1 ? 'senaste 24 timmarna' : `senaste ${days} dagarna`;
  const firstLoad = loading && libraryStats === null && dashboard === null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Statistik
        </h1>
        <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-muted))]">
          Hur biblioteket växer och hur besökarna använder sidan. Perioden gäller alla siffror
          nedan utom bibliotekets totaler.
        </p>
      </div>

      <Card className="flex flex-wrap items-end gap-4 px-4 py-3">
        <div className="flex min-w-55 flex-col gap-1.5">
          <label
            htmlFor="stats-period"
            className="text-sm font-medium text-[rgb(var(--color-text))]"
          >
            Period
          </label>
          <Select
            id="stats-period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="min-h-11"
          >
            <option value={1}>Senaste 24 timmarna</option>
            <option value={7}>Senaste 7 dagarna</option>
            <option value={30}>Senaste 30 dagarna</option>
            <option value={90}>Senaste 90 dagarna</option>
          </Select>
        </div>
      </Card>

      {firstLoad ? (
        <RowSkeleton rows={5} label="Laddar statistik" />
      ) : (
        <div
          aria-busy={loading}
          className={`space-y-8 transition-opacity ${loading ? 'opacity-60' : ''}`}
        >
          <Section title="Bibliotek">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Totalt antal spår" value={totalTracks} />
              <StatCard label="Analyserade" value={analyzedCount} sub={`${coveragePct}%`} />
              <StatCard label="Misslyckade" value={failedTracks} />
              <StatCard label="I kö" value={queuedTracks} />
              <StatCard label="Väntar klassificering" value={pendingClassification} />
              <StatCard label="Spellistor" value={totalPlaylists} />
              <StatCard label="Privata låtar" value={privateTrackCount} />
              <StatCard label="Personer som använder Mina låtar" value={libraryUserCount} />
              <StatCard label="Spelningar av offentliga låtar" value={publicPlayCount} />
              <StatCard label="Spelningar av privata låtar" value={privatePlayCount} />
            </div>
          </Section>

          <Section title="Besökare" aside={periodLabel}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard label="Unika besökare" value={totalVisitors} delta={prevVisitors ? totalVisitors - prevVisitors.totalVisitors : undefined} />
              <StatCard label="Inloggade" value={authenticatedVisitors} delta={prevVisitors ? authenticatedVisitors - prevVisitors.authenticatedVisitors : undefined} />
              <StatCard label="Anonyma" value={anonymousVisitors} delta={prevVisitors ? anonymousVisitors - prevVisitors.anonymousVisitors : undefined} />
              <StatCard label="Mobila besökare" value={mobileVisitors} />
              <StatCard label="Datorbesökare" value={desktopVisitors} />
              <StatCard label="Sidvisningar" value={totalPageViews} delta={prevVisitors ? totalPageViews - prevVisitors.totalPageViews : undefined} />
              <StatCard label="Snitt sessionslängd" value={avgDurationSeconds > 0 ? avgDurationFormatted : '–'} />
              <StatCard label="Registrerade användare" value={totalUsers} />
            </div>
          </Section>

          {/* Visitor chart — hourly when days=1, daily otherwise */}
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">
                {showHourly ? 'Besök per timme' : 'Besök per dag'}
              </h2>
              <ul className="flex items-center gap-4 text-[13px] text-[rgb(var(--color-text-muted))]" aria-label="Serier">
                <li className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-[2px]"
                    style={{ background: SERIES.first }}
                    aria-hidden
                  />
                  Inloggade
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-[2px]"
                    style={{ background: SERIES.second }}
                    aria-hidden
                  />
                  Anonyma
                </li>
              </ul>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                barCategoryGap="25%"
                maxBarSize={24}
              >
                <CartesianGrid vertical={false} stroke={CHART_GRID} strokeWidth={1} />
                <XAxis
                  dataKey="key"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 13, fill: CHART_TEXT }}
                  tickMargin={8}
                  tickFormatter={
                    showHourly
                      ? (v: string) => `${v.padStart(2, '0')}:00`
                      : (v: string) => v.slice(5)
                  }
                  interval={showHourly ? 5 : days <= 7 ? 0 : days <= 30 ? 4 : 14}
                />
                <YAxis
                  width={40}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 13, fill: CHART_TEXT }}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgb(var(--color-accent-muted))', fillOpacity: 0.6 }}
                  content={(props) => (
                    <ChartTooltip
                      active={props.active}
                      payload={props.payload}
                      label={
                        showHourly
                          ? `${String(props.label ?? '').padStart(2, '0')}:00`
                          : String(props.label ?? '')
                      }
                    />
                  )}
                />
                <Bar
                  dataKey="anonymous"
                  name="Anonyma"
                  stackId="a"
                  fill={SERIES.second}
                  stroke={CHART_SURFACE}
                  strokeWidth={1}
                />
                <Bar
                  dataKey="authenticated"
                  name="Inloggade"
                  stackId="a"
                  fill={SERIES.first}
                  stroke={CHART_SURFACE}
                  strokeWidth={1}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Section title="Lyssning" aside={periodLabel}>
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
          </Section>

          {/* Most played tracks */}
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">Mest spelade spår</h2>
              <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{periodLabel}</p>
            </div>
            {mostPlayed.length === 0 ? (
              <p className="text-[15px] text-[rgb(var(--color-text-muted))]">Inga spelningar registrerade ännu.</p>
            ) : (
              <>
                <ol className="space-y-3">
                  {mostPlayed.map((t, i) => (
                    <li key={t.trackId} className="flex items-center gap-3">
                      <span className="w-6 shrink-0 text-right text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] text-[rgb(var(--color-text))]">{t.title}</p>
                        <Meter value={t.completionRate} max={100} label={`Genomföringsgrad ${Math.round(t.completionRate)} %`} />
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[13px] font-medium tabular-nums text-[rgb(var(--color-text))]">{t.playCount} spelningar</p>
                        <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{formatMinutes(t.totalDurationSeconds)} totalt</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-[13px] text-[rgb(var(--color-text-muted))]">Stapeln visar genomföringsgrad.</p>
              </>
            )}
          </Card>

          {/* SmartNudge funnel */}
          {nudgeShown > 0 && (
            <Card className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">Påminnelser om klassificering</h2>
                <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{periodLabel}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Figure value={nudgeShown} label="Visade" />
                <Figure
                  value={nudgeCompleted}
                  label="Slutförda"
                  sub={`${Math.round((nudgeCompleted / nudgeShown) * 100)} %`}
                />
                <Figure
                  value={nudgeDismissed}
                  label="Avvisade"
                  sub={`${Math.round((nudgeDismissed / nudgeShown) * 100)} %`}
                />
              </div>
              <div className="mt-4">
                <Meter
                  value={nudgeCompleted}
                  max={nudgeShown}
                  label={`Andel slutförda ${Math.round((nudgeCompleted / nudgeShown) * 100)} %`}
                  thick
                />
              </div>
            </Card>
          )}

          {/* Behavioral area usage */}
          {totalVisitors > 0 && (
            <Card className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">Funktionsanvändning</h2>
                <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{periodLabel}</p>
              </div>
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
                    <p className="mb-1 text-[13px] text-[rgb(var(--color-text-muted))]">{label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-[rgb(var(--color-text))]">{value}</span>
                      <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                        {Math.round((value / totalVisitors) * 100)} % av besöken
                      </span>
                    </div>
                    <Meter value={value} max={totalVisitors} label={`${label}: ${Math.round((value / totalVisitors) * 100)} % av besöken`} />
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
                const features = [
                  { key: 'usedLibrary', label: 'Bibliotek' },
                  { key: 'usedSearch', label: 'Sök' },
                  { key: 'usedPlaylists', label: 'Spellistor' },
                  { key: 'usedDiscovery', label: 'Klassificering' },
                ] as const;
                return (
                  <div className="mt-5 overflow-x-auto border-t border-[rgb(var(--color-border))] pt-4">
                    <h3 className="mb-2 text-[15px] font-semibold text-[rgb(var(--color-text))]">Per enhet</h3>
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-left text-[rgb(var(--color-text-muted))]">
                          <th className="py-1 pr-3 font-medium">Enhet</th>
                          <th className="py-1 pr-3 font-medium">Sessioner</th>
                          {features.map((f) => (
                            <th key={f.key} className="py-1 pr-3 font-medium">{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ label, row }) => (
                          <tr key={label} className="border-t border-[rgb(var(--color-border))] text-[rgb(var(--color-text))]">
                            <th scope="row" className="py-1.5 pr-3 text-left font-medium">{label}</th>
                            <td className="py-1.5 pr-3 tabular-nums">{row.total}</td>
                            {features.map((f) => (
                              <td key={f.key} className="py-1.5 pr-3 tabular-nums">
                                {row.total > 0 ? Math.round((row[f.key] / row.total) * 100) : 0} %
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </Card>
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
              <Card className="p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">Sökanvändning</h2>
                  <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                    {total.toLocaleString('sv-SE')} sökningar {periodLabel}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-[15px] font-semibold text-[rgb(var(--color-text))]">Filtertyp</h3>
                    <ul className="space-y-2.5">
                      {filters.map(({ label, value }) => (
                        <li key={label} className="flex items-center gap-3">
                          <span className="w-24 shrink-0 text-[13px] text-[rgb(var(--color-text-muted))]">{label}</span>
                          <div className="flex-1">
                            <Meter value={value} max={total} label={`${label}: ${Math.round((value / Math.max(1, total)) * 100)} %`} />
                          </div>
                          <span className="w-20 shrink-0 text-right text-[13px] tabular-nums text-[rgb(var(--color-text))]">
                            {value} ({Math.round((value / Math.max(1, total)) * 100)} %)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {topStyles.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-[15px] font-semibold text-[rgb(var(--color-text))]">Mest sökta stilar</h3>
                      <ul className="space-y-2.5">
                        {topStyles.map(({ style, count }) => (
                          <li key={style} className="flex items-center gap-3">
                            <span className="w-24 shrink-0 truncate text-[13px] text-[rgb(var(--color-text-muted))]">{style}</span>
                            <div className="flex-1">
                              <Meter value={count} max={topStyles[0].count} label={`${style}: ${count} sökningar`} />
                            </div>
                            <span className="w-10 shrink-0 text-right text-[13px] font-medium tabular-nums text-[rgb(var(--color-text))]">{count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            );
          })()}

          {/* Top paths */}
          {topPaths.length > 0 && (
            <Card className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">Mest besökta sidor</h2>
                <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{periodLabel}</p>
              </div>
              <ul className="space-y-2.5">
                {topPaths.map((p) => (
                  <li key={p.path} className="flex items-center gap-3">
                    <code className="min-w-0 flex-1 truncate text-[13px] text-[rgb(var(--color-text-muted))]">{p.path}</code>
                    <div className="w-28 shrink-0 sm:w-40">
                      <Meter value={p.total} max={topPaths[0].total} label={`${p.path}: ${p.total} besök`} />
                    </div>
                    <span className="w-12 shrink-0 text-right text-[13px] font-medium tabular-nums text-[rgb(var(--color-text))]">{p.total}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Classify activity */}
          {classifyStart > 0 && (
            <Card className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">Snabbklassificering</h2>
                <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{periodLabel}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Figure value={classifyStart} label="Sessioner startade" />
                <Figure
                  value={classifyVotes}
                  label="Röster"
                  sub={`${Math.round(classifyVotes / classifyStart)} i snitt per session`}
                />
                <Figure value={classifyAbandon} label="Avbrutna sessioner" />
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* Chart colours come from the design tokens; the two series also differ in lightness. */
const SERIES = {
  first: 'rgb(var(--color-link))',
  second: 'rgb(var(--color-now-playing))',
};
const CHART_GRID = 'rgb(var(--color-border))';
const CHART_TEXT = 'rgb(var(--color-text-muted))';
const CHART_SURFACE = 'rgb(var(--color-bg-elevated))';

interface SectionProps {
  title: string;
  aside?: string;
  children: ReactNode;
}

function Section({ title, aside, children }: SectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">{title}</h2>
        {aside && <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{aside}</p>}
      </div>
      {children}
    </section>
  );
}

interface FigureProps {
  value: number;
  label: string;
  sub?: string;
}

/** One number with its label. Text wears text tokens, never a series colour. */
function Figure({ value, label, sub }: FigureProps) {
  return (
    <div className="text-center">
      <p className="text-2xl font-semibold text-[rgb(var(--color-text))]">{value.toLocaleString('sv-SE')}</p>
      <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
        {label}
        {sub && <span className="ml-1">({sub})</span>}
      </p>
    </div>
  );
}

interface MeterProps {
  value: number;
  max: number;
  label: string;
  thick?: boolean;
}

/** A thin single-series bar. The track is a neutral tint, the fill the first series colour. */
function Meter({ value, max, label, thick = false }: MeterProps) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  return (
    <div
      role="img"
      aria-label={label}
      className={`mt-1 w-full overflow-hidden rounded-full bg-[rgb(var(--color-accent-muted))] ${thick ? 'h-2' : 'h-1.5'}`}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: SERIES.first }}
      />
    </div>
  );
}

interface ChartTooltipEntry {
  name?: unknown;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<ChartTooltipEntry>;
  label: string;
}

/** A floating card: the values lead, the series names follow, keyed by a short line in the series colour. */
function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = [...payload].reverse();
  const total = rows.reduce((sum, r) => sum + Number(r.value ?? 0), 0);
  return (
    <div className="min-w-40 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[13px] text-[rgb(var(--color-text))]">
      <p className="mb-1 font-semibold">{label}</p>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={String(r.dataKey ?? r.name)} className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
            <span className="font-semibold tabular-nums">{Number(r.value ?? 0).toLocaleString('sv-SE')}</span>
            <span className="text-[rgb(var(--color-text-muted))]">{String(r.name ?? '')}</span>
          </li>
        ))}
      </ul>
      {rows.length > 1 && (
        <p className="mt-1 border-t border-[rgb(var(--color-border))] pt-1 text-[rgb(var(--color-text-muted))]">
          Totalt <span className="font-semibold tabular-nums text-[rgb(var(--color-text))]">{total.toLocaleString('sv-SE')}</span>
        </p>
      )}
    </div>
  );
}
