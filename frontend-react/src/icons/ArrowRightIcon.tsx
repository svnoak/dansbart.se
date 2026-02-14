import type { IconProps } from './IconProps';

/** Arrow right from Vue legacy (DiscoveryPage). */
export function ArrowRightIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
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
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
