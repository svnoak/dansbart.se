import type { IconProps } from './IconProps';

/** Music note icon from Iconoir. */
export function MusicNoteIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
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
      <path d="M12 16V19C12 20.1046 11.1046 21 10 21H9C7.89543 21 7 20.1046 7 19V18C7 16.8954 7.89543 16 9 16H12ZM12 16V8M12 8V4L17 3V7L12 8Z" />
    </svg>
  );
}
