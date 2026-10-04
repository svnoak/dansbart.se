import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useTheme } from '@/theme/useTheme';
import { Badge, IconButton } from '@/ui';
import { MoonIcon, StarMarkIcon, SunIcon } from '@/icons';

/**
 * The backstage header: the same shape as the public header (h-16, white
 * surface, hairline), with the mark, a "Backstage" badge, the theme toggle
 * and the way back to the public site.
 */
export function AdminHeader({
  onOpenSidebar,
}: {
  onOpenSidebar: () => void;
}) {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
      <div className="flex h-16 items-center gap-3 px-4">
        <IconButton
          aria-label="Öppna adminmenyn"
          onClick={onOpenSidebar}
          className="-ml-2 text-[rgb(var(--color-text-muted))] lg:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-6 w-6"
            aria-hidden
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </IconButton>

        <Link
          to="/admin/library"
          className="flex min-w-0 shrink-0 items-center gap-2.5 text-[rgb(var(--color-text))] hover:opacity-90"
        >
          <StarMarkIcon className="h-8 w-8 shrink-0 text-[rgb(var(--color-link))]" aria-hidden />
          <span className="text-lg font-bold">dansbart.se</span>
          <Badge className="hidden sm:inline-flex">Backstage</Badge>
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

          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border border-[rgb(var(--color-border))] px-4 text-sm font-semibold text-[rgb(var(--color-text))] transition-colors hover:bg-[rgb(var(--color-accent-muted))]"
          >
            Till sidan
          </Link>

          <button
            type="button"
            onClick={logout}
            className="hidden min-h-11 items-center justify-center rounded-[var(--radius)] px-3 text-sm font-medium text-[rgb(var(--color-text-muted))] transition-colors hover:bg-[rgb(var(--color-accent-muted))] hover:text-[rgb(var(--color-text))] sm:inline-flex"
          >
            Logga ut
          </button>
        </div>
      </div>
    </header>
  );
}
