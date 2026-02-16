export function getTempoLabel(bpm: number | undefined): string {
  if (bpm === undefined || bpm <= 0) return '';
  if (bpm < 90) return 'Langsamt';
  if (bpm < 110) return 'Lugnt';
  if (bpm < 135) return 'Lagom';
  if (bpm < 165) return 'Snabbt';
  return 'Valdigt snabbt';
}
