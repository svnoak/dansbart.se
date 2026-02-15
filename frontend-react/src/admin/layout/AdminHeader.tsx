import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { IconButton } from '@/ui';

export function AdminHeader({
  onOpenSidebar,
}: {
  onOpenSidebar: () => void;
}) {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
      <div className="flex items-center gap-3 px-4 py-3">
        <IconButton
          aria-label="Öppna meny"
          onClick={onOpenSidebar}
          className="lg:hidden"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
          </svg>
        </IconButton>

        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--color-text))] text-[rgb(var(--color-bg-elevated))] font-bold text-lg">
            D
          </span>
          <span className="text-lg font-semibold text-[rgb(var(--color-text))]">
            Admin
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
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
            onClick={logout}
            className="ml-2 flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-sm text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
            </svg>
            Logga ut
          </button>
        </div>
      </div>
    </header>
  );
}
