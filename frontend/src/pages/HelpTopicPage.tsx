import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StaticPageLayout } from './StaticPageLayout';

interface DiscourseTopicDetail {
  title: string;
  post_stream: {
    posts: Array<{ cooked: string }>;
  };
}

export function HelpTopicPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [topic, setTopic] = useState<DiscourseTopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`https://folkhub.se/t/${slug}/${id}.json`, {
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setTopic(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug, id]);

  if (loading) {
    return (
      <StaticPageLayout showHeaderBack={false} title="">
        <p className="text-sm text-[rgb(var(--color-text-muted))]">Hämtar innehåll...</p>
      </StaticPageLayout>
    );
  }

  if (error || !topic) {
    return (
      <StaticPageLayout showHeaderBack={false} title="Kunde inte hämta sidan">
        <Link to="/help" className="text-sm font-medium text-[rgb(var(--color-accent))] hover:underline">
          ← Tillbaka till Hjälp & Nyheter
        </Link>
        <p className="mt-4 text-sm text-[rgb(var(--color-text-muted))]">
          Innehållet kunde inte laddas.{' '}
          <a
            href={`https://folkhub.se/t/${slug}/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[rgb(var(--color-accent))] hover:underline"
          >
            Öppna på forumet
          </a>{' '}
          istället.
        </p>
      </StaticPageLayout>
    );
  }

  const firstPost = topic.post_stream.posts[0];

  return (
    <StaticPageLayout showHeaderBack={false} title={topic.title}>
      <Link to="/help" className="mb-6 inline-block text-sm font-medium text-[rgb(var(--color-accent))] hover:underline">
        ← Tillbaka till Hjälp & Nyheter
      </Link>
      {firstPost && (
        <div
          className="discourse-content"
          dangerouslySetInnerHTML={{ __html: firstPost.cooked }}
        />
      )}
      <div className="mt-8 border-t border-[rgb(var(--color-border))] pt-6">
        <a
          href={`https://folkhub.se/t/${slug}/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[rgb(var(--color-accent))] hover:underline"
        >
          Visa diskussion på forumet →
        </a>
      </div>
    </StaticPageLayout>
  );
}
