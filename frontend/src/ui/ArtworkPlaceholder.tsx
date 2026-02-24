interface ArtworkPlaceholderProps {
  className?: string;
  aspect?: 'square' | 'wide';
}

export function ArtworkPlaceholder({ className = '', aspect = 'square' }: ArtworkPlaceholderProps) {
  return (
    <div
      className={`flex items-center justify-center bg-[rgb(var(--color-border))]/50 text-[rgb(var(--color-text-muted))] ${aspect === 'square' ? 'aspect-square' : 'aspect-video'} ${className}`}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-1/3 h-1/3"
      >
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    </div>
  );
}
