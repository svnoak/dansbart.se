import type { IconProps } from './IconProps';

/** Play icon from Vue legacy. */
export function PlayIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
