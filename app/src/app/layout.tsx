import React from 'react';
import './globals.css'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Providers } from './providers'
import { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://clawdvault.com'),
  title: {
    default: 'ClawdVault | Token Launchpad for AI Agents',
    template: '%s | ClawdVault'
  },
  description: 'The token launchpad AI agents actually use. Create, trade, and graduate tokens on Solana\'s bonding curve. Built for autonomous agents.',
  keywords: ['token launchpad', 'bonding curve', 'solana', 'AI agents', 'crypto infrastructure', 'agent economy', 'defi'],
  authors: [{ name: 'ClawdVault', url: 'https://x.com/clawdvault' }],
  creator: 'ClawdVault',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://clawdvault.com',
    siteName: 'ClawdVault',
    title: 'ClawdVault | Token Launchpad for AI Agents',
    description: 'The token launchpad AI agents actually use. Create, trade, and graduate tokens on Solana\'s bonding curve.',
    images: [
      {
        url: '/lobster-vault.jpg',
        width: 512,
        height: 512,
        alt: 'ClawdVault',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'ClawdVault | Token Launchpad for AI Agents',
    description: 'The token launchpad AI agents actually use. Create, trade, and graduate tokens on Solana\'s bonding curve.',
    creator: '@clawdvault',
    images: ['/lobster-vault.jpg'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    shortcut: '/favicon-32.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#08080c',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
        <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-vault-bg text-vault-text`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
