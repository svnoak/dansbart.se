import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 min-h-11 font-semibold rounded-[var(--radius)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))] disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary:
      'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))]',
    secondary:
      'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]',
    outline:
      'bg-transparent text-[rgb(var(--color-text))] border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-accent-muted))]',
    ghost:
      'bg-transparent text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] border border-transparent',
    danger:
      'bg-[rgb(var(--color-error))] text-[rgb(var(--color-error-foreground))] hover:bg-[rgb(var(--color-error-hover))]',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
