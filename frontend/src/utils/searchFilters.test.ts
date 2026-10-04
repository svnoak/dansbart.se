import { describe, it, expect } from 'vitest';
import { DEFAULT_FILTERS } from '@/hooks/useSearchParamsState';
import { getTempoLabel } from '@/utils/tempoLabel';
import {
  TEMPO_PRESETS,
  activeFilterWords,
  advancedFilterCount,
  tempoFiltersFromKey,
  tempoPresetFromFilters,
  tempoSegmentValue,
} from './searchFilters';

describe('tempo presets', () => {
  it('sit on the same thresholds as the tempo words on a track', () => {
    const labelFor: Record<string, string> = {
      Slow: 'långsam',
      SlowMed: 'lugn',
      Medium: 'lagom',
      Fast: 'snabb',
      Turbo: 'väldigt snabbt',
    };
    for (const preset of TEMPO_PRESETS) {
      const inside = ((preset.minBpm ?? 60) + (preset.maxBpm ?? 200)) / 2;
      expect(getTempoLabel(inside)).toBe(labelFor[preset.key]);
    }
  });

  it('round-trip from a word to BPM filters and back', () => {
    for (const preset of TEMPO_PRESETS) {
      const filters = { ...DEFAULT_FILTERS, ...tempoFiltersFromKey(preset.key) };
      expect(filters.tempoEnabled).toBe(true);
      expect(tempoPresetFromFilters(filters)?.key).toBe(preset.key);
      expect(tempoSegmentValue(filters)).toBe(preset.key);
    }
  });

  it('an unknown key clears the tempo filter', () => {
    const filters = { ...DEFAULT_FILTERS, ...tempoFiltersFromKey('') };
    expect(filters.tempoEnabled).toBe(false);
    expect(filters.minBpm).toBeNull();
    expect(tempoSegmentValue(filters)).toBe('');
  });

  it('an exact range is custom, not a word', () => {
    const filters = { ...DEFAULT_FILTERS, tempoEnabled: true, minBpm: 100, maxBpm: 120 };
    expect(tempoPresetFromFilters(filters)).toBeNull();
    expect(tempoSegmentValue(filters)).toBe('custom');
    expect(advancedFilterCount(filters)).toBe(1);
  });
});

describe('activeFilterWords', () => {
  it('is empty without filters', () => {
    expect(activeFilterWords(DEFAULT_FILTERS)).toEqual([]);
  });

  it('names the sub-style over the main style and reads the filters in page order', () => {
    const words = activeFilterWords({
      ...DEFAULT_FILTERS,
      style: 'Polska',
      subStyle: 'Slängpolska',
      ...tempoFiltersFromKey('Medium'),
      confirmed: true,
      source: 'youtube',
      vocals: 'true',
      minDuration: 300,
    });
    expect(words).toEqual(['Slängpolska', 'Lagom', 'bara bekräftade', 'YouTube', 'med sång', 'lång (över 5 min)']);
  });

  it('writes an exact tempo as a BPM range with Swedish decimals elsewhere', () => {
    const words = activeFilterWords({
      ...DEFAULT_FILTERS,
      tempoEnabled: true,
      minBpm: 100,
      maxBpm: 120,
      bouncinessEnabled: true,
      minBounciness: 0.2,
      maxBounciness: 0.8,
    });
    expect(words).toEqual(['100–120 BPM', 'studsighet 0,2–0,8']);
  });
});

describe('advancedFilterCount', () => {
  it('counts only what sits behind Fler filter', () => {
    expect(advancedFilterCount({ ...DEFAULT_FILTERS, style: 'Polska', confirmed: true })).toBe(0);
    expect(
      advancedFilterCount({
        ...DEFAULT_FILTERS,
        source: 'spotify',
        vocals: 'false',
        maxDuration: 180,
        articulationEnabled: true,
      }),
    ).toBe(4);
  });
});
