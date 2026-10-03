import { useEffect, useState } from 'react';
import type { ToastMessage } from './toastEmitter';
import { toastListeners } from './toastEmitter';

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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {messages.map((msg) => (
        <div
          key={msg.id}
          role="status"
          className={`rounded-[var(--radius)] border px-4 py-2.5 text-sm font-medium shadow-[var(--color-card-shadow)] ${
            msg.variant === 'success'
              ? 'border-[rgb(var(--color-selected))] bg-[rgb(var(--color-selected-muted))] text-[rgb(var(--color-selected))]'
              : 'border-[rgb(var(--color-error))] bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-error))]'
          }`}
        >
          {msg.text}
        </div>
      ))}
    </div>
  );
}
