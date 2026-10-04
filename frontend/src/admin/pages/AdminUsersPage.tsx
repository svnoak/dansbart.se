import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/api/http-client';
import { useAuth } from '@/auth/useAuth';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { Select } from '@/admin/components/forms/Select';
import { Badge, LoadError } from '@/ui';

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  lastLoginAt: string | null;
}

const fieldClass = 'min-h-11 w-auto min-w-36 border-[rgb(var(--color-border-strong))] text-[15px]';

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch('/api/admin/users')
      .then((res) => res.json())
      .then((data: AdminUser[]) => setUsers(data))
      .catch(() => setError('Kunde inte hämta användare.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const columns: Column<AdminUser>[] = [
    {
      key: 'user',
      header: 'Användare',
      render: (user) => {
        const isSelf = user.id === currentUser?.id;
        return (
          <div>
            <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">
              {user.displayName || user.username}
              {isSelf && (
                <span className="ml-2 text-[13px] font-normal text-[rgb(var(--color-text-muted))]">(du)</span>
              )}
            </p>
            <p className="text-[13px] text-[rgb(var(--color-text-muted))]">@{user.username}</p>
          </div>
        );
      },
    },
    {
      key: 'lastLogin',
      header: 'Senaste inloggning',
      render: (user) => (
        <span className="text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">
          {user.lastLoginAt
            ? new Date(user.lastLoginAt).toLocaleDateString('sv-SE')
            : 'Aldrig'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Roll',
      render: (user) => {
        const isUpdating = updating === user.id;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={user.role === 'ADMIN' ? 'default' : 'muted'}>
              {user.role === 'ADMIN' ? 'Admin' : 'Användare'}
            </Badge>
            {isUpdating && (
              <span className="text-[13px] text-[rgb(var(--color-text-muted))]" role="status">
                Sparar…
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Ändra roll',
      render: (user) => {
        const isSelf = user.id === currentUser?.id;
        const isUpdating = updating === user.id;
        const name = user.displayName || user.username;
        return (
          <div className="flex justify-end">
            <label htmlFor={`role-${user.id}`} className="sr-only">
              Ändra roll för {name}
            </label>
            <Select
              id={`role-${user.id}`}
              value={user.role === 'ADMIN' ? 'ADMIN' : 'USER'}
              disabled={isSelf || isUpdating}
              onChange={(e) => {
                if (e.target.value !== user.role) toggleRole(user.id, user.role);
              }}
              className={fieldClass}
              title={isSelf ? 'Du kan inte ändra din egen roll' : undefined}
            >
              <option value="USER">Användare</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </div>
        );
      },
      className: 'w-44 text-right',
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Användare
        </h1>
        <p className="mt-1 text-[15px] text-[rgb(var(--color-text-muted))]">
          Alla som har loggat in. Ge någon rollen Admin för att släppa in dem backstage.
        </p>
      </header>

      {error && <LoadError message={error} onRetry={load} />}

      {!error && (
        <DataTable
          columns={columns}
          data={users}
          keyFn={(u) => u.id}
          loading={loading}
          emptyMessage="Inga användare har loggat in ännu."
        />
      )}
    </div>
  );
}
