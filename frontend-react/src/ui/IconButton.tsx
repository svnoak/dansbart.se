import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  children: ReactNode;
}

export function IconButton({
  className = '',
  'aria-label': ariaLabel,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-[var(--radius)] text-[rgb(var(--color-text))] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-accent))] disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
