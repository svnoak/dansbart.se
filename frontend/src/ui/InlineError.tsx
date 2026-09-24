import type { ReactNode } from 'react';

interface InlineErrorProps {
  children: ReactNode;
}

export function InlineError({ children }: InlineErrorProps) {
  if (!children) {
    return null;
  }

  return (
    <p className="text-sm text-[rgb(var(--color-error))]" role="alert">
      {children}
    </p>
  );
}
