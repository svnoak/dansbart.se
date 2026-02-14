import type { IconProps } from './IconProps';

/** Add to queue icon from Vue legacy (same as Plus in context). */
export function QueueIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
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
      <path d="M12 4v16m8-8H4" />
    </svg>
  );
}
