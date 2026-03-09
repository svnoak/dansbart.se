import type { IconProps } from './IconProps';

/** Parallel arrows icon representing sequential (non-shuffled) playback. */
export function ShuffleOffIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Top arrow */}
      <path d="M4 5H21M21 5L16 1M21 5L16 9" />
      {/* Bottom arrow */}
      <path d="M4 19H21M21 19L16 15M21 19L16 23" />
    </svg>
  );
}