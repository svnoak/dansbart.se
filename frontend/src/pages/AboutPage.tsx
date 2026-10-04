import { Link } from 'react-router-dom';
import { Card } from '@/ui';
import { StaticPageLayout } from './StaticPageLayout';

const LINK_CLASS = 'font-semibold text-[rgb(var(--color-link))] hover:underline';

export function AboutPage() {
  return (
    <StaticPageLayout title="Om oss">
      <Card className="mb-8 p-4">
        <p className="text-sm text-[rgb(var(--color-text-muted))]">Villkor och integritet</p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
          <Link to="/privacy" className={LINK_CLASS}>
            Integritetspolicy
          </Link>
          <Link to="/terms" className={LINK_CLASS}>
            Användarvillkor
          </Link>
        </p>
      </Card>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-[rgb(var(--color-text))]">Om dansbart.se</h2>
        <p className="mb-4">
          Dansbart.se är en gratistjänst som hjälper dig hitta rätt musik till dans. Vi gör det
          enkelt att söka och filtrera efter dansstil, tempo och känsla så att du snabbt hittar låtar
          som passar din dans.
        </p>
        <p>
          Tjänsten drivs som ett ideellt hobbyprojekt av dansentusiaster som vill göra det lättare
          att upptäcka och använda dansmusik. Vi använder öppen data och bidrag från gemenskapen för
          att hålla katalogen uppdaterad och korrekt.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-[rgb(var(--color-text))]">Funktioner</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Sökning och filtrering efter dansstil, tempo och andra egenskaper</li>
          <li>Uppspelning via Spotify och YouTube</li>
          <li>Möjlighet att bidra med rättelser och förbättringar</li>
          <li>Strukturanalys av låtar (taktslag och sektioner)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-[rgb(var(--color-text))]">Kontakt</h2>
        <p>
          Har du frågor, hittat ett fel eller vill föreslå en förbättring? Se vår{' '}
          <Link to="/feedback" className={LINK_CLASS}>
            feedbacksida
          </Link>{' '}
          för hur du når oss.
        </p>
      </section>
    </StaticPageLayout>
  );
}
