export function getTempoLabel(bpm: number | undefined): string {
  if (bpm === undefined || bpm <= 0) return '';
  if (bpm < 90) return 'långsam';
  if (bpm < 110) return 'lugn';
  if (bpm < 135) return 'lagom';
  if (bpm < 165) return 'snabb';
  return 'väldigt snabbt';
}

import { TEMPO_OPTIONS } from './tempoOptions';

/** The Swedish word for a stored tempo category (Slow, SlowMed, Medium, Fast, Turbo). */
export function tempoCategoryLabel(category: string | null | undefined): string {
  if (!category) return '';
  return TEMPO_OPTIONS.find((o) => o.key === category)?.label ?? category;
}
