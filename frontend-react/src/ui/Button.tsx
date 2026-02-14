import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
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
    'inline-flex items-center justify-center font-medium rounded-[var(--radius)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-accent))] disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary:
      'bg-[rgb(var(--color-accent))] text-white hover:bg-[rgb(var(--color-accent-hover))]',
    secondary:
      'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))] hover:opacity-90 border border-[rgb(var(--color-border))]',
    ghost:
      'bg-transparent text-[rgb(var(--color-text))] hover:bg-black/5 border border-transparent',
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
