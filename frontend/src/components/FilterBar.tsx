import { useEffect, useId, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Button, Pill } from '@/ui';
import { CheckIcon, ChevronDownIcon, CloseIcon, SpotifyIcon, YouTubeIcon } from '@/icons';
import { useTheme } from '@/theme/useTheme';
import { getStyleColor } from '@/styles/danceStyleColors';
import type { SearchFilters, SearchType } from '@/hooks/useSearchParamsState';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';
import {
  DURATION_OPTIONS,
  TEMPO_PRESETS,
  advancedFilterCount,
  durationFiltersFromValue,
  durationValueFromFilters,
  formatDecimal,
  tempoFiltersFromKey,
  tempoSegmentValue,
} from '@/utils/searchFilters';

interface FilterBarProps {
  filters: SearchFilters;
  setFilters: (u: Partial<SearchFilters>) => void;
  searchType: SearchType;
  styleOverview: StyleOverviewDto[] | null;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  /** The result count in words, for the button that closes the filter sheet on a phone. */
  resultsLabel?: string;
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Accessible name with a verb. Must contain the visible label. */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T | string;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** Fill the row on a phone, with segments of equal width. */
  stretch?: boolean;
  className?: string;
}

/**
 * One choice out of a few: a group of aria-pressed buttons in a bordered
 * container. The active segment is ink, the others plain. It wraps when the
 * row is narrow, so there is no separate phone markup.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'sm',
  stretch = false,
  className = '',
}: SegmentedControlProps<T>) {
  const sizeClass = size === 'md' ? 'min-h-10 px-4 text-sm' : 'min-h-8 px-3 text-sm';
  return (
    <div
      role="group"
      aria-label={label}
      className={`${stretch ? 'flex md:inline-flex' : 'inline-flex'} flex-wrap gap-1 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] p-1 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center justify-center rounded-[var(--radius)] font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] ${sizeClass} ${
              stretch ? 'flex-1 md:flex-none' : ''
            } ${
              active
                ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))]'
                : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filter vocabularies                                                 */
/* ------------------------------------------------------------------ */

const SOURCES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Alla' },
  { value: 'spotify', label: 'Spotify' },
  { value: 'youtube', label: 'YouTube' },
];

const VOCALS: SegmentOption<string>[] = [
  { value: '', label: 'Alla', ariaLabel: 'Visa alla, med och utan sång' },
  { value: 'true', label: 'Sång', ariaLabel: 'Visa låtar med sång' },
  { value: 'false', label: 'Instrumental', ariaLabel: 'Visa instrumental musik' },
];

/* ------------------------------------------------------------------ */
/* Small controls                                                      */
/* ------------------------------------------------------------------ */

const CHIP_BASE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-full)] px-3.5 py-1.5 min-h-9 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';
const CHIP_INACTIVE =
  'border border-[rgb(var(--color-border))] bg-transparent text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]';

