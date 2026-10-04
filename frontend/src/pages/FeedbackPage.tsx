import { Card } from '@/ui';
import { StaticPageLayout } from './StaticPageLayout';

const LINK_CLASS = 'text-[15px] font-semibold text-[rgb(var(--color-link))] hover:underline';

export function FeedbackPage() {
  return (
    <StaticPageLayout title="Feedback">
      <p className="mb-6">
        Har du synpunkter, hittat ett fel eller vill du föreslå en förbättring? Det finns två sätt
        att höra av dig.
      </p>

      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <h2 className="mb-1 text-xl font-bold text-[rgb(var(--color-text))]">Forumet</h2>
          <p className="mb-3 text-[15px] text-[rgb(var(--color-text-muted))]">
            Det bästa stället för diskussioner, felrapporter och förslag. Andra användare kan också
            svara och bidra.
          </p>
          <a
            href="https://folkhub.se/c/dansbart-se/5"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            Gå till forumet →
          </a>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 text-xl font-bold text-[rgb(var(--color-text))]">E-post</h2>
          <p className="mb-3 text-[15px] text-[rgb(var(--color-text-muted))]">
            Föredrar du att skriva direkt? Skicka ett mejl så svarar vi så snart vi kan.
          </p>
          <a href="mailto:info@dansbart.se" className={LINK_CLASS}>
            info@dansbart.se
          </a>
        </Card>
      </div>
    </StaticPageLayout>
  );
}
