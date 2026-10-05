/**
 * The site's logotype: a bold D on an ink tile. The favicon is the same mark.
 */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-text))] text-lg font-bold leading-none text-[rgb(var(--color-bg-elevated))] ${className}`}
      aria-hidden
    >
      D
    </span>
  );
}
