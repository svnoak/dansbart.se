import type { ReactNode } from 'react';

/**
 * The button row at the end of a form. Pass the primary Button last and the
 * outline Button before it; both come from `@/ui`.
 */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      {children}
    </div>
  );
}
