import { Link } from 'react-router-dom';
import { EmptyState } from '@/ui';
import { StarMarkIcon } from '@/icons';
import { StaticPageLayout } from './StaticPageLayout';

export function NotFoundPage() {
  return (
    <StaticPageLayout title="Sidan hittades inte">
      <EmptyState
        icon={<StarMarkIcon className="h-6 w-6" />}
        title="Här finns ingen sida"
        description="Sidan du letar efter finns inte. Den kan ha flyttats eller tagits bort."
        action={
          <Link
            to="/"
            className="mt-1 inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-5 py-2 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] transition-colors hover:bg-[rgb(var(--color-accent-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] focus-visible:ring-offset-2"
          >
            Gå till startsidan
          </Link>
        }
      />
    </StaticPageLayout>
  );
}