function StyleChip({
  style,
  active,
  onClick,
}: {
  style: string;
  active: boolean;
  onClick: () => void;
}) {
  const { theme } = useTheme();
  const color = getStyleColor(style);
  const isDark = theme === 'dark';
  const activeStyle: CSSProperties = {
    backgroundColor: isDark ? color.bgDark : color.bg,
    color: isDark ? color.textDark : color.text,
  };
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Visa ${style}`}
      onClick={onClick}
      className={`${CHIP_BASE} ${active ? 'font-semibold' : CHIP_INACTIVE}`}
      style={active ? activeStyle : undefined}
    >
      {style}
      {active && <CheckIcon className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

function SubStyleChip({
  label,
  ariaLabel,
  active,
  color,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  const activeStyle: CSSProperties = { borderColor: color, color };
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`${CHIP_BASE} border bg-transparent ${
        active
          ? 'font-semibold'
          : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
      }`}
      style={active ? activeStyle : undefined}
    >
      {label}
      {active && <CheckIcon className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

function EnableCheckbox({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: string;
}) {
  return (
    <label htmlFor={id} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[rgb(var(--color-text))]">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded-[4px] accent-[rgb(var(--color-accent))]"
      />
      {children}
    </label>
  );
}

const FIELD_LABEL = 'block text-[13px] font-medium text-[rgb(var(--color-text-muted))]';

/* ------------------------------------------------------------------ */
/* Exact tempo slider                                                  */
/* ------------------------------------------------------------------ */

const TEMPO_CENTER_MIN = 80;
const TEMPO_CENTER_MAX = 140;
const TEMPO_RANGE = 10;
const TEMPO_DEFAULT_CENTER = 120;

function centerFromFilters(filters: SearchFilters): number {
  const min = filters.minBpm;
  const max = filters.maxBpm;
  if (min != null && max != null) {
    const c = Math.round((min + max) / 2);
    return Math.max(TEMPO_CENTER_MIN, Math.min(TEMPO_CENTER_MAX, c));
  }
  if (min != null) return Math.min(TEMPO_CENTER_MAX, min + TEMPO_RANGE);
  if (max != null) return Math.max(TEMPO_CENTER_MIN, max - TEMPO_RANGE);
  return TEMPO_DEFAULT_CENTER;
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

  const rangeLeftPct = Math.max(0, ((minBpm - TEMPO_CENTER_MIN) / (TEMPO_CENTER_MAX - TEMPO_CENTER_MIN)) * 100);
  const rangeRightPct = Math.min(100, ((maxBpm - TEMPO_CENTER_MIN) / (TEMPO_CENTER_MAX - TEMPO_CENTER_MIN)) * 100);
  const rangeWidthPct = Math.max(0, rangeRightPct - rangeLeftPct);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value);
    const centerBpm = TEMPO_CENTER_MIN + (pct / 100) * (TEMPO_CENTER_MAX - TEMPO_CENTER_MIN);
    setFilters({
      tempoEnabled: true,
      minBpm: Math.round(centerBpm - TEMPO_RANGE),
      maxBpm: Math.round(centerBpm + TEMPO_RANGE),
      offset: 0,
    });
  };

  return (
    <div className={`flex items-center gap-3 ${disabled ? 'opacity-40' : ''}`}>
      <span className="whitespace-nowrap text-[13px] text-[rgb(var(--color-text-muted))]">
        {TEMPO_CENTER_MIN - TEMPO_RANGE}
      </span>
      <div className="relative h-11 flex-1">
        <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-[rgb(var(--color-accent-muted))]" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[rgb(var(--color-accent))]/30"
          style={{ left: `${rangeLeftPct}%`, width: `${rangeWidthPct}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={sliderValue}
          disabled={disabled}
          onChange={handleChange}
          className="absolute top-0 h-11 w-full cursor-pointer appearance-none bg-transparent accent-[rgb(var(--color-accent))] disabled:cursor-default"
          aria-label="Välj tempo i BPM"
          aria-valuetext={`${minBpm} till ${maxBpm} BPM`}
        />
      </div>
      <span className="whitespace-nowrap text-[13px] text-[rgb(var(--color-text-muted))]">
        {TEMPO_CENTER_MAX + TEMPO_RANGE}
      </span>
      <span className="w-24 whitespace-nowrap text-right text-sm tabular-nums text-[rgb(var(--color-text))]">
        {minBpm}–{maxBpm} BPM
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Range slider (studsighet, artikulation)                             */
/* ------------------------------------------------------------------ */

function RangeSlider({
  id,
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
  id: string;
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
    <div>
      <EnableCheckbox id={id} checked={enabled} onChange={onToggle}>
        {`Filtrera på ${label.toLowerCase()}`}
      </EnableCheckbox>
      <div className={`flex items-center gap-3 ${!enabled ? 'opacity-40' : ''}`}>
        <span className="whitespace-nowrap text-[13px] text-[rgb(var(--color-text-muted))]">{minLabel}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={step}
          value={minValue}
          disabled={!enabled}
          onChange={(e) => {
            const v = Number(e.target.value);
            onMinChange(v);
            if (v > maxValue) onMaxChange(v);
          }}
          className="h-11 min-w-0 flex-1 accent-[rgb(var(--color-accent))]"
          aria-label={`Välj minsta ${label.toLowerCase()}`}
        />
        <input
          type="range"
          min={0}
          max={1}
          step={step}
          value={maxValue}
          disabled={!enabled}
          onChange={(e) => {
            const v = Number(e.target.value);
            onMaxChange(v);
            if (v < minValue) onMinChange(v);
          }}
          className="h-11 min-w-0 flex-1 accent-[rgb(var(--color-accent))]"
          aria-label={`Välj största ${label.toLowerCase()}`}
        />
        <span className="whitespace-nowrap text-[13px] text-[rgb(var(--color-text-muted))]">{maxLabel}</span>
        <span className="w-16 whitespace-nowrap text-right text-sm tabular-nums text-[rgb(var(--color-text))]">
          {formatDecimal(minValue)}–{formatDecimal(maxValue)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FilterBar                                                           */
/* ------------------------------------------------------------------ */

const WIDE_SCREEN = '(min-width: 768px)';

/** True from the `md` breakpoint up, and where the width is unknown. */
function isWideScreen(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia(WIDE_SCREEN).matches;
}

/**
 * The filters for tracks. Dance style is a row of chips, tempo a select and
 * "Bara bekräftade" a toggle; all three act at once. The rarer filters sit
 * behind "Fler filter": a sheet from the bottom on a phone, a drawer in the
 * card on a wide screen.
 */
export function FilterBar({
  filters,
  setFilters,
  searchType,
  styleOverview,
  onClearFilters,
  hasActiveFilters,
  resultsLabel,
}: FilterBarProps) {
  const ids = useId();
  const drawerId = `${ids}-fler-filter`;
  const { theme } = useTheme();
  const advancedCount = advancedFilterCount(filters);
  // A sheet that covers the results does not open by itself.
  const [moreOpen, setMoreOpen] = useState(() => advancedCount > 0 && isWideScreen());

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isWideScreen()) setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const mainStyles = useMemo(() => {
    if (!styleOverview?.length) return [];
    return styleOverview.map((s) => s.style ?? '').filter(Boolean);
  }, [styleOverview]);

  const subStylesForMain = useMemo(() => {
    if (!filters.style || !styleOverview?.length) return [];
    const main = styleOverview.find((s) => (s.style ?? '') === filters.style);
    return main?.subStyles ?? [];
  }, [filters.style, styleOverview]);

  if (searchType !== 'tracks') return null;

  const styleColor = getStyleColor(filters.style || null);
  const subStyleColor = theme === 'dark' ? styleColor.textDark : styleColor.text;
  const tempoValue = tempoSegmentValue(filters);
  const exactTempo = filters.tempoEnabled && tempoValue === 'custom';

  const chipRow = '-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:flex-wrap md:px-0 md:pb-0';

  return (
    <div className="space-y-3 md:space-y-4 md:rounded-[var(--radius-lg)] md:border md:border-[rgb(var(--color-border))] md:bg-[rgb(var(--color-bg-elevated))] md:p-4">
      {/* Dansstil */}
      <div className="space-y-2">
        <div role="group" aria-label="Dansstil" className={chipRow}>
          <Pill
            active={filters.style === ''}
            aria-pressed={filters.style === ''}
            aria-label="Visa alla dansstilar"
            className="shrink-0"
            onClick={() => setFilters({ style: '', subStyle: '', offset: 0 })}
          >
            Alla stilar
          </Pill>
          {mainStyles.map((style) => (
            <StyleChip
              key={style}
              style={style}
              active={filters.style === style}
              onClick={() =>
                setFilters(
                  filters.style === style
                    ? { style: '', subStyle: '', offset: 0 }
                    : { style, subStyle: '', offset: 0 },
                )
              }
            />
          ))}
        </div>

        {filters.style && subStylesForMain.length > 0 && (
          <div className="ml-2 space-y-2 border-l-2 border-[rgb(var(--color-border))] pl-3">
            <span id={`${ids}-substyle-label`} className={FIELD_LABEL}>
              Typ av {filters.style}:
            </span>
            <div
              role="group"
              aria-labelledby={`${ids}-substyle-label`}
              className="-mr-4 flex gap-2 overflow-x-auto pb-1 pr-4 scrollbar-hide md:mr-0 md:flex-wrap md:pr-0 md:pb-0"
            >
              <SubStyleChip
                label="Alla"
                ariaLabel={`Visa alla typer av ${filters.style}`}
                active={filters.subStyle === ''}
                color={subStyleColor}
                onClick={() => setFilters({ subStyle: '', offset: 0 })}
              />
              {subStylesForMain.map((sub) => (
                <SubStyleChip
                  key={sub}
                  label={sub}
                  ariaLabel={`Visa ${sub}`}
                  active={filters.subStyle === sub}
                  color={subStyleColor}
                  onClick={() =>
                    setFilters({ subStyle: filters.subStyle === sub ? '' : sub, offset: 0 })
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tempo, bekräftade, fler filter */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-x-3">
        <div className="relative inline-flex items-center">
          <label htmlFor={`${ids}-tempo`} className="sr-only">
            Tempo
          </label>
          <select
            id={`${ids}-tempo`}
            value={tempoValue}
            onChange={(e) => setFilters(tempoFiltersFromKey(e.target.value))}
            className="min-h-11 cursor-pointer appearance-none rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] py-0 pl-3 pr-7 text-sm font-semibold text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
          >
            <option value="">Alla tempon</option>
            {TEMPO_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            {tempoValue === 'custom' && (
              <option value="custom">
                {filters.minBpm ?? ''}–{filters.maxBpm ?? ''} BPM
              </option>
            )}
          </select>
          <ChevronDownIcon
            className="pointer-events-none absolute right-2 h-4 w-4 text-[rgb(var(--color-text))]"
            aria-hidden
          />
        </div>

        <button
          type="button"
          aria-pressed={filters.confirmed}
          aria-label="Visa bara bekräftade dansstilar"
          onClick={() => setFilters({ confirmed: !filters.confirmed, offset: 0 })}
          className={`${CHIP_BASE} border ${
            filters.confirmed
              ? 'border-[rgb(var(--color-selected))] bg-[rgb(var(--color-selected))]/10 font-semibold text-[rgb(var(--color-selected))]'
              : 'border-[rgb(var(--color-border))] bg-transparent text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
          }`}
        >
          {filters.confirmed && <CheckIcon className="h-3.5 w-3.5" aria-hidden />}
          <span className="md:hidden" aria-hidden>Bekräftade</span>
          <span className="hidden md:inline">Bara bekräftade</span>
        </button>

        <Button
          variant="outline"
          size="sm"
          aria-expanded={moreOpen}
          aria-controls={drawerId}
          onClick={() => setMoreOpen((o) => !o)}
          className="border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))]"
        >
          Fler filter
          {advancedCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[rgb(var(--color-accent))] px-1.5 text-[13px] font-bold text-[rgb(var(--color-accent-foreground))]">
              {advancedCount}
              <span className="sr-only"> aktiva</span>
            </span>
          )}
          <ChevronDownIcon
            className={`hidden h-4 w-4 transition-transform md:block ${moreOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="ml-auto">
            Rensa alla filter
          </Button>
        )}
      </div>

      {/* Fler filter */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[130] bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setMoreOpen(false)}
        />
      )}
      {moreOpen && (
        <div
          id={drawerId}
          role="group"
          aria-label="Fler filter"
          className="grid grid-cols-[minmax(0,1fr)] gap-5 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-[131] max-md:max-h-[85dvh] max-md:overflow-y-auto max-md:overscroll-contain max-md:rounded-t-[var(--radius-lg)] max-md:bg-[rgb(var(--color-bg-elevated))] max-md:px-4 max-md:shadow-[var(--color-card-shadow)] md:grid-cols-2 md:border-t md:border-[rgb(var(--color-border))] md:pt-4"
        >
          <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 pl-4 pr-2 md:hidden">
            <span className="text-base font-semibold text-[rgb(var(--color-text))]" aria-hidden>
              Fler filter
            </span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label="Stäng fler filter"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius)] px-3 text-sm font-medium text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
            >
              <CloseIcon className="h-4 w-4" aria-hidden />
              Stäng
            </button>
          </div>

          <div className="space-y-2">
            <span id={`${ids}-source-label`} className={FIELD_LABEL}>
              Källa
            </span>
            <div role="group" aria-labelledby={`${ids}-source-label`} className="flex flex-wrap gap-2">
              {SOURCES.map(({ value, label }) => (
                <Pill
                  key={value || 'all'}
                  active={filters.source === value}
                  aria-pressed={filters.source === value}
                  aria-label={value ? `Visa låtar från ${label}` : 'Visa låtar från alla källor'}
                  onClick={() => setFilters({ source: value, offset: 0 })}
                >
                  {value === 'spotify' && <SpotifyIcon className="mr-1.5 inline h-4 w-4" aria-hidden />}
                  {value === 'youtube' && <YouTubeIcon className="mr-1.5 inline h-4 w-4" aria-hidden />}
                  {label}
                </Pill>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className={FIELD_LABEL} aria-hidden>
              Sång
            </span>
            <SegmentedControl
              label="Sång eller instrumental"
              value={filters.vocals}
              options={VOCALS}
              onChange={(v) => setFilters({ vocals: v, offset: 0 })}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={`${ids}-duration`} className={FIELD_LABEL}>
              Längd
            </label>
            <select
              id={`${ids}-duration`}
              value={durationValueFromFilters(filters)}
              onChange={(e) => setFilters(durationFiltersFromValue(e.target.value))}
              className="min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
            >
              {DURATION_OPTIONS.map(({ value, label }) => (
                <option key={value || 'all'} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <EnableCheckbox
              id={`${ids}-exact-tempo`}
              checked={exactTempo}
              onChange={(checked) => {
                if (checked) {
                  const c = centerFromFilters(filters);
                  setFilters({
                    tempoEnabled: true,
                    minBpm: c - TEMPO_RANGE,
                    maxBpm: c + TEMPO_RANGE,
                    offset: 0,
                  });
                } else {
                  setFilters({ tempoEnabled: false, minBpm: null, maxBpm: null, offset: 0 });
                }
              }}
            >
              Exakt tempo i BPM
            </EnableCheckbox>
            <TempoSlider filters={filters} setFilters={setFilters} disabled={!exactTempo} />
          </div>

          <RangeSlider
            id={`${ids}-bounciness`}
            enabled={filters.bouncinessEnabled}
            onToggle={(enabled) =>
              setFilters(
                enabled
                  ? { bouncinessEnabled: true, minBounciness: 0, maxBounciness: 1, offset: 0 }
                  : { bouncinessEnabled: false, minBounciness: null, maxBounciness: null, offset: 0 },
              )
            }
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
            id={`${ids}-articulation`}
            enabled={filters.articulationEnabled}
            onToggle={(enabled) =>
              setFilters(
                enabled
                  ? { articulationEnabled: true, minArticulation: 0, maxArticulation: 1, offset: 0 }
                  : { articulationEnabled: false, minArticulation: null, maxArticulation: null, offset: 0 },
              )
            }
            minValue={filters.minArticulation ?? 0}
            maxValue={filters.maxArticulation ?? 1}
            onMinChange={(v) => setFilters({ minArticulation: v, offset: 0 })}
            onMaxChange={(v) => setFilters({ maxArticulation: v, offset: 0 })}
            minLabel="Flytande"
            maxLabel="Tydlig"
            label="Artikulation"
            step={0.1}
          />

          <div className="sticky bottom-0 -mx-4 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:hidden">
            <Button variant="primary" className="w-full" onClick={() => setMoreOpen(false)}>
              {resultsLabel ? `Visa ${resultsLabel}` : 'Visa resultat'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
