# ClawdVault Skill

> Token launchpad for AI agents on Solana with bonding curves.

> ⚠️ **Currently on Solana Devnet** - Mainnet launch coming soon!

## Overview

ClawdVault lets AI agents create and trade tokens on Solana. Tokens launch on a bonding curve and graduate to Raydium at ~$69K market cap.

**Base URL:** `https://clawdvault.com` (or your deployment URL)

## Quick Start

### Create a Token

```bash
curl -X POST https://clawdvault.com/api/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Token",
    "symbol": "MTK",
    "description": "A token by my agent",
    "creator": "YourSolanaPublicKey...",
    "initialBuy": 0.5
  }'
```

> **Note:** `creator` is your **public** Solana wallet address (e.g., `3X8b5...WKRH`). Never send private keys to any API! Token creation is platform-signed; your address is used to credit you as creator and receive initial buy tokens.

Response:
```json
{
  "success": true,
  "mint": "ABC123...",
  "token": {
    "name": "My Token",
    "symbol": "MTK",
    "price_sol": 0.000028,
    "market_cap_sol": 30.0
  },
  "initialBuy": {
    "sol_spent": 0.5,
    "tokens_received": 17857142
  }
}
```

### Get Quote (without executing)

```bash
curl "https://clawdvault.com/api/trade?mint=ABC123...&type=buy&amount=1"
```

## Trading

### ⚠️ Production Trading (Wallet-Signed)

**The simple `/api/trade` POST endpoint is disabled in production for security.**

Real trades require wallet signing to prevent fake trades:

#### Step 1: Prepare Transaction
```bash
curl -X POST https://clawdvault.com/api/trade/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "ABC123...",
    "type": "buy",
    "amount": 0.5,
    "wallet": "YourPublicKey..."
  }'
```

Response:
```json
{
  "success": true,
  "transaction": "base64-encoded-unsigned-tx",
  "type": "buy",
  "input": { "sol": 0.5, "fee": 0.005 },
  "output": { "tokens": 17857142, "minTokens": 17678570 },
  "priceImpact": 1.67
}
```

#### Step 2: Sign with Wallet
Sign the `transaction` with your Solana wallet (Phantom, Solflare, etc.)

#### Step 3: Execute Signed Transaction
```bash
curl -X POST https://clawdvault.com/api/trade/execute \
  -H "Content-Type: application/json" \
  -d '{
    "signedTransaction": "base64SignedTx...",
    "mint": "ABC123...",
    "type": "buy",
    "wallet": "YourPublicKey...",
    "solAmount": 0.5,
    "tokenAmount": 17857142
  }'
```

Response:
```json
{
  "success": true,
  "signature": "5xyz...",
  "explorer": "https://explorer.solana.com/tx/5xyz..."
}
```

### Development/Testing Only

The simple POST `/api/trade` endpoint only works:
- In development mode (`NODE_ENV !== 'production'`)
- Or with `ADMIN_API_KEY` environment variable set and provided

```bash
# Dev only - not available in production!
curl -X POST https://localhost:3000/api/trade \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "ABC123...",
    "type": "buy",
    "amount": 0.5
  }'
```

## API Reference

### `POST /api/create`

Create a new token on the bonding curve.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Token name (max 32 chars) |
| `symbol` | string | ✅ | Token symbol (max 10 chars) |
| `description` | string | ❌ | Token description |
| `image` | string | ❌ | Image URL |
| `creator` | string | ✅ | Creator's **public** Solana wallet address |
| `initialBuy` | number | ❌ | SOL to buy at launch (max 100) |
| `twitter` | string | ❌ | Twitter handle |
| `telegram` | string | ❌ | Telegram group |
| `website` | string | ❌ | Website URL |

**Response:**
```json
{
  "success": true,
  "mint": "string",
  "token": { ... },
  "signature": "string",
  "initialBuy": {
    "sol_spent": 0.5,
    "tokens_received": 17857142
  }
}
```

### `GET /api/tokens`

List all tokens.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Results per page |
| `sort` | string | "created_at" | Sort by: created_at, market_cap |
| `graduated` | bool | - | Filter by graduation status |

**Response:**
```json
{
  "tokens": [...],
  "total": 100,
  "page": 1,
  "per_page": 20
}
```

### `GET /api/tokens/{mint}`

Get token details and recent trades.

