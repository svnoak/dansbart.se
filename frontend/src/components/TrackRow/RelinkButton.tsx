import { requestPersistentStorage } from '@/library/localCopies';
import { useRelink } from '@/library/useRelink';

interface RelinkButtonProps {
  trackId: string;
  onRelinked: () => void;
}

/**
 * Sits where the play control would be when an own track's local file is
 * missing: an outline chip with a link icon and the word for what pressing
 * it does.
 */
export function RelinkButton({ trackId, onRelinked }: RelinkButtonProps) {
  const { relink } = useRelink();
  return (
    <button
      type="button"
      onClick={async () => {
        requestPersistentStorage();
        if (await relink(trackId)) onRelinked();
      }}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-full)] border border-[rgb(var(--color-border-strong))] bg-transparent px-3 text-[14px] font-semibold text-[rgb(var(--color-text))] transition-colors hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
      aria-label="Välj filen igen"
      title="Välj filen igen"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      Hitta filen
    </button>
  );
}
