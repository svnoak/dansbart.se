import { useState } from 'react';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { ToastContainer } from '@/admin/components/Toast';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[rgb(var(--color-bg))]">
      <AdminHeader onOpenSidebar={() => setSidebarOpen(true)} />
      <div className="relative flex flex-1">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              aria-hidden
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              className="fixed left-0 top-0 z-40 h-full w-72 border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] py-4 shadow-lg lg:hidden"
              aria-label="Adminmeny"
            >
              <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
            </aside>
          </>
        )}
        {/* Desktop sidebar */}
        <aside className="sticky top-14 hidden h-fit w-56 shrink-0 self-start border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] py-4 lg:block">
          <AdminSidebar />
        </aside>
        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-4 lg:px-6 lg:py-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
