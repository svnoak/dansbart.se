import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StaticPageLayout } from './StaticPageLayout';

interface DiscourseTopic {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  created_at: string;
}

function useNyheter() {
  const [topics, setTopics] = useState<DiscourseTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('https://folkhub.se/tags/c/dansbart-se/5/nyhet.json', {
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setTopics(data.topic_list?.topics ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return { topics, loading, error };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function AboutPage() {
  const { topics, loading, error } = useNyheter();

  return (
    <StaticPageLayout title="Om oss">
      <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4 mb-6">
        <p className="mb-2 text-sm text-[rgb(var(--color-text))]">Villkor och integritet:</p>
        <p className="text-sm">
          <Link to="/privacy" className="font-medium text-[rgb(var(--color-accent))] hover:underline">
            Integritetspolicy
          </Link>
          <span className="mx-2 text-[rgb(var(--color-border))]">·</span>
          <Link to="/terms" className="font-medium text-[rgb(var(--color-accent))] hover:underline">
            Användarvillkor
          </Link>
        </p>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold text-[rgb(var(--color-text))]">Nyheter</h2>
        {loading && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">Hämtar nyheter...</p>
        )}
        {error && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Kunde inte hämta nyheter.{' '}
            <a
              href="https://folkhub.se/c/dansbart-se/5"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[rgb(var(--color-accent))] hover:underline"
            >
              Besök forumet
            </a>{' '}
            för senaste uppdateringar.
          </p>
        )}
        {!loading && !error && topics.length === 0 && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">Inga nyheter just nu.</p>
        )}
        {!loading && !error && topics.length > 0 && (
          <ul className="space-y-4">
            {topics.map((topic) => (
              <li
                key={topic.id}
                className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4"
              >
                <a
                  href={`https://folkhub.se/t/${topic.slug}/${topic.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[rgb(var(--color-accent))] hover:underline"
                >
                  {topic.title}
                </a>
                <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">
                  {formatDate(topic.created_at)}
                </p>
                {topic.excerpt && (
                  <p className="mt-2 text-sm text-[rgb(var(--color-text))]">{topic.excerpt}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold text-[rgb(var(--color-text))]">Om Dansbart.se</h2>
        <p className="mb-4 text-[rgb(var(--color-text))]">
          Dansbart.se är en gratistjänst som hjälper dig hitta rätt musik till dans. Vi gör det
          enkelt att söka och filtrera efter dansstil, tempo och känsla så att du snabbt hittar låtar
          som passar din dans.
        </p>
        <p className="mb-4 text-[rgb(var(--color-text))]">
          Tjänsten drivs som ett ideellt hobbyprojekt av dansentusiaster som vill göra det lättare
          att upptäcka och använda dansmusik. Vi använder öppen data och gemenskapsbidrag för att
          hålla katalogen uppdaterad och korrekt.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold text-[rgb(var(--color-text))]">Funktioner</h2>
        <ul className="list-disc space-y-2 pl-6 text-[rgb(var(--color-text))]">
          <li>Sökning och filtrering efter dansstil, tempo och andra parametrar</li>
          <li>Uppspelning via Spotify och YouTube</li>
          <li>Möjlighet att bidra med korrigeringar och förbättringar (crowdsourcing)</li>
          <li>Strukturanalys av låtar (taktslag och sektioner)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold text-[rgb(var(--color-text))]">Kontakt</h2>
        <p className="text-[rgb(var(--color-text))]">
          Har du frågor, hittat ett fel eller vill föreslå en förbättring? Se vår{' '}
          <Link to="/feedback" className="font-medium text-[rgb(var(--color-accent))] hover:underline">
            feedbacksida
          </Link>{' '}
          för hur du når oss.
        </p>
      </section>
    </StaticPageLayout>
  );
}
