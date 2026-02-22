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
  const { queue, currentTrack, queueOpen, closeQueue, playFromQueue, removeFromQueue, clearQueue } =
    usePlayer();

  return (
    <div className="flex min-h-screen flex-col bg-[rgb(var(--color-bg))]">
      <Header
        onOpenSidebar={() => setSidebarOpen(true)}
        showMenuButton
      />
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
              aria-label="Mobilmeny"
            >
              <Sidebar />
            </aside>
          </>
        )}
        {/* Desktop left sidebar - sticky so nav stays visible when scrolling */}
        <aside className="sticky top-14 hidden h-fit w-64 shrink-0 self-start border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] py-4 lg:block">
          <Sidebar />
        </aside>
        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-4 lg:px-6 lg:py-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
        {/* Desktop right queue sidebar */}
        {queueOpen && (
          <aside
            className="sticky top-14 hidden h-[calc(100vh-3.5rem-94px)] w-80 shrink-0 self-start border-l border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] lg:flex lg:flex-col"
            aria-label="Uppspelningskö"
          >
            <QueuePanel
              queue={queue}
              currentTrack={currentTrack}
              onPlayFromQueue={playFromQueue}
              onRemoveFromQueue={removeFromQueue}
              onClearQueue={clearQueue}
              onClose={closeQueue}
            />
          </aside>
        )}
      </div>
      <GlobalPlayerShell />
    </div>
  );
}
