import { Button } from '@/ui';
import { useRelink } from '@/library/useRelink';

interface RelinkButtonProps {
  trackId: string;
  onRelinked: () => void;
}

export function RelinkButton({ trackId, onRelinked }: RelinkButtonProps) {
  const { relink } = useRelink();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        if (await relink(trackId)) onRelinked();
      }}
    >
      Välj filen igen
    </Button>
  );
}
