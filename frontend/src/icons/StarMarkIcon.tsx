import type { IconProps } from './IconProps';

/**
 * The eight-point star (åttabladsrosen), a weaving and knitting motif found
 * across the Nordics. The no-artwork placeholder and a decorative empty-state
 * icon. The site's logotype is the D tile in ui/LogoMark.
 */
export function StarMarkIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M23 12L17.08 14.1 19.78 19.78 14.1 17.08 12 23 9.9 17.08 4.22 19.78 6.92 14.1 1 12 6.92 9.9 4.22 4.22 9.9 6.92 12 1 14.1 6.92 19.78 4.22 17.08 9.9Z" />
    </svg>
  );
}
