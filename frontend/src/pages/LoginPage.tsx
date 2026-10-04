import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Button, Card } from '@/ui';
import { StarMarkIcon } from '@/icons';

const DISCOURSE_URL = import.meta.env.VITE_DISCOURSE_URL ?? 'https://folkhub.se';

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-bg))]">
        <p role="status" className="text-[15px] text-[rgb(var(--color-text-muted))]">
          Laddar…
        </p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/admin/library" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-bg))] px-4">
      <Card className="w-full max-w-sm space-y-6 p-6 sm:p-8">
        <div className="text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]"
            aria-hidden
          >
            <StarMarkIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            Logga in
          </h1>
          <p className="mt-2 text-[15px] text-[rgb(var(--color-text-muted))]">
            Använd ditt konto på folkhub.se. Du behöver inget konto för att lyssna eller rösta.
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
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-transparent px-4 py-2 text-sm font-semibold text-[rgb(var(--color-text))] transition-colors hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] focus-visible:ring-offset-2"
          >
            Skapa konto
          </a>
        </div>

        <p className="text-center text-[13px] text-[rgb(var(--color-text-muted))]">
          Konton hanteras av{' '}
          <a
            href={DISCOURSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[rgb(var(--color-link))] hover:underline"
          >
            folkhub.se
          </a>
        </p>
      </Card>
    </div>
  );
}
