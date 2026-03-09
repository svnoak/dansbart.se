import { useState } from 'react';
import { Header } from '@/layout/Header';
import { Sidebar } from '@/layout/Sidebar';
import { GlobalPlayerShell } from '@/player/GlobalPlayerShell';
import { QueuePanel } from '@/player/components/QueuePanel';
import { usePlayer } from '@/player/usePlayer';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { queue, currentTrack, queueOpen, closeQueue, playFromQueue, removeFromQueue, clearQueue, reorderQueue } =
    usePlayer();

  return (
    <div className="flex h-screen flex-col bg-[rgb(var(--color-bg))]">
      <Header
        onOpenSidebar={() => setSidebarOpen(true)}
        showMenuButton
      />
      <div className="relative flex min-h-0 flex-1">
        {/* Mobile sidebar overlay */}
        <div
          className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 lg:hidden ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          className={`fixed left-0 top-0 z-40 h-full w-72 border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] py-4 shadow-lg transition-transform duration-200 ease-out lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          aria-label="Mobilmeny"
        >
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </aside>
        {/* Desktop left sidebar */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] py-4 lg:block">
          <Sidebar />
        </aside>
        {/* Content */}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
        {/* Desktop right queue sidebar */}
        {queueOpen && (
          <aside
            className="hidden w-80 shrink-0 border-l border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] lg:flex lg:flex-col"
            aria-label="Uppspelningskö"
          >
            <QueuePanel
              queue={queue}
              currentTrack={currentTrack}
              onPlayFromQueue={playFromQueue}
              onRemoveFromQueue={removeFromQueue}
              onClearQueue={clearQueue}
              onReorderQueue={reorderQueue}
              onClose={closeQueue}
            />
          </aside>
        )}
      </div>
      <GlobalPlayerShell />
    </div>
  );
}
