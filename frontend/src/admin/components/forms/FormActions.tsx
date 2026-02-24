import type { ReactNode } from 'react';

export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      {children}
    </div>
  );
}
