/** The word "Nytt" in a filled pill, placed next to a feature that was released recently. */
export function NewLabel({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-full bg-[rgb(var(--color-selected))] px-2 text-xs font-bold text-[rgb(var(--color-bg))] ${className}`}
    >
      Nytt
    </span>
  );
}
