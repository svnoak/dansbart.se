import { StaticPageLayout } from './StaticPageLayout';
import { Card } from '@/ui';

export function FeedbackPage() {
  return (
    <StaticPageLayout title="Feedback">
      <p className="mb-6 text-[rgb(var(--color-text))]">
        Har du synpunkter, hittat ett fel eller vill du föreslå en förbättring? Det finns två sätt
        att höra av dig:
      </p>

      <Card className="mb-6 p-5">
        <h2 className="mb-2 text-xl font-semibold text-[rgb(var(--color-text))]">
          Gemenskapsforumet
        </h2>
        <p className="mb-3 text-base text-[rgb(var(--color-text-muted))]">
          Det bästa stället för diskussioner, felrapporter och förslag — andra användare kan också
          svara och bidra.
        </p>
        <a
          href="https://folkhub.se/c/dansbart-se/5"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-base font-semibold text-[rgb(var(--color-accent))] underline decoration-[rgb(var(--color-accent))]/40 underline-offset-4 hover:decoration-[rgb(var(--color-accent))]"
        >
          Gå till forumet →
        </a>
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 text-xl font-semibold text-[rgb(var(--color-text))]">E-post</h2>
        <p className="mb-3 text-base text-[rgb(var(--color-text-muted))]">
          Föredrar du att skriva direkt? Skicka ett mail så svarar vi så snart vi kan.
        </p>
        <a
          href="mailto:info@dansbart.se"
          className="inline-flex min-h-11 items-center text-base font-semibold text-[rgb(var(--color-accent))] underline decoration-[rgb(var(--color-accent))]/40 underline-offset-4 hover:decoration-[rgb(var(--color-accent))]"
        >
          info@dansbart.se
        </a>
      </Card>
    </StaticPageLayout>
  );
}
