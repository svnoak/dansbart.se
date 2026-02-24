import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useConsent } from '@/consent/useConsent';
import { Button } from '@/ui';

function NavLink({
  to,
  active,
  icon,
  children,
}: {
  to: string;
  active: boolean;
  icon?: React.ReactNode | null;
  children: string;
}) {
  return (
    <Link
      to={to}
      className={`flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-sm font-medium transition-colors ${
        icon != null ? '' : 'pl-2'
      } ${
        active
          ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))] border-r-3 border-[rgb(var(--color-accent))]'
          : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50'
      }`}
    >
      {icon != null && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-current opacity-90">
          {icon}
        </span>
      )}
      {children}
    </Link>
  );
}

export function Sidebar() {
  const location = useLocation();
  const { consentStatus, openCookieSettings } = useConsent();
  const isSearch = location.pathname === '/search';
  const isHome = location.pathname === '/';
  const isAbout = location.pathname === '/about';
  const isTerms = location.pathname === '/terms';
  const isPrivacy = location.pathname === '/privacy';
  const isInfoPage = isAbout || isTerms || isPrivacy;

  const [omOpen, setOmOpen] = useState(isInfoPage);
  const [prevIsInfoPage, setPrevIsInfoPage] = useState(isInfoPage);
  if (isInfoPage && !prevIsInfoPage) {
    setOmOpen(true);
  }
  if (prevIsInfoPage !== isInfoPage) {
    setPrevIsInfoPage(isInfoPage);
  }

  return (
    <nav className="flex flex-col gap-1" aria-label="Huvudnavigering">
      <NavLink
        to="/search"
        active={isSearch}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        }
      >
        Sök
      </NavLink>
      <NavLink
        to="/"
        active={isHome}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"></svg>
        }
      >
        Bibliotek
      </NavLink>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOmOpen((o) => !o)}
          className={`flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-left text-sm font-medium transition-colors ${
            isInfoPage
              ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
              : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50'
          }`}
          aria-expanded={omOpen}
          aria-controls="sidebar-om-submenu"
          id="sidebar-om-button"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-current opacity-90">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-5 w-5 transition-transform ${omOpen ? 'rotate-90' : ''}`}
            >
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.06l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </span>
          <span>Om</span>
        </button>
        <div
          id="sidebar-om-submenu"
          role="region"
          aria-labelledby="sidebar-om-button"
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${omOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-1 border-l-2 border-[rgb(var(--color-border))] ml-5 pl-2 py-1">
            <NavLink to="/about" active={isAbout}>
              Om oss
            </NavLink>
            <NavLink to="/privacy" active={isPrivacy}>
              Integritetspolicy
            </NavLink>
            <NavLink to="/terms" active={isTerms}>
              Användarvillkor
            </NavLink>
            </div>
          </div>
        </div>
      </div>

      {consentStatus && (
        <div className="mt-4 px-3">
          <button
            type="button"
            onClick={openCookieSettings}
            className="w-full text-left rounded-none px-3 py-2.5 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))] transition-colors"
          >
            Cookie-inställningar
          </button>
        </div>
      )}

      <div className="m-4">
        <div className="rounded-xl border border-[rgb(var(--color-accent))]/30 bg-[rgb(var(--color-accent-muted))]/30 p-4">
          <p className="text-sm font-medium text-[rgb(var(--color-text))]">Veckans utmaning</p>
          <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">
            Hjälp till att förbättra klassificeringen av dansstilar.
          </p>
          <Link to="/classify" className="mt-3 block">
            <Button variant="primary" size="sm" className="w-full">
              Starta quiz
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
