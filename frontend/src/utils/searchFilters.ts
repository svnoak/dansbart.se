import type { SearchFilters } from '@/hooks/useSearchParamsState';

export interface TempoPreset {
  key: string;
  label: string;
  minBpm: number | null;
  maxBpm: number | null;
}

/**
 * The tempo words map onto BPM ranges on the same thresholds as
 * `getTempoLabel` (<90, 90–110, 110–135, 135–165, ≥165). The API has no
 * tempo-category parameter, so the words travel as minBpm/maxBpm.
 */
export const TEMPO_PRESETS: TempoPreset[] = [
  { key: 'Slow', label: 'Långsamt', minBpm: null, maxBpm: 90 },
  { key: 'SlowMed', label: 'Lugnt', minBpm: 90, maxBpm: 110 },
  { key: 'Medium', label: 'Lagom', minBpm: 110, maxBpm: 135 },
  { key: 'Fast', label: 'Snabbt', minBpm: 135, maxBpm: 165 },
  { key: 'Turbo', label: 'V. snabbt', minBpm: 165, maxBpm: null },
];

/** The preset whose range is the active BPM filter, or null for none or an exact range. */
export function tempoPresetFromFilters(filters: SearchFilters): TempoPreset | null {
  if (!filters.tempoEnabled) return null;
  return (
    TEMPO_PRESETS.find((p) => p.minBpm === filters.minBpm && p.maxBpm === filters.maxBpm) ?? null
  );
}

/** '' for no tempo filter, the preset key for a word, 'custom' for an exact range. */
export function tempoSegmentValue(filters: SearchFilters): string {
  if (!filters.tempoEnabled) return '';
  return tempoPresetFromFilters(filters)?.key ?? 'custom';
}

export function tempoFiltersFromKey(key: string): Partial<SearchFilters> {
  const preset = TEMPO_PRESETS.find((p) => p.key === key);
  if (!preset) return { tempoEnabled: false, minBpm: null, maxBpm: null, offset: 0 };
  return { tempoEnabled: true, minBpm: preset.minBpm, maxBpm: preset.maxBpm, offset: 0 };
}

export const DURATION_OPTIONS = [
  { value: '', label: 'Alla längder' },
  { value: 'short', label: 'Kort (under 3 min)' },
  { value: 'medium', label: 'Medel (3–5 min)' },
  { value: 'long', label: 'Lång (över 5 min)' },
];

export function durationValueFromFilters(filters: SearchFilters): string {
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

export function durationFiltersFromValue(value: string): Partial<SearchFilters> {
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

/** How many of the filters inside "Fler filter" are active. */
export function advancedFilterCount(filters: SearchFilters): number {
  let n = 0;
  if (filters.source) n++;
  if (filters.vocals) n++;
  if (filters.minDuration != null || filters.maxDuration != null) n++;
  if (filters.tempoEnabled && !tempoPresetFromFilters(filters)) n++;
  if (filters.bouncinessEnabled) n++;
  if (filters.articulationEnabled) n++;
  return n;
}

export const formatDecimal = (n: number) =>
  n.toLocaleString('sv-SE', { maximumFractionDigits: 1 });

/** The words for the results heading, in the order the filters sit on the page. */
export function activeFilterWords(filters: SearchFilters): string[] {
  const words: string[] = [];
  if (filters.subStyle) words.push(filters.subStyle);
  else if (filters.style) words.push(filters.style);

  const preset = tempoPresetFromFilters(filters);
  if (preset) {
    words.push(preset.label);
  } else if (filters.tempoEnabled && (filters.minBpm != null || filters.maxBpm != null)) {
    if (filters.minBpm != null && filters.maxBpm != null) {
      words.push(`${filters.minBpm}–${filters.maxBpm} BPM`);
    } else if (filters.minBpm != null) {
      words.push(`från ${filters.minBpm} BPM`);
    } else {
      words.push(`upp till ${filters.maxBpm} BPM`);
    }
  }

  if (filters.confirmed) words.push('bara bekräftade');
  if (filters.source) words.push(filters.source === 'spotify' ? 'Spotify' : 'YouTube');
  if (filters.vocals) words.push(filters.vocals === 'true' ? 'med sång' : 'instrumental');

  const dur = durationValueFromFilters(filters);
  if (dur) {
    const label = DURATION_OPTIONS.find((d) => d.value === dur)?.label ?? dur;
    words.push(label.charAt(0).toLowerCase() + label.slice(1));
  }
  if (filters.bouncinessEnabled) {
    words.push(
      `studsighet ${formatDecimal(filters.minBounciness ?? 0)}–${formatDecimal(filters.maxBounciness ?? 1)}`,
    );
  }
  if (filters.articulationEnabled) {
    words.push(
      `artikulation ${formatDecimal(filters.minArticulation ?? 0)}–${formatDecimal(filters.maxArticulation ?? 1)}`,
    );
  }
  return words;
}
