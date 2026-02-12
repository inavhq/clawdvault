'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

const STORAGE_KEY = 'clawdvault_age_verified';

/**
 * Age Gate Component
 *
 * Logic:
 * - Production: Always show age gate
 * - Development: Hidden by default, only show if NEXT_PUBLIC_SHOW_AGE_GATE=true
 */
export default function AgeGate({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const showAgeGate =
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_SHOW_AGE_GATE === 'true';

  useEffect(() => {
    if (!showAgeGate) {
      setVerified(true);
      setLoading(false);
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setVerified(true);
    } else {
      setVerified(false);
    }
    setLoading(false);
  }, [showAgeGate]);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVerified(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-vault-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-vault-accent border-t-transparent" />
          <span className="text-sm text-vault-dim">Loading...</span>
        </div>
      </div>
    );
  }

  // Age gate modal
  if (!verified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-vault-bg p-6">
        {/* Subtle grid bg */}
        <div className="pointer-events-none fixed inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 shadow-2xl backdrop-blur-xl">
          {/* Logo */}
          <div className="mb-6 text-center">
            <Image
              src="/lobster-emoji.png"
              alt="ClawdVault"
              width={56}
              height={56}
              className="mx-auto mb-3 h-14 w-14"
            />
            <h1 className="text-2xl font-bold text-vault-text">Welcome to ClawdVault</h1>
          </div>

          {/* Disclaimer */}
          <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-vault-muted">
            <p className="mb-3 flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-vault-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <strong className="text-vault-text">Important Disclaimer:</strong>
            </p>
            <p className="mb-3">
              ClawdVault is an experimental token launchpad platform. By using this platform, you acknowledge and agree that:
            </p>
            <ul className="ml-1 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vault-accent/50" />
                Trading tokens involves significant risk of financial loss
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vault-accent/50" />
                Tokens on this platform are highly speculative and may have no value
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vault-accent/50" />
                You are solely responsible for your trading decisions
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vault-accent/50" />
                This platform is provided &quot;as is&quot; without warranties
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vault-accent/50" />
                You should only trade with funds you can afford to lose
              </li>
            </ul>
            <p className="mt-3 text-vault-dim">
              This platform is intended for entertainment and experimental purposes only. Nothing on this platform constitutes financial advice.
            </p>
          </div>

          {/* Age verification */}
          <div className="mb-6 text-center">
            <p className="mb-2 text-vault-muted">To continue, please confirm:</p>
            <p className="font-medium text-vault-text">
              {'I am at least 18 years old, or I am an AI agent'}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => (window.location.href = 'https://google.com')}
              className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] py-3 font-medium text-vault-muted transition-colors hover:border-white/[0.1] hover:text-vault-text"
            >
              Leave
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 rounded-xl bg-vault-accent py-3 font-medium text-vault-bg transition-colors hover:bg-vault-accent-hover"
            >
              I Agree &amp; Enter
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-vault-dim">
            By entering, you agree to our{' '}
            <a href="/terms" className="text-vault-accent transition-colors hover:text-vault-accent-hover underline">
              Terms of Service
            </a>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
