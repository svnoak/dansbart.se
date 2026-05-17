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

function useDiscourseTopics(tag: string) {
  const [topics, setTopics] = useState<DiscourseTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`https://folkhub.se/tags/c/dansbart-se/5/${tag}.json`, {
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setTopics(data.topic_list?.topics ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tag]);

  return { topics, loading, error };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function TopicList({
  topics,
  loading,
  error,
  emptyText,
  errorFallbackHref,
}: {
  topics: DiscourseTopic[];
  loading: boolean;
  error: boolean;
  emptyText: string;
  errorFallbackHref: string;
}) {
  if (loading) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))]">Hämtar innehåll...</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Kunde inte hämta innehåll.{' '}
        <a
          href={errorFallbackHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[rgb(var(--color-accent))] hover:underline"
        >
          Besök forumet
        </a>{' '}
        för senaste uppdateringar.
      </p>
    );
  }
  if (topics.length === 0) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))]">{emptyText}</p>;
  }
  return (
    <ul className="space-y-4">
      {topics.map((topic) => (
        <li
          key={topic.id}
          className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4"
        >
          <Link
            to={`/help/topic/${topic.slug}/${topic.id}`}
            className="font-semibold text-[rgb(var(--color-accent))] hover:underline"
          >
            {topic.title}
          </Link>
          <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">
            {formatDate(topic.created_at)}
          </p>
          {topic.excerpt && (
            <p className="mt-2 text-sm text-[rgb(var(--color-text))]">{topic.excerpt}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function HelpPage() {
  const faq = useDiscourseTopics('faq');
  const news = useDiscourseTopics('nyhet');

  return (
    <StaticPageLayout title="Hjälp & Nyheter">
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold text-[rgb(var(--color-text))]">Vanliga frågor</h2>
        <TopicList
          {...faq}
          emptyText="Inga vanliga frågor publicerade ännu."
          errorFallbackHref="https://folkhub.se/c/dansbart-se/5"
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold text-[rgb(var(--color-text))]">Nyheter</h2>
        <TopicList
          {...news}
          emptyText="Inga nyheter just nu."
          errorFallbackHref="https://folkhub.se/c/dansbart-se/5"
        />
      </section>
    </StaticPageLayout>
  );
}
