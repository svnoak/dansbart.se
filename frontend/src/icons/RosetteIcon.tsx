import type { IconProps } from './IconProps';

/** Eight-petal rosette, the mark of dansbart.se. Draws in currentColor on a filled disc. */
export function RosetteIcon({ className = '', ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={className} {...props}>
      <circle cx="16" cy="16" r="16" fill="currentColor" />
      <g fill="rgb(var(--color-bg-elevated))">
        <path d="M16 5c2.6 3.2 2.6 6.8 0 10-2.6-3.2-2.6-6.8 0-10z" />
        <path d="M16 27c-2.6-3.2-2.6-6.8 0-10 2.6 3.2 2.6 6.8 0 10z" />
        <path d="M5 16c3.2-2.6 6.8-2.6 10 0-3.2 2.6-6.8 2.6-10 0z" />
        <path d="M27 16c-3.2 2.6-6.8 2.6-10 0 3.2-2.6 6.8-2.6 10 0z" />
        <path d="M8.2 8.2c4.1.4 6.7 3 7.1 7.1-4.1-.4-6.7-3-7.1-7.1z" />
        <path d="M23.8 23.8c-4.1-.4-6.7-3-7.1-7.1 4.1.4 6.7 3 7.1 7.1z" />
        <path d="M23.8 8.2c-.4 4.1-3 6.7-7.1 7.1.4-4.1 3-6.7 7.1-7.1z" />
        <path d="M8.2 23.8c.4-4.1 3-6.7 7.1-7.1-.4 4.1-3 6.7-7.1 7.1z" />
      </g>
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
    </svg>
  );
}