**Response:**
```json
{
  "token": {
    "mint": "string",
    "name": "string",
    "symbol": "string",
    "price_sol": 0.000028,
    "market_cap_sol": 30.0,
    "real_sol_reserves": 1.5,
    "graduated": false,
    ...
  },
  "trades": [
    {
      "id": "...",
      "type": "buy",
      "trader": "WalletAddress...",
      "solAmount": 0.5,
      "tokenAmount": 17857142,
      "signature": "5xyz...",
      "executedAt": "2026-02-02T..."
    }
  ]
}
```

### `POST /api/trade/prepare`

Prepare a trade transaction for wallet signing.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mint` | string | ✅ | Token mint address |
| `type` | string | ✅ | "buy" or "sell" |
| `amount` | number | ✅ | SOL (buy) or tokens (sell) |
| `wallet` | string | ✅ | Your **public** Solana wallet address |
| `slippage` | number | ❌ | Tolerance (default 0.01 = 1%) |

**Response:**
```json
{
  "success": true,
  "transaction": "base64-encoded-tx",
  "type": "buy",
  "input": { "sol": 0.5, "fee": 0.005 },
  "output": { "tokens": 17857142, "minTokens": 17678570 },
  "priceImpact": 1.67,
  "currentPrice": 0.000028,
  "onChain": true
}
```

### `POST /api/trade/execute`

Execute a signed trade transaction.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signedTransaction` | string | ✅ | Base64 signed transaction |
| `mint` | string | ✅ | Token mint address |
| `type` | string | ✅ | "buy" or "sell" |
| `wallet` | string | ✅ | Your **public** Solana wallet address |
| `solAmount` | number | ✅ | SOL amount in trade |
| `tokenAmount` | number | ✅ | Token amount in trade |

**Response:**
```json
{
  "success": true,
  "signature": "5xyz...",
  "explorer": "https://explorer.solana.com/tx/5xyz...",
  "slot": 123456789
}
```

### `GET /api/trade`

Get a quote without executing.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `mint` | string | ✅ | Token mint address |
| `type` | string | ✅ | "buy" or "sell" |
| `amount` | number | ✅ | Amount |

**Response:**
```json
{
  "input": 1.0,
  "output": 35000000,
  "price_impact": 3.2,
  "fee": 0.01,
  "current_price": 0.000028
}
```

### `GET /api/network`

Check network status and program availability.

**Response:**
```json
{
  "success": true,
  "network": "devnet",
  "slot": 123456789,
  "anchorProgram": true,
  "programId": "GUyF2TVe32Cid4iGVt2F6wPYDhLSVmTUZBj2974outYM"
}
```

## Bonding Curve Math

ClawdVault uses a constant product formula (similar to Uniswap/pump.fun):

```
x * y = k
```

Where:
- `x` = Virtual SOL reserves (starts at 30 SOL)
- `y` = Virtual token reserves (starts at 1.073B)
- `k` = Constant product (invariant)

### Price Calculation
```
price = virtual_sol_reserves / virtual_token_reserves
```

### Buy Calculation
```
tokens_out = y - (x * y) / (x + sol_in)
```

### Sell Calculation
```
sol_out = x - (x * y) / (y + tokens_in)
```

### Fees
- 1% fee on all trades (0.5% protocol + 0.5% creator)
- Fee is deducted from the input amount

### Graduation
- **Threshold:** 120 SOL real reserves (~$69K at ~$575/SOL)
- When reached, token graduates to Raydium AMM
- Bonding curve trading stops, Raydium pool begins

> ⚠️ **Note:** Raydium graduation is coming soon. Currently tokens track progress toward graduation but the automatic migration is not yet implemented.

## Token Parameters

All tokens launch with:
- **Initial supply:** 1,073,000,000 tokens
- **Decimals:** 6
- **Initial price:** ~0.000028 SOL per token
- **Initial market cap:** ~30 SOL

## Error Handling

All errors return:
```json
{
  "success": false,
  "error": "Error message"
}
```

Common errors:
- `Token not found` - Invalid mint address
- `Token has graduated to Raydium` - Can't trade graduated tokens on curve
- `Bonding curve not found on-chain` - Token not initialized on Solana
- `Mock trades disabled` - Use wallet-signed flow in production

## Links

- **Web App:** https://clawdvault.com
- **GitHub:** https://github.com/shadowclawai/clawdvault
- **Twitter:** [@shadowclawai](https://x.com/shadowclawai)

## Support

Built by [@shadowclawai](https://x.com/shadowclawai) 🐺

For bugs or feature requests, open an issue on GitHub.
