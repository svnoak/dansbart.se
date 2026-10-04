import { useState } from 'react';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { ToastContainer } from '@/admin/components/Toast';
import { GlobalPlayerShell } from '@/player/GlobalPlayerShell';
import { IconButton } from '@/ui';
import { CloseIcon } from '@/icons';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[rgb(var(--color-bg))]">
      <AdminHeader onOpenSidebar={() => setSidebarOpen(true)} />
      <div className="relative flex flex-1">
        {/* Sidebar as an overlay below lg */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              aria-hidden
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              className="fixed left-0 top-0 z-40 flex h-full w-72 flex-col border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] shadow-[var(--color-card-shadow)] lg:hidden"
              aria-label="Adminmeny"
            >
              <div className="flex h-16 items-center justify-end px-2">
                <IconButton
                  aria-label="Stäng adminmenyn"
                  onClick={() => setSidebarOpen(false)}
                  className="text-[rgb(var(--color-text-muted))]"
                >
                  <CloseIcon className="h-5 w-5" aria-hidden />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pb-4">
                <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
              </div>
            </aside>
          </>
        )}
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 self-start overflow-y-auto border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] py-4 lg:block">
          <AdminSidebar />
        </aside>
        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-6 pb-32 lg:px-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <GlobalPlayerShell />
      <ToastContainer />
    </div>
  );
}
