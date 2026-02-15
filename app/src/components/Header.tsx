'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import WalletButton from './WalletButton';
import SolPriceDisplay from './SolPriceDisplay';

const navLinks = [
  { href: '/create', label: 'Launch' },
  { href: '/tokens', label: 'Browse' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/docs', label: 'Docs' },
];

function MenuIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
    </svg>
  );
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mobileOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setMobileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileOpen]);

  // Close menu on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-vault-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/lobster-emoji.png"
            alt="ClawdVault lobster logo"
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
          <span className="hidden min-[420px]:inline text-lg font-bold tracking-tight text-vault-text">
            CLAWDVAULT
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map((link) => {
            const isActive = link.href === '/'
              ? pathname === '/'
              : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-vault-text'
                    : 'text-vault-muted hover:text-vault-text'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute inset-x-3 -bottom-[1.075rem] h-px bg-vault-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <SolPriceDisplay className="hidden sm:flex" />
          <WalletButton />

          {/* Mobile menu button */}
          <button
            ref={buttonRef}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="relative flex md:hidden items-center justify-center h-9 w-9 rounded-lg text-vault-secondary transition-colors hover:text-vault-text hover:bg-white/[0.05]"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile nav overlay + panel */}
      {mobileOpen && (
        <div className="md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-16 z-40 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />

          {/* Nav panel */}
          <nav
            ref={menuRef}
            id="mobile-nav-menu"
            className="fixed left-0 right-0 top-16 z-50 border-b border-white/[0.06] bg-vault-bg/95 backdrop-blur-xl"
            aria-label="Mobile navigation"
          >
            <div className="mx-auto max-w-7xl px-4 pb-4 pt-2">
              <ul className="flex flex-col gap-1" role="list">
                {navLinks.map((link) => {
                  const isActive = link.href === '/'
                    ? pathname === '/'
                    : pathname?.startsWith(link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                          isActive
                            ? 'bg-white/[0.05] text-vault-text'
                            : 'text-vault-secondary hover:bg-white/[0.03] hover:text-vault-text'
                        }`}
                      >
                        {isActive && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-vault-accent" />
                        )}
                        <span>{link.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* SOL price shown in mobile menu if hidden from header */}
              <div className="mt-3 flex sm:hidden items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5">
                <SolPriceDisplay detailed />
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
