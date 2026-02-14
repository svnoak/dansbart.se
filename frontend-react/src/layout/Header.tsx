import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { IconButton } from '@/ui';
import { useTheme } from '@/theme/ThemeContext';
import { getStats } from '@/api/generated/stats/stats';
import type { StatsDto } from '@/api/models/statsDto';

function formatLastAdded(iso?: string) {
  if (!iso) return '–';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return '–';
  }
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
  const { theme, toggleTheme } = useTheme();
  const [globalQuery, setGlobalQuery] = useState('');
  const [stats, setStats] = useState<StatsDto | null>(null);

  useEffect(() => {
    if (location.pathname === '/search') {
      const q = new URLSearchParams(location.search).get('q') ?? '';
      setGlobalQuery(q);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    getStats()
      .then((data) => setStats(data ?? null))
      .catch(() => setStats(null));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = globalQuery.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/search');
    }
  };

  const trackCount = stats?.totalTracks ?? 0;
  const categorized = stats?.coveragePercent ?? 0;
  const lastAdded = formatLastAdded(stats?.lastAdded);

  return (
    <header className="sticky top-0 z-20 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
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
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-border))]/50 px-2.5 py-1 text-xs text-[rgb(var(--color-text-muted))]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 3.75a2 2 0 10-4 0 2 2 0 004 0zM3.75 8a2 2 0 100-4 2 2 0 000 4zM16.25 8a2 2 0 100-4 2 2 0 000 4zM2 10a2 2 0 012-2h2a2 2 0 012 2v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1zM14 10a2 2 0 012-2h2a2 2 0 012 2v1a2 2 0 01-2 2h-2a2 2 0 01-2-2v-1zM10 12a2 2 0 012-2h.01a2 2 0 012 2v1a2 2 0 01-2 2h-.01a2 2 0 01-2-2v-1z" />
            </svg>
            {trackCount.toLocaleString('sv-SE')} låtar
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-border))]/50 px-2.5 py-1 text-xs text-[rgb(var(--color-text-muted))]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-green-600">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
            {categorized}% kategoriserade
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-border))]/50 px-2.5 py-1 text-xs text-[rgb(var(--color-text-muted))]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
            </svg>
            Tillagd: {lastAdded}
          </span>
        </div>
        <form
          onSubmit={handleSearch}
          className="flex flex-1 min-w-0 max-w-xl"
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
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            aria-label={theme === 'dark' ? 'Växla till ljust läge' : 'Växla till mörkt läge'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162 1.035l-2.518 3.654a.75.75 0 01-1.2.9L4.206 4.28a.75.75 0 011.035.162l2.518-3.654a.75.75 0 011.035-.162zM12 6a6 6 0 100 12 6 6 0 000-12zM2.25 12a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H3a.75.75 0 01-.75-.75zm16.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75z" clipRule="evenodd" />
              </svg>
            )}
          </IconButton>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--color-accent))] text-sm font-medium text-white hover:opacity-90"
            aria-label="Användarprofil"
          >
            JD
          </button>
        </div>
      </div>
    </header>
  );
}
