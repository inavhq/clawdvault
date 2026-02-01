# ClawdVault API Skill

> Token launchpad for AI agents. Create and trade tokens on a bonding curve.

## Base URL
```
https://clawdvault.com/api
```

## Quick Start

### Create a Token
```bash
curl -X POST https://clawdvault.com/api/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Token",
    "symbol": "TOKEN",
    "description": "A cool token",
    "initialBuy": 0.1
  }'
```

### Buy Tokens
```bash
curl -X POST https://clawdvault.com/api/trade \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "TOKEN_MINT_ADDRESS",
    "type": "buy",
    "amount": 0.5
  }'
```

### Sell Tokens
```bash
curl -X POST https://clawdvault.com/api/trade \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "TOKEN_MINT_ADDRESS",
    "type": "sell",
    "amount": 1000000
  }'
```

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/create` | Create new token |
| GET | `/api/tokens` | List all tokens |
| GET | `/api/tokens/[mint]` | Get token details |
| POST | `/api/trade` | Buy or sell tokens |
| GET | `/api/trade?mint=X&type=buy&amount=0.5` | Get quote |
| GET | `/api/sol-price` | Get SOL/USD price |
| POST | `/api/upload` | Upload token image |

## Create Token

**POST** `/api/create`

```json
{
  "name": "Token Name",        // required, max 32 chars
  "symbol": "TKN",             // required, max 10 chars  
  "description": "...",        // optional
  "image": "https://...",      // optional
  "twitter": "@handle",        // optional
  "telegram": "@group",        // optional
  "website": "example.com",    // optional
  "initialBuy": 0.5            // optional, SOL to buy at launch
}
```

**Response:**
```json
{
  "success": true,
  "mint": "ABC123...",
  "token": { ... }
}
```

## Trade

**POST** `/api/trade`

```json
{
  "mint": "TOKEN_MINT",
  "type": "buy",           // "buy" or "sell"
  "amount": 0.5,           // SOL for buy, tokens for sell
  "referrer": "WALLET"     // optional, earns 0.2% fee
}
```

**Response:**
```json
{
  "success": true,
  "tokens_received": 17857142,
  "new_price": 0.000029
}
```

## Get Quote (Preview)

**GET** `/api/trade?mint=X&type=buy&amount=0.5`

```json
{
  "input": 0.5,
  "output": 17857142,
  "price_impact": 1.67,
  "fee": 0.005
}
```

## Token Object

```json
{
  "mint": "ABC123...",
  "name": "Token Name",
  "symbol": "TKN",
  "description": "...",
  "image": "https://...",
  "price_sol": 0.000028,
  "market_cap_sol": 30.5,
  "virtual_sol_reserves": 30,
  "virtual_token_reserves": 1073000000,
  "graduated": false,
  "twitter": "@handle",
  "telegram": "@group",
  "website": "example.com"
}
```

## Bonding Curve

- **Formula:** x * y = k (constant product)
- **Initial SOL:** 30 (virtual)
- **Initial Tokens:** 1,073,000,000
- **Starting Price:** ~0.000028 SOL
- **Graduation:** 85 SOL raised (~$69K market cap)
- **Fee:** 1% total (0.5% creator, 0.3% protocol, 0.2% referrer)

## Price Calculation

```
price = virtual_sol_reserves / virtual_token_reserves
market_cap = price * 1,073,000,000
```

## Tips for Agents

1. **Always check `success`** in responses before using data
2. **Use `/api/trade` GET** to preview before executing trades
3. **Upload images first** via `/api/upload`, then use URL in create
4. **Include referrer** to earn 0.2% on trades you facilitate
5. **Monitor graduation** - tokens migrate to Raydium at 85 SOL raised

## Rate Limits

- No authentication required
- Be reasonable with request frequency
- SOL price is cached for 60s server-side

## Links

- **App:** https://clawdvault.com
- **Docs:** https://clawdvault.com/docs
- **GitHub:** https://github.com/shadowclawai/clawdvault
- **Twitter:** https://x.com/shadowclawai
