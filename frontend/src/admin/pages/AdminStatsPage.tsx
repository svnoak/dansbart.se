import { useCallback, useEffect, useState } from 'react';
import { getStats } from '@/api/generated/stats/stats';
import {
  getDashboard,
  getDailyVisits,
  getHourlyVisits,
  getMostPlayedTracks,
  getPlatformStats,
  getListenTime,
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
  const [behavioralFlags, setBehavioralFlags] = useState<{ totals: BehavioralFlags } | null>(null);
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
          fetch(`/api/admin/analytics/nudge?days=${days}`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`/api/admin/analytics/classify?days=${days}`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`/api/admin/analytics/session-duration?days=${days}`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`/api/admin/analytics/behavioral-flags?days=${days}`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`/api/admin/analytics/top-paths?days=${days}&limit=15`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`/api/admin/analytics/search-stats?days=${days}`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
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
      setBehavioralFlags((flagsRes as any)?.totals ? flagsRes : null);
      setTopPaths(Array.isArray(pathsRes) ? pathsRes : []);
      setSearchStats(searchRes as Record<string, unknown> | null);
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

  const maxDaily = Math.max(1, ...daily.map((d) => d.total));
  const maxHourly = Math.max(1, ...hourly.map((h) => h.total));
  const showHourly = days === 1;

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
          <StatCard label="Unika besökare" value={totalVisitors} />
          <StatCard label="Inloggade" value={authenticatedVisitors} />
          <StatCard label="Anonyma" value={anonymousVisitors} />
          <StatCard label="Mobila besökare" value={mobileVisitors} />
          <StatCard label="Datorbesökare" value={desktopVisitors} />
          <StatCard label="Sidvisningar" value={totalPageViews} />
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
              <span className="inline-block h-2 w-3 rounded-sm bg-[rgb(var(--color-accent))]" />
              Autentiserade
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-[rgb(var(--color-accent))]/30" />
              Anonyma
            </span>
          </div>
        </div>

        {showHourly ? (
          <>
            <div className="flex items-end gap-[3px] h-40">
              {hourly.map((h) => (
                <div key={h.hour} className="group relative flex-1 h-full flex items-end">
                  <div
                    className="relative w-full rounded-t overflow-hidden"
                    style={{ height: `${(h.total / maxHourly) * 100}%`, minHeight: h.total > 0 ? '2px' : '0' }}
                  >
                    {/* loggedIn on top, anonymous on bottom — flex-col fills proportionally */}
                    <div className="h-full w-full flex flex-col">
                      <div className="bg-[rgb(var(--color-accent))]" style={{ flex: h.authenticated }} />
                      <div className="bg-[rgb(var(--color-accent))]/30" style={{ flex: h.anonymous }} />
                    </div>
                    {h.total > 0 && (
                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded bg-[rgb(var(--color-bg))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--color-text))] opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow">
                        {String(h.hour).padStart(2, '0')}:00 · {h.total} ({h.authenticated} inloggade / {h.anonymous} anonyma)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-[rgb(var(--color-text-muted))]">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-end gap-[2px] h-40">
              {daily.map((d) => (
                <div key={d.date} className="group relative flex-1 h-full flex items-end">
                  <div
                    className="relative w-full rounded-t overflow-hidden"
                    style={{ height: `${(d.total / maxDaily) * 100}%`, minHeight: d.total > 0 ? '2px' : '0' }}
                  >
                    <div className="h-full w-full flex flex-col">
                      <div className="bg-[rgb(var(--color-accent))]" style={{ flex: d.authenticated }} />
                      <div className="bg-[rgb(var(--color-accent))]/30" style={{ flex: d.anonymous }} />
                    </div>
                    {d.total > 0 && (
                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded bg-[rgb(var(--color-bg))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--color-text))] opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow">
                        {d.date} · {d.total} ({d.authenticated} inloggade / {d.anonymous} anonyma)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-[rgb(var(--color-text-muted))]">
              <span>{daily[0]?.date ?? ''}</span>
              <span>{daily[daily.length - 1]?.date ?? ''}</span>
            </div>
          </>
        )}
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
            Musikdomaren — senaste {days} dagar
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
