export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center min-h-11 font-semibold rounded-[var(--radius)] border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-bg))] focus-visible:ring-[rgb(var(--color-accent))] disabled:opacity-50 disabled:pointer-events-none';
const variants: Record<ButtonVariant, string> = {
  primary:
    'border-[rgb(var(--color-accent-hover))] bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))]',
  secondary:
    'border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent-muted))]',
  ghost:
    'border-transparent bg-transparent text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-text))]/6',
  danger:
    'border-[rgb(var(--color-error-hover))] bg-[rgb(var(--color-error))] text-[rgb(var(--color-error-foreground))] hover:bg-[rgb(var(--color-error-hover))]',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

/** The class string of a button, for a link or label that should look like one. */
export function buttonClassName(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}
