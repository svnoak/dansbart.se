import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, IconButton } from '@/ui';
import { RosetteIcon } from '@/icons';
import { useAuth } from '@/auth/useAuth';

const DISCOURSE_URL = import.meta.env.VITE_DISCOURSE_URL ?? 'https://folkhub.se';

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initial = (user?.username ?? '?')[0].toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Användarmeny"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[rgb(var(--color-accent-hover))] bg-[rgb(var(--color-accent))] font-display text-base font-semibold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))] transition-colors"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-[var(--color-card-shadow)] z-50">
          {!!user?.confirmedTrackCount && (
            <>
              <p className="px-4 py-2 text-xs text-[rgb(var(--color-text-muted))]">
                Du har hjälpt bekräfta {user.confirmedTrackCount}{' '}
                {user.confirmedTrackCount === 1 ? 'låt' : 'låtar'}
              </p>
              <hr className="my-1 border-[rgb(var(--color-border))]" />
            </>
          )}
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin/library"
              onClick={() => setOpen(false)}
              className="flex w-full items-center px-4 py-2 text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50 transition-colors"
            >
              Admin
            </Link>
          )}
          <a
            href={DISCOURSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex w-full items-center px-4 py-2 text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50 transition-colors"
          >
            Gå till forum
          </a>
          <hr className="my-1 border-[rgb(var(--color-border))]" />
          <button
            type="button"
            onClick={() => { setOpen(false); logout(); }}
            className="flex w-full items-center px-4 py-2 text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50 transition-colors"
          >
            Logga ut
          </button>
        </div>
      )}
    </div>
  );
}

export function Header({
  onOpenSidebar,
  showMenuButton,
}: {
  onOpenSidebar?: () => void;
  showMenuButton?: boolean;
}) {
  const { isAuthenticated, isLoading, login } = useAuth();

  return (
    <header className="sticky top-0 z-20 bg-[rgb(var(--color-bg-elevated))]">
      <div className="flex items-center gap-3 px-4 py-2.5">
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
          className="flex shrink-0 items-center gap-2.5 rounded-[var(--radius)] text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-accent))]"
        >
          <RosetteIcon className="h-9 w-9 text-[rgb(var(--color-accent))]" aria-hidden />
          <span className="font-display text-2xl font-semibold leading-none tracking-tight">dansbart.se</span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {isAuthenticated && (
            <Link
              to="/mina-latar"
              className="hidden whitespace-nowrap text-sm font-semibold text-[rgb(var(--color-text))] underline decoration-[rgb(var(--color-border-strong))] underline-offset-4 hover:decoration-[rgb(var(--color-accent))] sm:inline"
            >
              Mina låtar
            </Link>
          )}
          {!isLoading && (
            isAuthenticated
              ? <UserMenu />
              : (
                <Button size="sm" onClick={login}>
                  Logga in
                </Button>
              )
          )}
        </div>
      </div>
      <div className="folk-band text-[rgb(var(--color-accent))]" aria-hidden />
    </header>
  );
}
