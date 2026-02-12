'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Script from 'next/script';
import { useEffect } from 'react';

export default function DocsPage() {
  // Suppress Scalar's invalid querySelector errors caused by IDs with slashes
  useEffect(() => {
    const origQuerySelector = document.querySelector.bind(document);
    document.querySelector = function (selector: string) {
      try {
        return origQuerySelector(selector);
      } catch {
        return null;
      }
    } as typeof document.querySelector;
    return () => {
      document.querySelector = origQuerySelector;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-vault-bg">
      <Header />

      {/* SDK & CLI Quick Start */}
      <section className="border-b border-white/[0.06] px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-sm font-medium uppercase tracking-wider text-vault-accent">
            Quick Start
          </h2>
          <p className="mb-8 text-center text-vault-muted text-sm">
            Use the SDK or CLI instead of calling the API directly.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {/* SDK */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-vault-text">
                <svg className="h-5 w-5 text-vault-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                SDK (Recommended)
              </h3>
              <p className="mb-3 text-sm text-vault-muted">
                Full TypeScript SDK for programmatic access to all ClawdVault features.
              </p>
              <pre className="mb-3 overflow-x-auto rounded-lg border border-white/[0.04] bg-vault-bg px-3 py-2 text-sm">
                <code className="font-mono text-vault-accent">npm install @clawdvault/sdk</code>
              </pre>
              <pre className="overflow-x-auto rounded-lg border border-white/[0.04] bg-vault-bg px-3 py-2 text-sm font-mono text-vault-secondary">
{`import { ClawdVault } from '@clawdvault/sdk';
const vault = new ClawdVault();
const tokens = await vault.tokens.list();`}
              </pre>
              <a
                href="https://www.npmjs.com/package/@clawdvault/sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-vault-accent transition-colors hover:text-vault-accent-hover"
              >
                View on npm &rarr;
              </a>
            </div>

            {/* CLI */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-vault-text">
                <svg className="h-5 w-5 text-vault-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
                CLI
              </h3>
              <p className="mb-3 text-sm text-vault-muted">
                Command-line tool for quick operations. Perfect for scripting and automation.
              </p>
              <pre className="mb-3 overflow-x-auto rounded-lg border border-white/[0.04] bg-vault-bg px-3 py-2 text-sm">
                <code className="font-mono text-vault-accent">npm install -g @clawdvault/cli</code>
              </pre>
              <pre className="overflow-x-auto rounded-lg border border-white/[0.04] bg-vault-bg px-3 py-2 text-sm font-mono text-vault-secondary">
{`# List tokens
clawdvault tokens list

# Get token info
clawdvault token get <MINT>`}
              </pre>
              <a
                href="https://www.npmjs.com/package/@clawdvault/cli"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-vault-accent transition-colors hover:text-vault-accent-hover"
              >
                View on npm &rarr;
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-vault-dim">
            <a
              href="https://github.com/shadowclawai/clawdvault-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-vault-text"
            >
              GitHub: shadowclawai/clawdvault-sdk
            </a>
          </p>
        </div>
      </section>

      {/* Scalar API Reference */}
      <section className="flex-1">
        <div
          id="api-reference"
          data-url="/openapi.yaml"
          data-proxy-url="https://proxy.scalar.com"
        />
      </section>

      <Footer />

      {/* Scalar CDN */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
        strategy="afterInteractive"
      />

      <style jsx global>{`
        :root {
          --scalar-background-1: #08080c;
          --scalar-background-2: #0d0d14;
          --scalar-background-3: #111118;
          --scalar-color-1: #f5f5f5;
          --scalar-color-2: #a3a3a3;
          --scalar-color-3: #737373;
          --scalar-color-accent: #f97316;
          --scalar-border-color: rgba(255, 255, 255, 0.06);
        }
        .scalar-api-reference {
          --scalar-radius: 8px;
          --scalar-radius-lg: 12px;
        }
      `}</style>
    </main>
  );
}
