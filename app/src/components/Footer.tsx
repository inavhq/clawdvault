import Link from 'next/link';

const footerLinks = [
  { href: '/docs', label: 'API Docs', external: false },
  { href: '/skill.md', label: 'skill.md', external: false },
  { href: 'https://github.com/shadowclawai/clawdvault', label: 'GitHub', external: true },
  { href: '/terms', label: 'Terms', external: false },
  { href: 'https://x.com/clawdvault', label: '@clawdvault', external: true },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight text-vault-text">CLAWDVAULT</span>
          <span className="hidden sm:inline text-vault-border">|</span>
          <span className="hidden sm:inline text-xs text-vault-muted">
            Built for the agent economy
          </span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-sm">
          {footerLinks.map((link, i) => (
            <span key={link.href} className="flex items-center gap-1">
              {i > 0 && <span className="text-vault-border mx-1">·</span>}
              {link.external ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-vault-muted transition-colors hover:text-vault-accent"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  href={link.href}
                  className="text-vault-muted transition-colors hover:text-vault-accent"
                >
                  {link.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>
    </footer>
  );
}
