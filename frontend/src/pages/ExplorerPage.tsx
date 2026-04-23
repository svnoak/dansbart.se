import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExplorerTrackDto } from '@/api/models/explorerTrackDto';
import { getExplorerTracks } from '@/api/generated/explorer/explorer';
import { ExplorerScatterPlot } from './explorer/ExplorerScatterPlot';
import { ExplorerScatter3D } from './explorer/ExplorerScatter3D';
import { ExplorerParallelCoords } from './explorer/ExplorerParallelCoords';
import { ExplorerFilterSidebar } from './explorer/ExplorerFilterSidebar';
import type { XAxisField, ColorByField } from './explorer/ExplorerFilterSidebar';
import { TrackDetailPanel } from './explorer/TrackDetailPanel';

interface ExplorerFilters {
  meter: string;
  minBpm: number;
  maxBpm: number;
  minAsymmetry: number;
  maxAsymmetry: number;
  showAmbiguous: boolean;
  xAxis: XAxisField;
  yAxis: XAxisField;
  zAxis: XAxisField;
  colorBy: ColorByField;
}

const DEFAULT_FILTERS: ExplorerFilters = {
  meter: '',
  minBpm: 40,
  maxBpm: 300,
  minAsymmetry: 0,
  maxAsymmetry: 0.5,
  showAmbiguous: true,
  xAxis: 'swingRatio',
  yAxis: 'tempoBpm',
  zAxis: 'asymmetryScore',
  colorBy: 'meter',
};

type ViewMode = 'scatter' | '3d' | 'parallel';

export function ExplorerPage() {
  const [filters, setFilters] = useState<ExplorerFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('scatter');
  const [allTracks, setAllTracks] = useState<ExplorerTrackDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<ExplorerTrackDto | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTracks = useCallback(async (f: ExplorerFilters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getExplorerTracks({
        meter: f.meter || undefined,
        minBpm: f.minBpm > 40 ? f.minBpm : undefined,
        maxBpm: f.maxBpm < 300 ? f.maxBpm : undefined,
        minAsymmetry: f.minAsymmetry > 0 ? f.minAsymmetry : undefined,
        maxAsymmetry: f.maxAsymmetry < 0.5 ? f.maxAsymmetry : undefined,
        limit: 500,
      });
      setAllTracks(result.items ?? []);
    } catch (e) {
      setAllTracks([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchTracks(filters), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, fetchTracks]);

  const visibleTracks = filters.showAmbiguous
    ? allTracks
    : allTracks.filter((t) => !t.meterAmbiguous);

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedTrack(allTracks.find((t) => t.id === id) ?? null);
    },
    [allTracks],
  );

  const handleFilterChange = useCallback((patch: Partial<ExplorerFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[rgb(var(--color-text))]">Rytmutforskaren</h1>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Utforska rytmmönster i svensk folkmusik. Välj en punkt för att se detaljer.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[rgb(var(--color-border))] p-1">
          {(['scatter', '3d', 'parallel'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
                  : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
              }`}
            >
              {mode === 'scatter' ? 'Spridningsdiagram' : mode === '3d' ? '3D-diagram' : 'Parallellkoordinater'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <ExplorerFilterSidebar
          filters={filters}
          trackCount={visibleTracks.length}
          onChange={handleFilterChange}
        />

        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="relative min-h-0 flex-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[rgb(var(--color-surface))]/70">
                <span className="text-sm text-[rgb(var(--color-text-muted))]">Laddar...</span>
              </div>
            )}
            {!loading && error ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">API-fel</p>
                <p className="max-w-sm text-xs text-[rgb(var(--color-text-muted))]">{error}</p>
              </div>
            ) : !loading && visibleTracks.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-[rgb(var(--color-text-muted))]">
                <span>Inga låtar matchar filtret.</span>
                <span className="text-xs">
                  Asymmetridata saknas — kör omklassificering i admin-panelen.
                </span>
              </div>
            ) : viewMode === 'scatter' ? (
              <ExplorerScatterPlot
                tracks={visibleTracks}
                selectedId={selectedTrack?.id ?? null}
                xAxis={filters.xAxis}
                yAxis={filters.yAxis}
                colorBy={filters.colorBy}
                onSelect={handleSelect}
              />
            ) : viewMode === '3d' ? (
              <ExplorerScatter3D
                tracks={visibleTracks}
                selectedId={selectedTrack?.id ?? null}
                xAxis={filters.xAxis}
                yAxis={filters.yAxis}
                zAxis={filters.zAxis}
                colorBy={filters.colorBy}
                onSelect={handleSelect}
              />
            ) : (
              <ExplorerParallelCoords
                tracks={visibleTracks}
                selectedId={selectedTrack?.id ?? null}
              />
            )}
          </div>

          {selectedTrack && (
            <TrackDetailPanel track={selectedTrack} onClose={() => setSelectedTrack(null)} />
          )}
        </main>
      </div>
    </div>
  );
}
