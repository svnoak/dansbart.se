import { StaticPageLayout } from './StaticPageLayout';

export function NotFoundPage() {
  return (
    <StaticPageLayout title="Sidan hittades inte">
      <p className="text-[rgb(var(--color-text-muted))]">
        Sidan du letar efter finns inte. Den kan ha flyttats eller tagits bort.
      </p>
    </StaticPageLayout>
  );
}
