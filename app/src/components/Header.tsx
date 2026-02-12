'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import WalletButton from './WalletButton';
import SolPriceDisplay from './SolPriceDisplay';

function ClawdVaultLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
      <path d="M8 16L12 10L16 16L20 10L24 16" stroke="#08080c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 20H22" stroke="#08080c" strokeWidth="2.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#f97316" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const navLinks = [
  { href: '/create', label: 'Launch', mobileLabel: 'Launch' },
  { href: '/tokens', label: 'Browse', mobileLabel: 'Browse' },
  { href: '/docs', label: 'Docs', mobileLabel: 'Docs' },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-vault-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <ClawdVaultLogo />
          <span className="hidden min-[420px]:inline text-lg font-bold tracking-tight text-vault-text">
            CLAWDVAULT
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
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
          
          {/* Mobile nav links */}
          <div className="flex md:hidden items-center gap-1">
            {navLinks.slice(0, 2).map((link) => {
              const isActive = link.href === '/'
                ? pathname === '/'
                : pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'text-vault-text'
                      : 'text-vault-muted hover:text-vault-text'
                  }`}
                >
                  {link.mobileLabel}
                </Link>
              );
            })}
          </div>

          <WalletButton />
        </div>
      </div>
    </header>
  );
}
