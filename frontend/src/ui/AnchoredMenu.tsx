import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

interface AnchoredMenuProps {
  open: boolean;
  /** The button that opened the menu. The menu hangs under its right edge. */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** Menu items, each in an element with role="none". */
  children: ReactNode;
  /** Width in px. */
  width?: number;
}

const menuItemBase =
  'flex w-full min-h-11 items-center px-4 text-left text-[15px] hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:bg-[rgb(var(--color-accent-muted))]';

/** The look of one item in an anchored menu. Use on the button or link inside each role="none" item. */
export const menuItemClassName = `${menuItemBase} text-[rgb(var(--color-text))]`;

/** A menu item that removes or deletes something. */
export const menuDangerItemClassName = `${menuItemBase} text-[rgb(var(--color-error))]`;

const GAP = 4;
const EDGE = 8;

/**
 * A dropdown menu rendered at the end of the document, so no card, list or
 * scroll container can clip it and it sits above the player bar. It opens
 * below its button, or above when there is no room below. Escape and a click
 * outside close it.
 */
export function AnchoredMenu({ open, anchorRef, onClose, children, width = 224 }: AnchoredMenuProps) {
  const menuRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const menuHeight = menu.offsetHeight;
      const roomBelow = window.innerHeight - EDGE - (rect.bottom + GAP);
      const openUp = menuHeight > roomBelow && rect.top - GAP - EDGE >= menuHeight;
      menu.style.right = `${Math.max(EDGE, window.innerWidth - rect.right)}px`;
      if (openUp) {
        menu.style.top = '';
        menu.style.bottom = `${window.innerHeight - rect.top + GAP}px`;
      } else {
        menu.style.bottom = '';
        menu.style.top = `${rect.bottom + GAP}px`;
      }
      menu.style.visibility = 'visible';
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
      anchorRef.current?.focus();
    };
    // Any scrolling would leave the menu floating away from its button.
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[140]" aria-hidden onClick={onClose} />
      <ul
        ref={menuRef}
        role="menu"
        style={{ position: 'fixed', width, visibility: 'hidden' }}
        className="z-[141] overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-[var(--color-card-shadow)]"
      >
        {children}
      </ul>
    </>,
    document.body,
  );
}
