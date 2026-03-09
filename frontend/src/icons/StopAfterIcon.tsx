import type { IconProps } from './IconProps';

/** Repeat icon with the return arrow replaced by a stop square, indicating "stop after this track". */
export function StopAfterIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Top forward arrow (same as RepeatIcon) */}
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      {/* Stop square replacing the bottom return arrow */}
      <rect x="12" y="12" width="12" height="12" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}