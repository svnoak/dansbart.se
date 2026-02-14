import { useMemo } from 'react';
import { Pill, Button } from '@/ui';
import type { SearchFilters, SearchType } from '@/hooks/useSearchParamsState';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';

interface FilterBarProps {
  filters: SearchFilters;
  setFilters: (u: Partial<SearchFilters>) => void;
  searchType: SearchType;
  styleOverview: StyleOverviewDto[] | null;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  hasUnsavedChanges?: boolean;
  onApply?: () => void;
}

const SOURCES: Array<{ value: string; label: string; variant?: 'default' | 'green' | 'red' }> = [
  { value: '', label: 'Alla' },
  { value: 'spotify', label: 'Spotify', variant: 'green' },
  { value: 'youtube', label: 'YouTube', variant: 'red' },
];

const VOCALS = [
  { value: '', label: 'Alla' },
  { value: 'true', label: 'Sång' },
  { value: 'false', label: 'Instru' },
];

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
        aria-label={ariaLabel}
      />
      <div className="h-5 w-9 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-border))]/50 peer-focus-visible:outline peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(var(--color-accent))] peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:border after:border-[rgb(var(--color-border))] after:bg-white after:transition-all peer-checked:bg-[rgb(var(--color-accent))] peer-checked:after:translate-x-4 dark:after:bg-[rgb(var(--color-bg-elevated))]" />
    </label>
  );
}

const TEMPO_CENTER_MIN = 80;
const TEMPO_CENTER_MAX = 140;
const TEMPO_RANGE = 10;

function centerFromFilters(filters: SearchFilters): number {
  const min = filters.minBpm;
  const max = filters.maxBpm;
  if (min != null && max != null) {
    const c = Math.round((min + max) / 2);
    return Math.max(TEMPO_CENTER_MIN, Math.min(TEMPO_CENTER_MAX, c));
  }
  return 100;
}

function TempoSlider({
  filters,
  setFilters,
}: {
  filters: SearchFilters;
  setFilters: (u: Partial<SearchFilters>) => void;
}) {
  const center = centerFromFilters(filters);
  const sliderValue = ((center - TEMPO_CENTER_MIN) / (TEMPO_CENTER_MAX - TEMPO_CENTER_MIN)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value);
    const centerBpm =
      TEMPO_CENTER_MIN + (pct / 100) * (TEMPO_CENTER_MAX - TEMPO_CENTER_MIN);
    const minBpm = Math.round(centerBpm - TEMPO_RANGE);
    const maxBpm = Math.round(centerBpm + TEMPO_RANGE);
    setFilters({ minBpm, maxBpm, offset: 0 });
  };

  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-xs text-[rgb(var(--color-text-muted))] whitespace-nowrap">
        långsam
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={sliderValue}
        onChange={handleChange}
        className="h-2 w-24 min-w-24 accent-[rgb(var(--color-accent))]"
        aria-label="Tempo från långsam till snabb"
      />
      <span className="text-xs text-[rgb(var(--color-text-muted))] whitespace-nowrap">
        snabb
      </span>
    </label>
  );
}

