import { useId, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Button, Card, Pill } from '@/ui';
import { CheckIcon, ChevronDownIcon, SpotifyIcon, YouTubeIcon } from '@/icons';
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
  className = '',
}: SegmentedControlProps<T>) {
  const sizeClass = size === 'md' ? 'min-h-10 px-4 text-sm' : 'min-h-8 px-3 text-sm';
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex flex-wrap gap-1 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] p-1 ${className}`}
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
          className="h-11 flex-1 accent-[rgb(var(--color-accent))]"
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
          className="h-11 flex-1 accent-[rgb(var(--color-accent))]"
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

const TEMPO_SEGMENTS: SegmentOption<string>[] = [
  { value: '', label: 'Alla', ariaLabel: 'Visa alla tempon' },
  ...TEMPO_PRESETS.map((p) => ({
    value: p.key,
    label: p.label,
    ariaLabel: `Visa ${p.label.toLowerCase()} tempo`,
  })),
];

/**
 * The filter card for tracks. Dance style and tempo are chips and a segmented
 * control that act at once; the rarer filters sit behind "Fler filter".
 */
export function FilterBar({
  filters,
  setFilters,
  searchType,
  styleOverview,
  onClearFilters,
  hasActiveFilters,
}: FilterBarProps) {
  const ids = useId();
  const drawerId = `${ids}-fler-filter`;
  const { theme } = useTheme();
  const advancedCount = advancedFilterCount(filters);
  const [moreOpen, setMoreOpen] = useState(advancedCount > 0);

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
    <Card className="space-y-4 p-4">
      {/* Dansstil */}
      <div className="space-y-2">
        <span id={`${ids}-style-label`} className={FIELD_LABEL}>
          Dansstil
        </span>
        <div role="group" aria-labelledby={`${ids}-style-label`} className={chipRow}>
          <Pill
            active={filters.style === ''}
            aria-pressed={filters.style === ''}
            aria-label="Visa alla dansstilar"
            className="shrink-0"
            onClick={() => setFilters({ style: '', subStyle: '', offset: 0 })}
          >
            Alla
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-[rgb(var(--color-text-muted))]" aria-hidden>
            Tempo
          </span>
          <SegmentedControl
            label="Tempo"
            value={tempoValue}
            options={TEMPO_SEGMENTS}
            onChange={(key) => setFilters(tempoFiltersFromKey(key))}
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
          Bara bekräftade
        </button>

        <Button
          variant="outline"
          size="sm"
          aria-expanded={moreOpen}
          aria-controls={drawerId}
          onClick={() => setMoreOpen((o) => !o)}
          className="border-[rgb(var(--color-border-strong))]"
        >
          Fler filter
          {advancedCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[rgb(var(--color-accent))] px-1.5 text-[13px] font-bold text-[rgb(var(--color-accent-foreground))]">
              {advancedCount}
              <span className="sr-only"> aktiva</span>
            </span>
          )}
          <ChevronDownIcon
            className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
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
          id={drawerId}
          className="grid gap-5 border-t border-[rgb(var(--color-border))] pt-4 md:grid-cols-2"
        >
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
        </div>
      )}
    </Card>
  );
}
