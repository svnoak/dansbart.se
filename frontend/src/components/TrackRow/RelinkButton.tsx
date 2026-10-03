import { ArrowPathIcon } from '@/icons';
import { requestPersistentStorage } from '@/library/localCopies';
import { useRelink } from '@/library/useRelink';

interface RelinkButtonProps {
  trackId: string;
  onRelinked: () => void;
}

export function RelinkButton({ trackId, onRelinked }: RelinkButtonProps) {
  const { relink } = useRelink();
  return (
    <button
      type="button"
      onClick={async () => {
        requestPersistentStorage();
        if (await relink(trackId)) onRelinked();
      }}
      className="flex h-12 w-12 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-accent))] bg-[rgb(var(--color-error))]/10 text-[rgb(var(--color-error))]"
      aria-label="Välj filen igen"
      title="Välj filen igen"
    >
      <ArrowPathIcon className="h-5 w-5" aria-hidden />
    </button>
  );
}
