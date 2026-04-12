import { useEffect, useState } from 'react';
import { apiFetch } from '@/api/http-client';
import { useAuth } from '@/auth/useAuth';

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  lastLoginAt: string | null;
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/admin/users')
      .then((res) => res.json())
      .then((data: AdminUser[]) => setUsers(data))
      .catch(() => setError('Kunde inte hämta användare.'))
      .finally(() => setLoading(false));
  }, []);

  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    setUpdating(userId);
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      }
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Användare</h1>
        <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Användare</h1>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[rgb(var(--color-border))] text-left text-[rgb(var(--color-text-muted))]">
              <th className="px-4 py-3 font-medium">Användare</th>
              <th className="px-4 py-3 font-medium">Senaste inloggning</th>
              <th className="px-4 py-3 font-medium">Roll</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUser?.id;
              const isUpdating = updating === user.id;
              return (
                <tr
                  key={user.id}
                  className="border-b border-[rgb(var(--color-border))] last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[rgb(var(--color-text))]">
                      {user.displayName || user.username}
                      {isSelf && (
                        <span className="ml-2 text-xs text-[rgb(var(--color-text-muted))]">(du)</span>
                      )}
                    </div>
                    <div className="text-xs text-[rgb(var(--color-text-muted))]">@{user.username}</div>
                  </td>
                  <td className="px-4 py-3 text-[rgb(var(--color-text-muted))]">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString('sv-SE')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.role === 'ADMIN'
                          ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
                          : 'bg-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]'
                      }`}
                    >
                      {user.role === 'ADMIN' ? 'Admin' : 'Användare'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={isSelf || isUpdating}
                      onClick={() => toggleRole(user.id, user.role)}
                      className="text-xs text-[rgb(var(--color-accent))] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isUpdating
                        ? 'Sparar...'
                        : user.role === 'ADMIN'
                        ? 'Gör till användare'
                        : 'Gör till admin'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
