import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { IconButton } from '@/ui';

function getUrlQuery(pathname: string, search: string): string {
  if (pathname === '/search') {
    return new URLSearchParams(search).get('q') ?? '';
  }
  return '';
}

export function Header({
  onOpenSidebar,
  showMenuButton,
}: {
  onOpenSidebar?: () => void;
  showMenuButton?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const urlQuery = getUrlQuery(location.pathname, location.search);
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  const [globalQuery, setGlobalQuery] = useState(urlQuery);

  if (prevUrlQuery !== urlQuery) {
    setPrevUrlQuery(urlQuery);
    setGlobalQuery(urlQuery);
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = globalQuery.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/search');
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
      <div className="flex items-center gap-3 px-4 py-3">
        {showMenuButton && onOpenSidebar && (
          <IconButton
            aria-label="Öppna meny"
            onClick={onOpenSidebar}
            className="lg:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
          </IconButton>
        )}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 text-[rgb(var(--color-text))] hover:opacity-90"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--color-text))] text-[rgb(var(--color-bg-elevated))] font-bold text-lg">
            D
          </span>
          <span className="text-lg font-semibold">dansbart.se</span>
        </Link>
        <form
          onSubmit={handleSearch}
          className="mx-auto flex min-w-0 max-w-xl flex-1 justify-center"
        >
          <div className="relative w-full">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              type="search"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Sök låtnamn, artist…"
              className="w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] py-2 pl-10 pr-4 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))] focus-visible:ring-1 focus-visible:ring-[rgb(var(--color-accent))]"
              aria-label="Global sökning"
            />
          </div>
        </form>
      </div>
    </header>
  );
}
