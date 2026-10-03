import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Button, PageHeader } from '@/ui';
import { buttonClassName } from '@/ui/buttonStyles';
import { RosetteIcon } from '@/icons';

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
        <div className="flex flex-col items-center gap-4 text-center">
          <RosetteIcon className="h-12 w-12 text-[rgb(var(--color-accent))]" aria-hidden />
          <PageHeader
            title="dansbart.se"
            description="Logga in med ditt Folkhub-konto"
            className="items-center text-center [&_h1]:justify-center"
          />
        </div>

        <div className="space-y-3">
          <Button variant="primary" className="w-full" onClick={login}>
            Logga in
          </Button>
          <a
            href={`${DISCOURSE_URL}/signup`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName('secondary', 'md', 'w-full')}
          >
            Skapa konto
          </a>
        </div>

        <p className="text-center text-sm text-[rgb(var(--color-text-muted))]">
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
