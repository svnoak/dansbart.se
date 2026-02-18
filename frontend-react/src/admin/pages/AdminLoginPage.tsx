import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/ui';

export function AdminLoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(password);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Inloggning misslyckades',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-bg))] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[rgb(var(--color-text))] text-[rgb(var(--color-bg-elevated))] font-bold text-xl">
            D
          </span>
          <h1 className="mt-4 text-xl font-semibold text-[rgb(var(--color-text))]">
            Admin
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
            Logga in för att hantera dansbart.se
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6"
        >
          <label
            htmlFor="admin-password"
            className="block text-sm font-medium text-[rgb(var(--color-text))]"
          >
            Lösenord
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            className="mt-1.5 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))] focus-visible:ring-1 focus-visible:ring-[rgb(var(--color-accent))]"
            placeholder="Ange lösenord"
          />

          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="mt-4 w-full"
            disabled={submitting || !password}
          >
            {submitting ? 'Loggar in...' : 'Logga in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
