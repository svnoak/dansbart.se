import type { InputHTMLAttributes } from 'react';

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

/** A 44 px text input with the strong border and the blue focus ring. */
export function TextInput({ className = '', ...props }: TextInputProps) {
  return (
    <input
      {...props}
      className={`min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] disabled:opacity-50 ${className}`}
    />
  );
}
