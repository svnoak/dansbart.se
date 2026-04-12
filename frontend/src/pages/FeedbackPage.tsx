import { StaticPageLayout } from './StaticPageLayout';

export function FeedbackPage() {
  return (
    <StaticPageLayout title="Feedback">
      <p className="mb-6 text-[rgb(var(--color-text))]">
        Har du synpunkter, hittat ett fel eller vill du föreslå en förbättring? Det finns två sätt
        att höra av dig:
      </p>

      <section className="mb-6 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-5">
        <h2 className="mb-2 text-lg font-semibold text-[rgb(var(--color-text))]">
          Gemenskapsforumet
        </h2>
        <p className="mb-3 text-sm text-[rgb(var(--color-text-muted))]">
          Det bästa stället för diskussioner, felrapporter och förslag — andra användare kan också
          svara och bidra.
        </p>
        <a
          href="https://folkhub.se/c/dansbart-se/5"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[rgb(var(--color-accent))] hover:underline"
        >
          Gå till forumet →
        </a>
      </section>

      <section className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-5">
        <h2 className="mb-2 text-lg font-semibold text-[rgb(var(--color-text))]">E-post</h2>
        <p className="mb-3 text-sm text-[rgb(var(--color-text-muted))]">
          Föredrar du att skriva direkt? Skicka ett mail så svarar vi så snart vi kan.
        </p>
        <a
          href="mailto:info@dansbart.se"
          className="text-sm font-medium text-[rgb(var(--color-accent))] hover:underline"
        >
          info@dansbart.se
        </a>
      </section>
    </StaticPageLayout>
  );
}
