import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, RowSkeleton } from '@/ui';
import { StaticPageLayout } from './StaticPageLayout';

interface DiscourseTopic {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  created_at: string;
}

const FORUM_URL = 'https://folkhub.se/c/dansbart-se/5';
const LINK_CLASS = 'font-semibold text-[rgb(var(--color-link))] hover:underline';

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
  loadingLabel,
}: {
  topics: DiscourseTopic[];
  loading: boolean;
  error: boolean;
  emptyText: string;
  loadingLabel: string;
}) {
  if (loading) {
    return <RowSkeleton rows={2} label={loadingLabel} />;
  }
  if (error) {
    return (
      <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
        Kunde inte hämta innehållet.{' '}
        <a href={FORUM_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          Besök forumet
        </a>{' '}
        för de senaste uppdateringarna.
      </p>
    );
  }
  if (topics.length === 0) {
    return <p className="text-[15px] text-[rgb(var(--color-text-muted))]">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {topics.map((topic) => (
        <li key={topic.id}>
          <Card className="p-4">
            <Link to={`/help/topic/${topic.slug}/${topic.id}`} className={`text-base ${LINK_CLASS}`}>
              {topic.title}
            </Link>
            <p className="mt-1 text-[13px] text-[rgb(var(--color-text-muted))]">
              {formatDate(topic.created_at)}
            </p>
            {topic.excerpt && (
              <p className="mt-2 text-[15px] text-[rgb(var(--color-text))]">{topic.excerpt}</p>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function HelpPage() {
  const faq = useDiscourseTopics('faq');
  const news = useDiscourseTopics('nyhet');

  return (
    <StaticPageLayout title="Hjälp och nyheter">
      <section className="mb-10" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="mb-4 text-xl font-bold text-[rgb(var(--color-text))]">
          Vanliga frågor
        </h2>
        <TopicList
          {...faq}
          emptyText="Inga vanliga frågor publicerade ännu."
          loadingLabel="Laddar vanliga frågor"
        />
      </section>

      <section className="mb-8" aria-labelledby="news-heading">
        <h2 id="news-heading" className="mb-4 text-xl font-bold text-[rgb(var(--color-text))]">
          Nyheter
        </h2>
        <TopicList {...news} emptyText="Inga nyheter just nu." loadingLabel="Laddar nyheter" />
      </section>
    </StaticPageLayout>
  );
}
