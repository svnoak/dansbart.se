import { useMemo, useState } from 'react';
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
  { value: 'false', label: 'Instrumental' },
];

const DURATION_OPTIONS = [
  { value: '', label: 'Alla' },
  { value: 'short', label: 'Kort (<3 min)' },
  { value: 'medium', label: 'Medel (3-5 min)' },
  { value: 'long', label: 'Lång (>5 min)' },
];

function durationValueFromFilters(filters: SearchFilters): string {
  if (filters.minDuration == null && filters.maxDuration != null && filters.maxDuration <= 180) {
    return 'short';
  }
  if (filters.minDuration === 180 && filters.maxDuration != null && filters.maxDuration <= 300) {
    return 'medium';
  }
  if (filters.minDuration != null && filters.minDuration >= 300 && filters.maxDuration == null) {
    return 'long';
  }
  return '';
}

function durationFiltersFromValue(value: string): Partial<SearchFilters> {
  switch (value) {
    case 'short':
      return { minDuration: null, maxDuration: 180, offset: 0 };
    case 'medium':
      return { minDuration: 180, maxDuration: 300, offset: 0 };
    case 'long':
      return { minDuration: 300, maxDuration: null, offset: 0 };
    default:
      return { minDuration: null, maxDuration: null, offset: 0 };
  }
}

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
  disabled = false,
}: {
  filters: SearchFilters;
  setFilters: (u: Partial<SearchFilters>) => void;
  disabled?: boolean;
}) {
  const center = centerFromFilters(filters);
  const sliderValue = ((center - TEMPO_CENTER_MIN) / (TEMPO_CENTER_MAX - TEMPO_CENTER_MIN)) * 100;
  const minBpm = filters.minBpm ?? center - TEMPO_RANGE;
  const maxBpm = filters.maxBpm ?? center + TEMPO_RANGE;

  // Use the same coordinate system as the slider (80-140 BPM mapped to 0-100%)
  const rangeLeftPct = Math.max(0, ((minBpm - TEMPO_CENTER_MIN) / (TEMPO_CENTER_MAX - TEMPO_CENTER_MIN)) * 100);
  const rangeRightPct = Math.min(100, ((maxBpm - TEMPO_CENTER_MIN) / (TEMPO_CENTER_MAX - TEMPO_CENTER_MIN)) * 100);
  const rangeWidthPct = rangeRightPct - rangeLeftPct;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value);
    const centerBpm =
      TEMPO_CENTER_MIN + (pct / 100) * (TEMPO_CENTER_MAX - TEMPO_CENTER_MIN);
    const newMin = Math.round(centerBpm - TEMPO_RANGE);
    const newMax = Math.round(centerBpm + TEMPO_RANGE);
    setFilters({ minBpm: newMin, maxBpm: newMax, offset: 0 });
  };

  return (
    <div className={`flex items-center gap-3 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <span className="text-xs text-[rgb(var(--color-text-muted))] whitespace-nowrap">{TEMPO_CENTER_MIN - TEMPO_RANGE}</span>
      <div className="relative flex-1 h-2">
        <div className="absolute top-0 w-full h-full bg-[rgb(var(--color-border))]/50 rounded-lg" />
        <div
          className="absolute top-0 h-full bg-[rgb(var(--color-accent))]/30 rounded-lg"
          style={{ left: `${rangeLeftPct}%`, width: `${rangeWidthPct}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={sliderValue}
          onChange={handleChange}
          className="absolute top-0 w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer accent-[rgb(var(--color-accent))]"
          aria-label="Tempo från långsam till snabb"
        />
      </div>
      <span className="text-xs text-[rgb(var(--color-text-muted))] whitespace-nowrap">{TEMPO_CENTER_MAX + TEMPO_RANGE}</span>
      <span className="text-sm text-[rgb(var(--color-text-muted))] whitespace-nowrap tabular-nums">
        {minBpm}-{maxBpm} BPM
      </span>
    </div>
  );
}

