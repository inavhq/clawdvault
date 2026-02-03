'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Script from 'next/script';

export default function DocsPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#1a1a2e]">
      <Header />

      <section className="flex-1">
        {/* Scalar API Reference - full width */}
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
        /* Dark theme for Scalar */
        :root {
          --scalar-background-1: #1a1a2e;
          --scalar-background-2: #111827;
          --scalar-background-3: #0d1117;
          --scalar-color-1: #ffffff;
          --scalar-color-2: #d1d5db;
          --scalar-color-3: #9ca3af;
          --scalar-color-accent: #f97316;
          --scalar-border-color: #374151;
        }
        .scalar-api-reference {
          --scalar-radius: 8px;
          --scalar-radius-lg: 12px;
        }
      `}</style>
    </main>
  );
}
