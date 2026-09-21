export interface TempoOption {
  key: string;
  label: string;
}

// Keys are the tempo_correction vocabulary the backend expects — used whenever no raw
// BPM estimate exists at all and a tempo category has to be picked from scratch.
export const TEMPO_OPTIONS: TempoOption[] = [
  { key: 'Slow', label: 'Långsamt' },
  { key: 'SlowMed', label: 'Lugnt' },
  { key: 'Medium', label: 'Lagom' },
  { key: 'Fast', label: 'Snabbt' },
  { key: 'Turbo', label: 'V. snabbt' },
];