function RangeSlider({
  enabled,
  onToggle,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minLabel,
  maxLabel,
  label,
  step,
}: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  minValue: number;
  maxValue: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
  minLabel: string;
  maxLabel: string;
  label: string;
  step: number;
}) {
  return (
    <div className="min-w-[200px]">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-[rgb(var(--color-text-muted))]">{label}</label>
        <ToggleSwitch
          checked={enabled}
          onChange={onToggle}
          ariaLabel={`Aktivera ${label.toLowerCase()}`}
        />
      </div>
      <div className={`flex items-center gap-3 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <span className="text-xs text-[rgb(var(--color-text-muted))] whitespace-nowrap">
          {minLabel}
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={step}
          value={minValue}
          onChange={(e) => {
            const v = Number(e.target.value);
            onMinChange(v);
            if (v > maxValue) onMaxChange(v);
          }}
          className="h-2 flex-1 accent-[rgb(var(--color-accent))]"
          aria-label={`${label} minimum`}
        />
        <span className="text-xs text-[rgb(var(--color-text-muted))] whitespace-nowrap">
          {maxLabel}
        </span>
        <span className="text-sm text-[rgb(var(--color-text-muted))] whitespace-nowrap tabular-nums">
          {minValue.toFixed(1)}-{maxValue.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function ActiveChips({
  chips,
  onClearAll,
}: {
  chips: { key: string; label: string; onClear: () => void }[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[rgb(var(--color-border))] pt-4">
      <span className="text-xs text-[rgb(var(--color-text-muted))]">Aktiva filter:</span>
      {chips.map(({ key, label, onClear }) => (
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
        onClick={onClearAll}
        className="ml-2 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
      >
        Rensa alla
      </button>
    </div>
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(
    filters.bouncinessEnabled || filters.articulationEnabled
  );

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
    const durVal = durationValueFromFilters(filters);
    if (durVal) {
      const durLabel = DURATION_OPTIONS.find((d) => d.value === durVal)?.label ?? durVal;
      list.push({
        key: 'duration',
        label: `Längd: ${durLabel}`,
        onClear: () => setFilters({ minDuration: null, maxDuration: null, offset: 0 }),
      });
    }
    if (filters.bouncinessEnabled) {
      const min = filters.minBounciness ?? 0;
      const max = filters.maxBounciness ?? 1;
      list.push({
        key: 'bounciness',
        label: `Studsighet: ${min.toFixed(1)}–${max.toFixed(1)}`,
        onClear: () =>
          setFilters({
            bouncinessEnabled: false,
            minBounciness: null,
            maxBounciness: null,
            offset: 0,
          }),
      });
    }
    if (filters.articulationEnabled) {
      const min = filters.minArticulation ?? 0;
      const max = filters.maxArticulation ?? 1;
      list.push({
        key: 'articulation',
        label: `Artikulation: ${min.toFixed(1)}–${max.toFixed(1)}`,
        onClear: () =>
          setFilters({
            articulationEnabled: false,
            minArticulation: null,
            maxArticulation: null,
            offset: 0,
          }),
      });
    }
    return list;
  }, [filters, setFilters]);

  const activeFilterCount = activeChips.length;

  // Shared filter controls (used in both mobile and desktop)
  const sourceFilter = (
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
  );

  const vocalsFilter = (
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
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  const mobileTrackFilters = searchType === 'tracks' && (
    <>
      <div className="space-y-4">
        <div>
          <label htmlFor="mobile-filter-category" className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1 block">
            Kategori
          </label>
          <select
            id="mobile-filter-category"
            value={filters.style}
            onChange={(e) =>
              setFilters({ style: e.target.value, subStyle: '', offset: 0 })
            }
            className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2.5 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))]"
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
        <div>
          <label htmlFor="mobile-filter-substyle" className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1 block">
            Specifik dans
          </label>
          <select
            id="mobile-filter-substyle"
            value={filters.subStyle}
            onChange={(e) => setFilters({ subStyle: e.target.value, offset: 0 })}
            className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2.5 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))] disabled:opacity-60"
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
        <div>
          <label htmlFor="mobile-filter-duration" className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1 block">
            Längd
          </label>
          <select
            id="mobile-filter-duration"
            value={durationValueFromFilters(filters)}
            onChange={(e) => setFilters(durationFiltersFromValue(e.target.value))}
            className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2.5 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))]"
            aria-label="Längd"
          >
            {DURATION_OPTIONS.map(({ value, label }) => (
              <option key={value || 'all'} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-[rgb(var(--color-text-muted))]">Tempo</label>
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
          <TempoSlider filters={filters} setFilters={setFilters} disabled={!filters.tempoEnabled} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[rgb(var(--color-text-muted))]">Bekräftad dansstil</span>
        <ToggleSwitch
          checked={filters.confirmed}
          onChange={(checked) => setFilters({ confirmed: checked, offset: 0 })}
          ariaLabel="Bekräftad dansstil"
        />
      </div>
    </>
  );

  const advancedSection = searchType === 'tracks' && (
    <div className="border-t border-[rgb(var(--color-border))] pt-4">
      <button
        type="button"
        onClick={() => setAdvancedOpen(!advancedOpen)}
        className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
        Avancerad sökning
      </button>
      {advancedOpen && (
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-4">
          <RangeSlider
            enabled={filters.bouncinessEnabled}
            onToggle={(enabled) => {
              if (enabled) {
                setFilters({
                  bouncinessEnabled: true,
                  minBounciness: 0,
                  maxBounciness: 1,
                  offset: 0,
                });
              } else {
                setFilters({
                  bouncinessEnabled: false,
                  minBounciness: null,
                  maxBounciness: null,
                  offset: 0,
                });
              }
            }}
            minValue={filters.minBounciness ?? 0}
            maxValue={filters.maxBounciness ?? 1}
            onMinChange={(v) => setFilters({ minBounciness: v, offset: 0 })}
            onMaxChange={(v) => setFilters({ maxBounciness: v, offset: 0 })}
            minLabel="Mjuk"
            maxLabel="Studsig"
            label="Studsighet"
            step={0.1}
          />
          <RangeSlider
            enabled={filters.articulationEnabled}
            onToggle={(enabled) => {
              if (enabled) {
                setFilters({
                  articulationEnabled: true,
                  minArticulation: 0,
                  maxArticulation: 1,
                  offset: 0,
                });
              } else {
                setFilters({
                  articulationEnabled: false,
                  minArticulation: null,
                  maxArticulation: null,
                  offset: 0,
                });
              }
            }}
            minValue={filters.minArticulation ?? 0}
            maxValue={filters.maxArticulation ?? 1}
            onMinChange={(v) => setFilters({ minArticulation: v, offset: 0 })}
            onMaxChange={(v) => setFilters({ maxArticulation: v, offset: 0 })}
            minLabel="Flytande"
            maxLabel="Tydlig"
            label="Artikulation"
            step={0.1}
          />
        </div>
      )}
    </div>
  );

  const applyButton = hasUnsavedChanges && onApply && (
    <Button variant="primary" onClick={onApply} className="w-full md:w-auto">
      Tillämpa filter
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Mobile: toggle button */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex w-full items-center justify-between rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3 text-sm font-medium text-[rgb(var(--color-text))]"
        >
          <span className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
              <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
            </svg>
            Filter
          </span>
          <span className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[rgb(var(--color-accent))] px-1.5 text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            )}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-5 w-5 transition-transform ${mobileOpen ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </span>
        </button>

        {mobileOpen && (
          <div className="mt-2 space-y-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
            {sourceFilter}
            {vocalsFilter}
            {mobileTrackFilters}
            {advancedSection}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="w-full py-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
              >
                Rensa alla filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Desktop: organized rows */}
      <div className="hidden md:block space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          {sourceFilter}
          {vocalsFilter}
          {searchType === 'tracks' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[rgb(var(--color-text-muted))]">Bekräftad dansstil:</span>
              <ToggleSwitch
                checked={filters.confirmed}
                onChange={(checked) => setFilters({ confirmed: checked, offset: 0 })}
                ariaLabel="Bekräftad dansstil"
              />
            </div>
          )}
        </div>
        {searchType === 'tracks' && (
          <div className="flex flex-wrap items-end gap-4">
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
            <div className="min-w-[120px]">
              <label htmlFor="filter-duration" className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1 block">
                Längd
              </label>
              <select
                id="filter-duration"
                value={durationValueFromFilters(filters)}
                onChange={(e) => setFilters(durationFiltersFromValue(e.target.value))}
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))]"
                aria-label="Längd"
              >
                {DURATION_OPTIONS.map(({ value, label }) => (
                  <option key={value || 'all'} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[rgb(var(--color-text-muted))]">Tempo</label>
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
              <TempoSlider filters={filters} setFilters={setFilters} disabled={!filters.tempoEnabled} />
            </div>
          </div>
        )}
        {advancedSection}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <ActiveChips chips={activeChips} onClearAll={onClearFilters} />
      )}

      {/* Apply button on its own row */}
      {applyButton}
    </div>
  );
}
