import { Button } from './Button';

interface LoadErrorProps {
  message: string;
  onRetry: () => void;
}

export function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-error))] bg-[rgb(var(--color-error))]/10 p-4"
    >
      <p className="text-sm text-[rgb(var(--color-text))]">{message}</p>
      <div className="mt-2">
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Försök igen
        </Button>
      </div>
    </div>
  );
}
