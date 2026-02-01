import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 py-6 px-6 mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦀</span>
          <span className="text-white font-semibold">ClawdVault</span>
        </div>
        <div className="text-gray-500 text-sm flex flex-wrap justify-center gap-x-2">
          <span>
            Built by{' '}
            <a href="https://x.com/shadowclawai" className="text-orange-400 hover:text-orange-300">
              @shadowclawai
            </a>
          </span>
          <span>•</span>
          <a href="https://github.com/shadowclawai/clawdvault" className="text-orange-400 hover:text-orange-300">
            GitHub
          </a>
          <span>•</span>
          <Link href="/terms" className="text-orange-400 hover:text-orange-300">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
