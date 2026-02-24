import type { IconProps } from './IconProps';

/**
 * Sparkles icon – same SVG as Vue app (frontend_vue_legacy/js/icons/SparklesIcon.ts).
 * Use for AI/ML confidence indicators (e.g. dance style pills).
 */
export function SparklesIcon({ className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path
          d="M8 15C12.8747 15 15 12.949 15 8C15 12.949 17.1104 15 22 15C17.1104 15 15 17.1104 15 22C15 17.1104 12.8747 15 8 15Z"
          fill="currentColor">
      </path>
      <path
          d="M2 6.5C5.13376 6.5 6.5 5.18153 6.5 2C6.5 5.18153 7.85669 6.5 11 6.5C7.85669 6.5 6.5 7.85669 6.5 11C6.5 7.85669 5.13376 6.5 2 6.5Z"
          fill="currentColor">
      </path>
    </svg>
  );
}
