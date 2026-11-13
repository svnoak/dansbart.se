import type { ReactNode } from 'react';
import { Card } from '@/ui';

export interface SettingsSectionProps {
  title: string;
  description: string;
  danger?: boolean;
  children: ReactNode;
}

/** One settings section: heading and explanation on the left, the controls in a card on the right. */
export function SettingsSection({ title, description, danger = false, children }: SettingsSectionProps) {
  return (
    <section className="grid gap-4 border-t border-[rgb(var(--color-border))] pt-6 md:grid-cols-[260px_minmax(0,1fr)] md:gap-8">
      <div className="space-y-1">
        <h2
          className={`text-lg font-bold ${
            danger ? 'text-[rgb(var(--color-error))]' : 'text-[rgb(var(--color-text))]'
          }`}
        >
          {title}
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{description}</p>
      </div>
      <Card className={`p-5 ${danger ? 'border-[rgb(var(--color-error))]' : ''}`}>{children}</Card>
    </section>
  );
}
