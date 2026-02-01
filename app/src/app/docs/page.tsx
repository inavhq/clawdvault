import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'API Documentation | ClawdVault',
  description: 'API documentation for ClawdVault token launchpad',
};

// Code block component for consistent styling
function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-700 mb-4">
      {title && (
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
          <span className="text-gray-400 text-xs font-mono">{title}</span>
        </div>
      )}
      <pre className="bg-[#0d1117] p-4 text-sm overflow-x-auto">
        <code className="text-[#e6edf3] font-mono leading-relaxed">{children}</code>
      </pre>
    </div>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />

      <section className="py-12 px-6 flex-1">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">API Documentation</h1>
          <p className="text-gray-400 mb-8">
            Build integrations with ClawdVault. Perfect for AI agents, bots, and developers.
          </p>

          {/* Base URL */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-8 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Base URL</div>
            <code className="text-orange-400 text-lg font-mono">https://clawdvault.com/api</code>
          </div>

          {/* Endpoints */}
          <div className="space-y-8">
            
            {/* Create Token */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-green-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">POST</span>
                <code className="text-white font-mono">/api/create</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Create a new token on the bonding curve.</p>
                
                <h4 className="text-white font-medium mb-2">Request Body</h4>
                <CodeBlock title="JSON">{`{
  "name": "Wolf Pack Token",
  "symbol": "WOLF",
  "description": "...",
  "image": "https://...",
  "twitter": "@wolfpack",
  "telegram": "@wolfpackchat",
  "website": "wolfpack.xyz",
  "initialBuy": 0.5
}`}</CodeBlock>
                <ul className="text-gray-400 text-sm space-y-1 mb-4 ml-4">
                  <li><code className="text-cyan-400">name</code> <span className="text-red-400">required</span> — max 32 chars</li>
                  <li><code className="text-cyan-400">symbol</code> <span className="text-red-400">required</span> — max 10 chars</li>
                  <li><code className="text-cyan-400">description</code> <span className="text-gray-500">optional</span></li>
                  <li><code className="text-cyan-400">image</code> <span className="text-gray-500">optional</span> — image URL</li>
                  <li><code className="text-cyan-400">twitter</code> <span className="text-gray-500">optional</span></li>
                  <li><code className="text-cyan-400">telegram</code> <span className="text-gray-500">optional</span></li>
                  <li><code className="text-cyan-400">website</code> <span className="text-gray-500">optional</span></li>
                  <li><code className="text-cyan-400">initialBuy</code> <span className="text-gray-500">optional</span> — SOL to buy at launch</li>
                </ul>

                <h4 className="text-white font-medium mb-2">Response</h4>
                <CodeBlock title="JSON">{`{
  "success": true,
  "mint": "ABC123...",
  "token": { ... },
  "initialBuy": {
    "sol_spent": 0.5,
    "tokens_received": 17857142
  }
}`}</CodeBlock>
              </div>
            </section>

            {/* Get Tokens */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-blue-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">GET</span>
                <code className="text-white font-mono">/api/tokens</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">List all tokens with optional sorting.</p>
                
                <h4 className="text-white font-medium mb-2">Query Parameters</h4>
                <ul className="text-gray-400 text-sm space-y-1 mb-4 ml-4">
                  <li><code className="text-cyan-400">sort</code> — created_at, market_cap, volume, price</li>
                  <li><code className="text-cyan-400">page</code> — Page number (default: 1)</li>
                  <li><code className="text-cyan-400">limit</code> — Results per page (default: 50)</li>
                </ul>

                <h4 className="text-white font-medium mb-2">Response</h4>
                <CodeBlock title="JSON">{`{
  "tokens": [
    {
      "mint": "ABC123...",
      "name": "Wolf Pack Token",
      "symbol": "WOLF",
      "price_sol": 0.000028,
      "market_cap_sol": 30.5,
      "volume_24h": 5.2,
      ...
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 50
}`}</CodeBlock>
              </div>
            </section>

            {/* Get Token */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-blue-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">GET</span>
                <code className="text-white font-mono">/api/tokens/[mint]</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Get details for a specific token including recent trades.</p>
                
                <h4 className="text-white font-medium mb-2">Response</h4>
                <CodeBlock title="JSON">{`{
  "token": {
    "mint": "ABC123...",
    "name": "Wolf Pack Token",
    "symbol": "WOLF",
    "description": "...",
    "image": "https://...",
    "price_sol": 0.000028,
    "market_cap_sol": 30.5,
    "virtual_sol_reserves": 30,
    "virtual_token_reserves": 1073000000,
    "graduated": false,
    ...
  },
  "trades": [ ... ]
}`}</CodeBlock>
              </div>
            </section>

            {/* Trade */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-green-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">POST</span>
                <code className="text-white font-mono">/api/trade</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Buy or sell tokens on the bonding curve.</p>
                
                <h4 className="text-white font-medium mb-2">Request Body</h4>
                <CodeBlock title="JSON">{`{
  "mint": "ABC123...",
  "type": "buy",
  "amount": 0.5,
  "slippage": 1,
  "referrer": "XYZ789..."
}`}</CodeBlock>
                <ul className="text-gray-400 text-sm space-y-1 mb-4 ml-4">
                  <li><code className="text-cyan-400">mint</code> <span className="text-red-400">required</span> — token mint address</li>
                  <li><code className="text-cyan-400">type</code> <span className="text-red-400">required</span> — &quot;buy&quot; or &quot;sell&quot;</li>
                  <li><code className="text-cyan-400">amount</code> <span className="text-red-400">required</span> — SOL for buy, tokens for sell</li>
                  <li><code className="text-cyan-400">slippage</code> <span className="text-gray-500">optional</span> — default 1%</li>
                  <li><code className="text-cyan-400">referrer</code> <span className="text-gray-500">optional</span> — referrer wallet</li>
                </ul>

                <h4 className="text-white font-medium mb-2">Response</h4>
                <CodeBlock title="JSON">{`{
  "success": true,
  "trade": { ... },
  "tokens_received": 17857142,
  "sol_received": 0.48,
  "new_price": 0.000029,
  "fees": {
    "total": 0.005,
    "protocol": 0.0015,
    "creator": 0.0025,
    "referrer": 0.001
  }
}`}</CodeBlock>
              </div>
            </section>

            {/* Get Quote */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-blue-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">GET</span>
                <code className="text-white font-mono">/api/trade?mint=...&amp;type=buy&amp;amount=0.5</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Get a quote without executing. Useful for previewing trades.</p>
                
                <h4 className="text-white font-medium mb-2">Response</h4>
                <CodeBlock title="JSON">{`{
  "input": 0.5,
  "output": 17857142,
  "price_impact": 1.67,
  "fee": 0.005,
  "current_price": 0.000028
}`}</CodeBlock>
              </div>
            </section>

            {/* SOL Price */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-blue-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">GET</span>
                <code className="text-white font-mono">/api/sol-price</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Get current SOL price in USD (cached, updates every 60s).</p>
                
                <h4 className="text-white font-medium mb-2">Response</h4>
                <CodeBlock title="JSON">{`{
  "price": 104.13,
  "valid": true,
  "cached": true,
  "source": "coingecko",
  "age": 45
}`}</CodeBlock>
              </div>
            </section>

            {/* Upload Image */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-green-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">POST</span>
                <code className="text-white font-mono">/api/upload</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Upload an image for token creation. Returns a URL to use in /api/create.</p>
                
                <h4 className="text-white font-medium mb-2">Request</h4>
                <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-4 mb-4">
                  <p className="text-[#e6edf3] text-sm font-mono">
                    Content-Type: <span className="text-orange-400">multipart/form-data</span><br/>
                    Field: <span className="text-cyan-400">file</span> <span className="text-gray-500">(PNG, JPG, GIF, WebP, max 5MB)</span>
                  </p>
                </div>

                <h4 className="text-white font-medium mb-2">Response</h4>
                <CodeBlock title="JSON">{`{
  "success": true,
  "url": "https://...supabase.co/storage/...",
  "filename": "abc123.png"
}`}</CodeBlock>
              </div>
            </section>

          </div>

          {/* Bonding Curve Info */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-4">Bonding Curve</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              <p className="text-gray-400">
                ClawdVault uses a constant product (x*y=k) bonding curve:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-4">
                  <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Initial Virtual SOL</div>
                  <div className="text-white text-lg font-mono">30 SOL</div>
                </div>
                <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-4">
                  <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Initial Virtual Tokens</div>
                  <div className="text-white text-lg font-mono">1,073,000,000</div>
                </div>
                <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-4">
                  <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Starting Price</div>
                  <div className="text-white text-lg font-mono">~0.000028 SOL</div>
                </div>
                <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-4">
                  <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Graduation Threshold</div>
                  <div className="text-white text-lg font-mono">85 SOL <span className="text-gray-500 text-sm">(~$69K mcap)</span></div>
                </div>
              </div>
              <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-4 mt-4">
                <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Fee Breakdown</div>
                <div className="flex gap-4 text-sm font-mono">
                  <span className="text-white">1% total</span>
                  <span className="text-gray-500">→</span>
                  <span className="text-green-400">0.5% creator</span>
                  <span className="text-gray-500">|</span>
                  <span className="text-orange-400">0.3% protocol</span>
                  <span className="text-gray-500">|</span>
                  <span className="text-blue-400">0.2% referrer</span>
                </div>
              </div>
            </div>
          </div>

          {/* For AI Agents */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-4">For AI Agents 🤖</h2>
            <p className="text-gray-400 mb-4">
              Check out our <Link href="/SKILL.md" className="text-orange-400 hover:text-orange-300">SKILL.md</Link> file 
              for a concise reference designed for AI agents and LLMs.
            </p>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-800">
            <Link href="/" className="text-orange-400 hover:text-orange-300 transition">
              ← Back to Home
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
