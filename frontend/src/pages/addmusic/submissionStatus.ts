import type { TrackSubmissionDto } from '@/api/models/trackSubmissionDto';

export type SubmissionStatusWord =
  | 'Väntar på granskning'
  | 'Hämtas'
  | 'Analyseras'
  | 'Klar'
  | 'Analysen misslyckades'
  | 'Finns redan'
  | 'Avvisad';

/** The one word the pages show for a submitted track's state. */
export function submissionStatusWord(item: TrackSubmissionDto): SubmissionStatusWord {
  switch (item.status) {
    case 'pending':
      return 'Väntar på granskning';
    case 'rejected':
      return 'Avvisad';
    case 'exists':
      return 'Finns redan';
    default:
      break;
  }
  if (!item.trackId) return 'Hämtas';
  switch (item.trackStatus) {
    case 'DONE':
    case 'REANALYZING':
      return 'Klar';
    case 'FAILED':
      return 'Analysen misslyckades';
    default:
      return 'Analyseras';
  }
}

/** True while the ingest or audio worker still has the track. */
export function isStillAnalysing(item: TrackSubmissionDto): boolean {
  if (item.status !== 'approved') return false;
  const word = submissionStatusWord(item);
  return word === 'Hämtas' || word === 'Analyseras';
}

/** "Polska" or "Polska · Slängpolska", or null when nothing was suggested. */
export function suggestedStyleLabel(item: Pick<TrackSubmissionDto, 'suggestedMainStyle' | 'suggestedSubStyle'>): string | null {
  if (!item.suggestedMainStyle) return null;
  return item.suggestedSubStyle ? `${item.suggestedMainStyle} · ${item.suggestedSubStyle}` : item.suggestedMainStyle;
}
