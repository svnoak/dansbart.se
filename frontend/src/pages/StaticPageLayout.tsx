import { Link } from 'react-router-dom';

interface StaticPageLayoutProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

export function StaticPageLayout({ title, lastUpdated, children }: StaticPageLayoutProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <Link
          to="/"
          className="mb-4 inline-flex items-center text-sm font-medium text-[rgb(var(--color-accent))] hover:underline"
        >
          ← Tillbaka till dansbart.se
        </Link>
        <h1 className="mb-2 text-4xl font-bold text-[rgb(var(--color-text))]">{title}</h1>
        {lastUpdated && (
          <p className="text-[rgb(var(--color-text-muted))]">Senast uppdaterad: {lastUpdated}</p>
        )}
      </header>

      <main className="prose prose-lg max-w-none text-[rgb(var(--color-text))] [&_a]:text-[rgb(var(--color-accent))] [&_a]:hover:underline [&_code]:rounded [&_code]:bg-[rgb(var(--color-border))]/50 [&_code]:px-2 [&_code]:py-1 [&_code]:text-sm">
        {children}
      </main>

      <footer className="mt-12 border-t border-[rgb(var(--color-border))] pt-8">
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-sm text-[rgb(var(--color-text-muted))]">
          <Link to="/" className="text-[rgb(var(--color-accent))] hover:underline">
            ← Tillbaka till dansbart.se
          </Link>
          <span className="text-[rgb(var(--color-border))]">·</span>
          <Link to="/privacy" className="text-[rgb(var(--color-accent))] hover:underline">
            Integritetspolicy
          </Link>
          <span className="text-[rgb(var(--color-border))]">·</span>
          <Link to="/terms" className="text-[rgb(var(--color-accent))] hover:underline">
            Användarvillkor
          </Link>
          <span className="text-[rgb(var(--color-border))]">·</span>
          <Link to="/about" className="text-[rgb(var(--color-accent))] hover:underline">
            Om oss
          </Link>
          <span className="text-[rgb(var(--color-border))]">·</span>
          <Link to="/feedback" className="text-[rgb(var(--color-accent))] hover:underline">
            Feedback
          </Link>
        </p>
      </footer>
    </div>
  );
}
