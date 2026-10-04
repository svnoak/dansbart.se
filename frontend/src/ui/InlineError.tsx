import type { ReactNode } from 'react';

interface InlineErrorProps {
  children: ReactNode;
}

/** An error next to the control it concerns. It stays until the person retries or changes the input. */
export function InlineError({ children }: InlineErrorProps) {
  if (!children) {
    return null;
  }

  return (
    <p className="text-sm font-medium text-[rgb(var(--color-error))]" role="alert">
      {children}
    </p>
  );
}
