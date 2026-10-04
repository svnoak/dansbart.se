import { useEffect, useState } from 'react';
import { RowSkeleton } from '@/ui';
import { StaticPageLayout } from './StaticPageLayout';

function extractMainContent(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const main = doc.querySelector('main');
  return main?.innerHTML ?? '';
}

const LAST_UPDATED = '12 december 2025';

export function TermsPage() {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/terms.html')
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Not found'))))
      .then((html) => setContent(extractMainContent(html)))
      .catch(() => setError(true));
  }, []);

  return (
    <StaticPageLayout title="Användarvillkor" lastUpdated={LAST_UPDATED}>
      {error && (
        <p className="text-[15px] text-[rgb(var(--color-error))]">
          Kunde inte ladda innehållet.{' '}
          <a
            href="/terms.html"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[rgb(var(--color-link))] hover:underline"
          >
            Öppna användarvillkoren i en ny flik
          </a>
          .
        </p>
      )}
      {!error && content === null && <RowSkeleton rows={3} label="Laddar sidan" />}
      {!error && content !== null && (
        <div
          className="static-page-content"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
    </StaticPageLayout>
  );
}
