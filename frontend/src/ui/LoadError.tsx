import { Button } from './Button';

interface LoadErrorProps {
  message: string;
  onRetry: () => void;
}

/** The error above content that failed to load, with the one way forward: Försök igen. */
export function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-[15px] font-medium text-[rgb(var(--color-error))]">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="self-start sm:self-auto">
        Försök igen
      </Button>
    </div>
  );
}
