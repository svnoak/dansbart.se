export function getTempoLabel(bpm: number | undefined): string {
  if (bpm === undefined || bpm <= 0) return '';
  if (bpm < 90) return 'långsam';
  if (bpm < 110) return 'lugn';
  if (bpm < 135) return 'lagom';
  if (bpm < 165) return 'snabb';
  return 'väldigt snabbv';
}
