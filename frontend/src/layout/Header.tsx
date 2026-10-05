import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconButton, LogoMark } from '@/ui';
import { MoonIcon, SunIcon } from '@/icons';
import { useAuth } from '@/auth/useAuth';
import { useTheme } from '@/theme/useTheme';

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
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--color-accent))] text-[15px] font-bold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))] transition-colors"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-[var(--color-card-shadow)] z-50">
          {!!user?.confirmedTrackCount && (
            <>
              <p className="px-4 py-2 text-[13px] text-[rgb(var(--color-text-muted))]">
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
              className="flex w-full items-center min-h-11 px-4 text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors"
            >
              Admin
            </Link>
          )}
          <a
            href={DISCOURSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex w-full items-center min-h-11 px-4 text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors"
          >
            Gå till forum
          </a>
          <hr className="my-1 border-[rgb(var(--color-border))]" />
          <button
            type="button"
            onClick={() => { setOpen(false); logout(); }}
            className="flex w-full items-center min-h-11 px-4 text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors"
          >
            Logga ut
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The site header: the mark, the theme toggle and the account control.
 * Navigation lives in the sidebar on desktop and the tab bar on a phone.
 */
export function Header() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
      <div className="flex h-16 items-center gap-3 px-4">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 text-[rgb(var(--color-text))] hover:opacity-90"
        >
          <LogoMark />
          <span className="text-lg font-bold">dansbart.se</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <IconButton
            aria-label={theme === 'dark' ? 'Byt till ljust tema' : 'Byt till mörkt tema'}
            onClick={toggleTheme}
            className="text-[rgb(var(--color-text-muted))]"
          >
            {theme === 'dark' ? (
              <SunIcon className="h-5 w-5" aria-hidden />
            ) : (
              <MoonIcon className="h-5 w-5" aria-hidden />
            )}
          </IconButton>
          {!isLoading && (
            isAuthenticated
              ? <UserMenu />
              : (
                <button
                  type="button"
                  onClick={login}
                  className="min-h-11 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))] transition-colors"
                >
                  Logga in
                </button>
              )
          )}
        </div>
      </div>
    </header>
  );
}
