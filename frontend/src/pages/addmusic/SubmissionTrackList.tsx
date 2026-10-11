import type { TrackSubmissionDto } from '@/api/models/trackSubmissionDto';
import { StylePill } from '@/components/TrackRow/StylePill';
import { submissionStatusWord } from './submissionStatus';

interface SubmissionTrackListProps {
  items: TrackSubmissionDto[];
}

const STATUS_CLASS: Record<string, string> = {
  Klar: 'text-[rgb(var(--color-success))]',
  'Analysen misslyckades': 'text-[rgb(var(--color-error))]',
  Avvisad: 'text-[rgb(var(--color-error))]',
};

/** The tracks one link produced: title, artist, the suggested dance style and a status word. */
export function SubmissionTrackList({ items }: SubmissionTrackListProps) {
  return (
    <ul className="divide-y divide-[rgb(var(--color-border))]">
      {items.map((item) => {
        const status = submissionStatusWord(item);
        const style = item.suggestedSubStyle ?? item.suggestedMainStyle ?? null;
        return (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[rgb(var(--color-text))]">{item.title}</p>
              <p className="truncate text-sm text-[rgb(var(--color-text-muted))]">
                {[item.artistName, item.albumName].filter(Boolean).join(' · ') || 'Okänd artist'}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StylePill style={style} state={style ? 'guess' : 'unknown'} />
              <span className={`text-[13px] font-medium ${STATUS_CLASS[status] ?? 'text-[rgb(var(--color-text-muted))]'}`}>
                {status}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
