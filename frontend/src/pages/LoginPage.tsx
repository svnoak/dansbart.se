import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/ui';

const DISCOURSE_URL = import.meta.env.VITE_DISCOURSE_URL ?? 'https://folkhub.se';

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-bg))]">
        <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/admin/library" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-bg))]">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[rgb(var(--color-text))] text-[rgb(var(--color-bg))] text-2xl font-bold">
            D
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-[rgb(var(--color-text))]">dansbart.se</h1>
          <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
            Logga in med ditt Folkhub-konto
          </p>
        </div>

        <div className="space-y-3">
          <Button variant="primary" className="w-full" onClick={login}>
            Logga in
          </Button>
          <a
            href={`${DISCOURSE_URL}/signup`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2 text-sm font-medium text-[rgb(var(--color-text))] transition-colors hover:bg-[rgb(var(--color-border))]/50"
          >
            Skapa konto
          </a>
        </div>

        <p className="text-center text-xs text-[rgb(var(--color-text-muted))]">
          Konton hanteras via{' '}
          <a
            href={DISCOURSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[rgb(var(--color-text))]"
          >
            folkhub.se
          </a>
        </p>
      </div>
    </div>
  );
}
