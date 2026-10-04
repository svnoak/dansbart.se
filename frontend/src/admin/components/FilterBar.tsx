import type { ReactNode } from 'react';
import { Card } from '@/ui';

/**
 * The filter row above a backstage table: a card that lays its fields out in
 * a wrapping row, aligned on their bottom edge so labelled and unlabelled
 * fields line up.
 */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Card className="flex flex-wrap items-end gap-3 px-4 py-3">
      {children}
    </Card>
  );
}
