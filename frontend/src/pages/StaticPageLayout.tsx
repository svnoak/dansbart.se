import { Link } from 'react-router-dom';

interface StaticPageLayoutProps {
  title: string;
  lastUpdated?: string;
  showHeaderBack?: boolean;
  children: React.ReactNode;
}

const FOOTER_LINKS = [
  { to: '/privacy', label: 'Integritetspolicy' },
  { to: '/terms', label: 'Användarvillkor' },
  { to: '/help', label: 'Hjälp och nyheter' },
  { to: '/about', label: 'Om oss' },
  { to: '/feedback', label: 'Feedback' },
];

const LINK_CLASS = 'font-semibold text-[rgb(var(--color-link))] hover:underline';

/**
 * The frame for text pages: a 32 px heading, prose-width body in 16 px, and a
 * footer with the other text pages. Links are blue, the one link colour.
 */
export function StaticPageLayout({ title, lastUpdated, showHeaderBack = true, children }: StaticPageLayoutProps) {
  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-8">
      <header className="mb-8 space-y-3">
        {showHeaderBack && (
          <Link to="/" className={`inline-flex min-h-6 items-center text-sm ${LINK_CLASS}`}>
            ← Tillbaka till startsidan
          </Link>
        )}
        {title && (
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            {title}
          </h1>
        )}
        {lastUpdated && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">Senast uppdaterad: {lastUpdated}</p>
        )}
      </header>

      <main className="max-w-prose text-base leading-relaxed text-[rgb(var(--color-text))] [&_.static-page-content_a]:font-semibold [&_.static-page-content_a]:text-[rgb(var(--color-link))] [&_.static-page-content_a]:hover:underline [&_.static-page-content_h2]:mt-8 [&_.static-page-content_h2]:mb-3 [&_.static-page-content_h2]:text-xl [&_.static-page-content_h2]:font-bold [&_.static-page-content_h3]:mt-6 [&_.static-page-content_h3]:mb-2 [&_.static-page-content_h3]:text-lg [&_.static-page-content_h3]:font-bold [&_.static-page-content_p]:my-4 [&_.static-page-content_ul]:my-4 [&_.static-page-content_ul]:list-disc [&_.static-page-content_ul]:pl-6 [&_.static-page-content_ol]:my-4 [&_.static-page-content_ol]:list-decimal [&_.static-page-content_ol]:pl-6 [&_.static-page-content_li]:my-1 [&_code]:rounded-[var(--radius)] [&_code]:bg-[rgb(var(--color-accent-muted))] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm">
        {children}
      </main>

      <footer className="mt-12 border-t border-[rgb(var(--color-border))] pt-6">
        <nav aria-label="Fler sidor">
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            <li>
              <Link to="/" className={LINK_CLASS}>
                Startsidan
              </Link>
            </li>
            {FOOTER_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className={LINK_CLASS}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </footer>
    </div>
  );
}
