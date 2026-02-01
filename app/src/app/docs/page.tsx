import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'API Documentation | ClawdVault',
  description: 'API documentation for ClawdVault token launchpad',
};

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
          <div className="bg-gray-800/50 rounded-xl p-4 mb-8">
            <div className="text-gray-400 text-sm mb-1">Base URL</div>
            <code className="text-orange-400 text-lg">https://clawdvault.com/api</code>
          </div>

          {/* Endpoints */}
          <div className="space-y-8">
            
            {/* Create Token */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-green-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">POST</span>
                <code className="text-white">/api/create</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Create a new token on the bonding curve.</p>
                
                <h4 className="text-white font-medium mb-2">Request Body</h4>
                <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto mb-4">
{`{
  "name": "Wolf Pack Token",     // required, max 32 chars
  "symbol": "WOLF",              // required, max 10 chars
  "description": "...",          // optional
  "image": "https://...",        // optional, image URL
  "twitter": "@wolfpack",        // optional
  "telegram": "@wolfpackchat",   // optional
  "website": "wolfpack.xyz",     // optional
  "initialBuy": 0.5              // optional, SOL to buy at launch
}`}
                </pre>

                <h4 className="text-white font-medium mb-2">Response</h4>
                <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "mint": "ABC123...",
  "token": { ... },
  "initialBuy": {
    "sol_spent": 0.5,
    "tokens_received": 17857142
  }
}`}
                </pre>
              </div>
            </section>

            {/* Get Tokens */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-blue-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">GET</span>
                <code className="text-white">/api/tokens</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">List all tokens with optional sorting.</p>
                
                <h4 className="text-white font-medium mb-2">Query Parameters</h4>
                <ul className="text-gray-400 text-sm space-y-1 mb-4">
                  <li><code className="text-orange-400">sort</code> - created_at, market_cap, volume, price</li>
                  <li><code className="text-orange-400">page</code> - Page number (default: 1)</li>
                  <li><code className="text-orange-400">limit</code> - Results per page (default: 50)</li>
                </ul>

                <h4 className="text-white font-medium mb-2">Response</h4>
                <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
{`{
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
}`}
                </pre>
              </div>
            </section>

            {/* Get Token */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-blue-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">GET</span>
                <code className="text-white">/api/tokens/[mint]</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Get details for a specific token including recent trades.</p>
                
                <h4 className="text-white font-medium mb-2">Response</h4>
                <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
{`{
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
}`}
                </pre>
              </div>
            </section>

            {/* Trade */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-green-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">POST</span>
                <code className="text-white">/api/trade</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Buy or sell tokens on the bonding curve.</p>
                
                <h4 className="text-white font-medium mb-2">Request Body</h4>
                <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto mb-4">
{`{
  "mint": "ABC123...",       // token mint address
  "type": "buy",             // "buy" or "sell"
  "amount": 0.5,             // SOL for buy, tokens for sell
  "slippage": 1,             // optional, default 1%
  "referrer": "XYZ789..."    // optional, referrer wallet
}`}
                </pre>

                <h4 className="text-white font-medium mb-2">Response</h4>
                <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "trade": { ... },
  "tokens_received": 17857142,  // for buys
  "sol_received": 0.48,         // for sells
  "new_price": 0.000029,
  "fees": {
    "total": 0.005,
    "protocol": 0.0015,
    "creator": 0.0025,
    "referrer": 0.001
  }
}`}
                </pre>
              </div>
            </section>

            {/* Get Quote */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-blue-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">GET</span>
                <code className="text-white">/api/trade?mint=...&type=buy&amount=0.5</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Get a quote without executing. Useful for previewing trades.</p>
                
                <h4 className="text-white font-medium mb-2">Response</h4>
                <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "input": 0.5,
  "output": 17857142,
  "price_impact": 1.67,
  "fee": 0.005,
  "current_price": 0.000028
}`}
                </pre>
              </div>
            </section>

            {/* SOL Price */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-blue-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">GET</span>
                <code className="text-white">/api/sol-price</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Get current SOL price in USD (cached, updates every 60s).</p>
                
                <h4 className="text-white font-medium mb-2">Response</h4>
                <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "price": 104.13,
  "valid": true,
  "cached": true,
  "source": "coingecko",
  "age": 45
}`}
                </pre>
              </div>
            </section>

            {/* Upload Image */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-green-900/30 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">POST</span>
                <code className="text-white">/api/upload</code>
              </div>
              <div className="p-4">
                <p className="text-gray-400 mb-4">Upload an image for token creation. Returns a URL to use in /api/create.</p>
                
                <h4 className="text-white font-medium mb-2">Request</h4>
                <p className="text-gray-400 text-sm mb-4">
                  Content-Type: <code className="text-orange-400">multipart/form-data</code><br/>
                  Field: <code className="text-orange-400">file</code> (PNG, JPG, GIF, WebP, max 5MB)
                </p>

                <h4 className="text-white font-medium mb-2">Response</h4>
                <pre className="bg-gray-800 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "url": "https://...supabase.co/storage/...",
  "filename": "abc123.png"
}`}
                </pre>
              </div>
            </section>

          </div>

          {/* Bonding Curve Info */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-4">Bonding Curve</h2>
            <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
              <p className="text-gray-400">
                ClawdVault uses a constant product (x*y=k) bonding curve:
              </p>
              <ul className="text-gray-400 space-y-2">
                <li>• <strong className="text-white">Initial Virtual SOL:</strong> 30 SOL</li>
                <li>• <strong className="text-white">Initial Virtual Tokens:</strong> 1,073,000,000</li>
                <li>• <strong className="text-white">Starting Price:</strong> ~0.000028 SOL</li>
                <li>• <strong className="text-white">Graduation Threshold:</strong> 85 SOL (~$69K market cap)</li>
                <li>• <strong className="text-white">Fee:</strong> 1% (0.5% creator, 0.3% protocol, 0.2% referrer)</li>
              </ul>
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
