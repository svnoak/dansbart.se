import { Link } from 'react-router-dom';
import { Card } from '@/ui';
import { CalendarIcon } from '@/icons';
import type { DanceListListItemDto } from '@/api/manual/publicDanceLists';

interface DanceListShortcutCardProps {
  danceList: DanceListListItemDto;
}

/** A shortcut on the home page rail: icon tile, name and the number of dances. */
export function DanceListShortcutCard({ danceList }: DanceListShortcutCardProps) {
  const entryCount = danceList.entryCount ?? 0;
  const summary = entryCount === 1 ? '1 dans' : `${entryCount} danser`;

  return (
    <Link
      to={`/dance-lists/${danceList.id}`}
      className="block w-full rounded-[var(--radius-lg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
    >
      <Card className="flex h-full w-full flex-col gap-3 p-4 transition-colors hover:bg-[rgb(var(--color-accent-muted))]">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text-muted))]"
          aria-hidden
        >
          <CalendarIcon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold text-[rgb(var(--color-text))]">
            {danceList.name || 'Okänd danslista'}
          </h3>
          <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">{summary}</p>
        </div>
      </Card>
    </Link>
  );
}
