import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Header } from '@/layout/Header';
import { Sidebar } from '@/layout/Sidebar';
import { GlobalPlayerShell } from '@/player/GlobalPlayerShell';
import { QueuePanel } from '@/player/components/QueuePanel';
import { usePlayer } from '@/player/usePlayer';
import { useTrackFromUrl } from '@/player/useTrackFromUrl';
import { ToastContainer, IconButton } from '@/ui';
import { CloseIcon, PlaylistIcon } from '@/icons';
import { useAuth } from '@/auth/useAuth';
import { createOrUpdateSession, recordPathView } from '@/api/generated/analytics/analytics';
import { getVoterId } from '@/utils/voter';
import { TAB_BAR_HEIGHT } from '@/layout/tabBar';

interface LayoutProps {
  children: React.ReactNode;
}

function TabLink({
  to,
  active,
  icon,
  onClick,
  children,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  onClick?: () => void;
  children: string;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 text-xs ${
        active
          ? 'font-semibold text-[rgb(var(--color-selected))]'
          : 'font-medium text-[rgb(var(--color-text-muted))]'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

export function Layout({ children }: LayoutProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { queue, currentTrack, queueOpen, closeQueue, playFromQueue, removeFromQueue, clearQueue, reorderQueue } =
    usePlayer();
  useTrackFromUrl();

  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const deviceType = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    createOrUpdateSession({ sessionId: getVoterId(), userAgent: navigator.userAgent, isAuthenticated: user != null, deviceType }).catch(() => {});
    recordPathView({ path: location.pathname }).catch(() => {});
  }, [location.pathname, user]);

  const path = location.pathname;
  const isHome = path === '/';
  const isSearch = path === '/search';
  const isPlaylists = path.startsWith('/playlists');
  const isMoreSection = !isHome && !isSearch && !isPlaylists;

  return (
    <div className="flex h-screen flex-col bg-[rgb(var(--color-bg))]">
      <Header />
      <div className="relative flex min-h-0 flex-1">
        {/* Phone and tablet: the "Mer" sheet with the full grouped navigation */}
        <div
          className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 lg:hidden ${moreOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          aria-hidden
          onClick={() => setMoreOpen(false)}
        />
        <aside
          className={`fixed left-0 top-0 z-40 flex h-full w-72 flex-col border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] pb-4 shadow-[var(--color-card-shadow)] transition-transform duration-200 ease-out lg:hidden ${moreOpen ? 'translate-x-0' : '-translate-x-full'}`}
          aria-label="Mer"
          aria-hidden={!moreOpen}
        >
          <div className="flex h-16 items-center justify-between px-4">
            <span className="text-base font-bold">Mer</span>
            <IconButton aria-label="Stäng menyn" onClick={() => setMoreOpen(false)}>
              <CloseIcon className="h-5 w-5" aria-hidden />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Sidebar onNavigate={() => setMoreOpen(false)} />
          </div>
        </aside>
        {/* Desktop left sidebar */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] py-4 lg:block">
          <Sidebar />
        </aside>
        {/* Content. Bottom padding keeps the last row clear of the player and the tab bar. */}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-40 lg:px-6 lg:pt-6 lg:pb-32">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
        {/* Desktop right queue sidebar */}
        {queueOpen && (
          <aside
            className="hidden w-80 shrink-0 border-l border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] pb-28 lg:flex lg:flex-col"
            aria-label="Uppspelningskö"
          >
            <QueuePanel
              queue={queue}
              currentTrack={currentTrack}
              onPlayFromQueue={playFromQueue}
              onRemoveFromQueue={removeFromQueue}
              onClearQueue={clearQueue}
              onReorderQueue={reorderQueue}
              onClose={closeQueue}
            />
          </aside>
        )}
      </div>
      <GlobalPlayerShell />

      {/* Phone and tablet: bottom tab bar */}
      <nav
        aria-label="Huvudnavigering"
        className="fixed inset-x-0 bottom-0 z-[125] grid grid-cols-4 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{ height: TAB_BAR_HEIGHT }}
      >
        <TabLink
          to="/"
          active={isHome}
          onClick={() => setMoreOpen(false)}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
              <path d="M3 11l9-8 9 8" />
              <path d="M5 10v10h14V10" />
            </svg>
          }
        >
          Hem
        </TabLink>
        <TabLink
          to="/search"
          active={isSearch}
          onClick={() => setMoreOpen(false)}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-6 w-6" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          }
        >
          Sök
        </TabLink>
        <TabLink to="/playlists" active={isPlaylists} onClick={() => setMoreOpen(false)} icon={<PlaylistIcon className="h-6 w-6" aria-hidden />}>
          Spellistor
        </TabLink>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={`flex flex-col items-center justify-center gap-0.5 text-xs ${
            isMoreSection
              ? 'font-semibold text-[rgb(var(--color-selected))]'
              : 'font-medium text-[rgb(var(--color-text-muted))]'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
            <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
            <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
            <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
            <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
          </svg>
          Mer
        </button>
      </nav>
      <ToastContainer />
    </div>
  );
}
