import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RowSkeleton } from '@/ui';
import { StaticPageLayout } from './StaticPageLayout';

interface DiscourseTopicDetail {
  title: string;
  post_stream: {
    posts: Array<{ cooked: string }>;
  };
}

const LINK_CLASS = 'text-sm font-semibold text-[rgb(var(--color-link))] hover:underline';

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

  const backLink = (
    <Link to="/help" className={`inline-flex min-h-6 items-center ${LINK_CLASS}`}>
      ← Tillbaka till Hjälp och nyheter
    </Link>
  );

  if (loading) {
    return (
      <StaticPageLayout showHeaderBack={false} title="">
        <RowSkeleton rows={3} label="Laddar sidan" />
      </StaticPageLayout>
    );
  }

  if (error || !topic) {
    return (
      <StaticPageLayout showHeaderBack={false} title="Kunde inte hämta sidan">
        {backLink}
        <p className="mt-4 text-[15px] text-[rgb(var(--color-text-muted))]">
          Innehållet kunde inte laddas.{' '}
          <a
            href={`https://folkhub.se/t/${slug}/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[rgb(var(--color-link))] hover:underline"
          >
            Öppna på forumet
          </a>{' '}
          i stället.
        </p>
      </StaticPageLayout>
    );
  }

  const firstPost = topic.post_stream.posts[0];

  return (
    <StaticPageLayout showHeaderBack={false} title={topic.title}>
      <div className="mb-6">{backLink}</div>
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
          className={LINK_CLASS}
        >
          Visa diskussionen på forumet →
        </a>
      </div>
    </StaticPageLayout>
  );
}
