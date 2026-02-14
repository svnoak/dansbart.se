import type { IconProps } from './IconProps';

/** Chevron right from Vue legacy. */
export function ChevronRightIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
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
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