export function FilterBar({
  filters,
  setFilters,
  searchType,
  styleOverview,
  onClearFilters,
  hasActiveFilters,
  hasUnsavedChanges = false,
  onApply,
}: FilterBarProps) {
  const mainStyles = useMemo(() => {
    if (!styleOverview?.length) return [];
    return styleOverview.map((s) => s.style ?? '').filter(Boolean);
  }, [styleOverview]);

  const subStylesForMain = useMemo(() => {
    if (!filters.style || !styleOverview?.length) return [];
    const main = styleOverview.find((s) => (s.style ?? '') === filters.style);
    return main?.subStyles ?? [];
  }, [filters.style, styleOverview]);

  const activeChips = useMemo(() => {
    const list: { key: string; label: string; onClear: () => void }[] = [];
    if (filters.style) {
      list.push({
        key: 'style',
        label: `Kategori: ${filters.style}`,
        onClear: () => setFilters({ style: '', subStyle: '', offset: 0 }),
      });
    }
    if (filters.subStyle) {
      list.push({
        key: 'subStyle',
        label: `Dans: ${filters.subStyle}`,
        onClear: () => setFilters({ subStyle: '', offset: 0 }),
      });
    }
    if (filters.source) {
      list.push({
        key: 'source',
        label: filters.source === 'spotify' ? 'Spotify' : 'YouTube',
        onClear: () => setFilters({ source: '', offset: 0 }),
      });
    }
    if (filters.vocals) {
      list.push({
        key: 'vocals',
        label: filters.vocals === 'true' ? 'Sång' : 'Instrumental',
        onClear: () => setFilters({ vocals: '', offset: 0 }),
      });
    }
    if (filters.confirmed) {
      list.push({
        key: 'confirmed',
        label: 'Bekräftad dansstil',
        onClear: () => setFilters({ confirmed: false, offset: 0 }),
      });
    }
    if (filters.tempoEnabled) {
      const min = filters.minBpm ?? 90;
      const max = filters.maxBpm ?? 110;
      list.push({
        key: 'tempo',
        label: `Tempo: ${min}–${max}`,
        onClear: () =>
          setFilters({
            tempoEnabled: false,
            minBpm: null,
            maxBpm: null,
            offset: 0,
          }),
      });
    }
    return list;
  }, [filters, setFilters]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Källa (Source) - Vue style with label and green/red pills */}
        <div className="flex items-center gap-2" role="group" aria-label="Välj musikkälla">
          <span className="text-sm text-[rgb(var(--color-text-muted))]">Källa:</span>
          {SOURCES.map(({ value, label, variant = 'default' }) => (
            <Pill
              key={value || 'all'}
              active={filters.source === value}
              variant={variant}
              onClick={() => setFilters({ source: value, offset: 0 })}
            >
              {label}
            </Pill>
          ))}
        </div>

        {/* Sång - Vue style segmented control */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[rgb(var(--color-text-muted))]">Sång:</span>
          <div
            className="flex rounded-lg overflow-hidden border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]"
            role="group"
            aria-label="Filtrera på sång eller instrumental"
          >
            {VOCALS.map(({ value, label }) => (
              <button
                key={value || 'all'}
                type="button"
                onClick={() => setFilters({ vocals: value, offset: 0 })}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l first:border-l-0 border-[rgb(var(--color-border))] ${
                  filters.vocals === value
                    ? 'bg-[rgb(var(--color-accent))] text-white'
                    : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/30'
                }`}
                aria-pressed={filters.vocals === value}
              >
                {value === 'false' ? (
                  <span className="inline-flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                      <path d="M10 3.75a2 2 0 10-4 0 2 2 0 004 0z" />
                    </svg>
                    {label}
                  </span>
                ) : (
                  label
                )}
              </button>
            ))}
          </div>
        </div>

        {searchType === 'tracks' && (
          <>
            {/* Kategori & Specifik dans - Vue style with labels above */}
            <div className="flex items-center gap-4">
              <div className="min-w-[140px]">
                <label htmlFor="filter-category" className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1 block">
                  Kategori
                </label>
                <select
                  id="filter-category"
                  value={filters.style}
                  onChange={(e) =>
                    setFilters({ style: e.target.value, subStyle: '', offset: 0 })
                  }
                  className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))]"
                  aria-label="Kategori"
                >
                  <option value="">Alla kategorier</option>
                  {mainStyles.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[140px]">
                <label htmlFor="filter-substyle" className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1 block">
                  Specifik dans
                </label>
                <select
                  id="filter-substyle"
                  value={filters.subStyle}
                  onChange={(e) => setFilters({ subStyle: e.target.value, offset: 0 })}
                  className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))] disabled:opacity-60"
                  aria-label="Specifik dans"
                  disabled={!filters.style}
                >
                  <option value="">{filters.style ? `Alla ${filters.style} varianter` : 'Välj kategori först'}</option>
                  {subStylesForMain.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bekräftad dansstil - Vue style toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[rgb(var(--color-text-muted))]">Bekräftad dansstil:</span>
              <ToggleSwitch
                checked={filters.confirmed}
                onChange={(checked) => setFilters({ confirmed: checked, offset: 0 })}
                ariaLabel="Bekräftad dansstil"
              />
            </div>

            {/* Tempo - Vue style: label + toggle + slider (långsam/snabb) */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[rgb(var(--color-text-muted))]">Tempo:</span>
                <ToggleSwitch
                  checked={filters.tempoEnabled}
                  onChange={(checked) => {
                    if (checked) {
                      const c = 100;
                      setFilters({
                        tempoEnabled: true,
                        minBpm: c - TEMPO_RANGE,
                        maxBpm: c + TEMPO_RANGE,
                        offset: 0,
                      });
                    } else {
                      setFilters({
                        tempoEnabled: false,
                        minBpm: null,
                        maxBpm: null,
                        offset: 0,
                      });
                    }
                  }}
                  ariaLabel="Aktivera tempofilter"
                />
              </div>
              {filters.tempoEnabled && (
                <TempoSlider filters={filters} setFilters={setFilters} />
              )}
            </div>
          </>
        )}
        {hasUnsavedChanges && onApply && (
          <Button variant="primary" onClick={onApply} className="ml-auto">
            Tillämpa filter
          </Button>
        )}
      </div>

      {/* Aktiva filter - Vue style chips + Rensa alla */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgb(var(--color-border))] pt-4">
          <span className="text-xs text-[rgb(var(--color-text-muted))]">Aktiva filter:</span>
          {activeChips.map(({ key, label, onClear }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--color-accent))]/15 px-2 py-1 text-xs text-[rgb(var(--color-accent))]"
            >
              {label}
              <button
                type="button"
                onClick={onClear}
                className="hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] rounded"
                aria-label={`Ta bort ${label}`}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearFilters}
            className="ml-2 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Rensa alla
          </button>
        </div>
      )}
    </div>
  );
}
