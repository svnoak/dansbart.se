import { useEffect, useState } from 'react';
import type { ToastMessage } from './toastEmitter';
import { toastListeners } from './toastEmitter';
import { CheckIcon, CloseIcon } from '@/icons';

/**
 * Backstage toasts: the same floating card as the public site, above the
 * global player. An error gets an error-coloured icon, not a red card.
 */
export function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }, 4000);
    };
    toastListeners.add(handler);
    return () => { toastListeners.delete(handler); };
  }, []);

  if (messages.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[200] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2">
      {messages.map((msg) => (
        <div
          key={msg.id}
          role="status"
          className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3 text-[15px] font-medium text-[rgb(var(--color-text))] shadow-[var(--color-card-shadow)]"
        >
          {msg.variant === 'error' ? (
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-error))] text-[rgb(var(--color-error-foreground))]"
              aria-hidden
            >
              <CloseIcon className="h-3 w-3" />
            </span>
          ) : (
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]"
              aria-hidden
            >
              <CheckIcon className="h-3 w-3" />
            </span>
          )}
          <span className="min-w-0 flex-1">{msg.text}</span>
        </div>
      ))}
    </div>
  );
}
