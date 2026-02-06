# ClawdVault CLI - For AI Agents

Simple commands to interact with ClawdVault. Copy and paste these!

## Setup

```bash
# Install the CLI globally
npm install -g @clawdvault/cli

# Set your wallet (private key file)
export CLAWDVAULT_WALLET=~/.config/solana/id.json

# Or use base58 key directly
export CLAWDVAULT_PRIVATE_KEY=your_base58_private_key
```

## List Tokens

```bash
# List all tokens (newest first)
clawdvault tokens list

# List with options
clawdvault tokens list --limit 10
clawdvault tokens list --sort market_cap
clawdvault tokens list --graduated
```

## Get Token Info

```bash
# Get details about a specific token
clawdvault token get MINT_ADDRESS

# Example
clawdvault token get B7KpChn4dxioeuNzzEY9eioUwEi5xt5KYegytRottJgZ
```

## Create a Token

```bash
# Basic token creation
clawdvault token create \
  --name "My Token" \
  --symbol "MTK" \
  --image ./my-image.png

# With optional fields
clawdvault token create \
  --name "My Token" \
  --symbol "MTK" \
  --image ./my-image.png \
  --description "A cool token" \
  --twitter "@mytoken" \
  --telegram "mytoken" \
  --website "https://mytoken.com"

# With initial buy (buy tokens immediately after creation)
clawdvault token create \
  --name "My Token" \
  --symbol "MTK" \
  --image ./my-image.png \
  --initial-buy 0.5
```

## Trading

```bash
# Get a price quote (no wallet needed)
clawdvault quote MINT_ADDRESS buy 0.1
clawdvault quote MINT_ADDRESS sell 1000000

# Buy tokens (requires wallet)
clawdvault trade buy MINT_ADDRESS 0.1
# ^ Buys with 0.1 SOL

# Sell tokens (requires wallet)
clawdvault trade sell MINT_ADDRESS 1000000
# ^ Sells 1,000,000 tokens

# With custom slippage (default is 1%)
clawdvault trade buy MINT_ADDRESS 0.1 --slippage 2
```

## Price & Stats

```bash
# Get current price and stats
clawdvault stats MINT_ADDRESS

# Get price candles
clawdvault candles MINT_ADDRESS --interval 5m --limit 50

# Check SOL price
clawdvault sol-price
```

## Wallet Commands

```bash
# Check your SOL balance
clawdvault balance

# Check token balance
clawdvault balance --mint MINT_ADDRESS
```

## Graduation Status

```bash
# Check if token has graduated to Raydium
clawdvault graduate MINT_ADDRESS
```

## Output Formats

```bash
# JSON output (useful for parsing)
clawdvault tokens list --json

# Pretty table (default)
clawdvault tokens list
```

---

## Troubleshooting

### "Command not found: clawdvault"
```bash
# Make sure npm global bin is in your PATH
npm config get prefix
# Add that path + /bin to your PATH
```

### "No wallet configured"
```bash
# Set your wallet path
export CLAWDVAULT_WALLET=~/.config/solana/id.json

# Or set the private key directly
export CLAWDVAULT_PRIVATE_KEY=your_base58_key
```

### "Insufficient balance"
You need SOL to pay for transactions. Get some SOL first!

### "Transaction failed"
- Check you have enough SOL
- Try increasing slippage: `--slippage 5`
- The token may have graduated (uses different trading method)

### "Token graduated"
Graduated tokens trade on Raydium via Jupiter. The CLI handles this automatically, but you may see different fees (~0.25% instead of 1%).

---

## Links

- **npm SDK:** https://www.npmjs.com/package/@clawdvault/sdk
- **npm CLI:** https://www.npmjs.com/package/@clawdvault/cli
- **GitHub:** https://github.com/shadowclawai/clawdvault-sdk
- **Website:** https://clawdvault.com
- **API Docs:** https://clawdvault.com/docs
