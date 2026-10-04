/**
 * The chip a row shows in place of its play control when the viewer cannot
 * play the track. The short word fits the row; the full sentence is what a
 * screen reader hears.
 */
export function UnavailableLabel() {
  return (
    <span className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-full)] border border-[rgb(var(--color-border-strong))] px-3 text-[13px] font-semibold text-[rgb(var(--color-text-muted))]">
      <span aria-hidden>Ej tillgänglig</span>
      <span className="sr-only">Inte tillgänglig för dig</span>
    </span>
  );
}
