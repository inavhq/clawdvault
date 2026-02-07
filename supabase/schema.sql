-- ClawdVault Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TOKENS TABLE
-- ============================================
CREATE TABLE tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mint TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image TEXT,
  
  -- Creator info
  creator TEXT NOT NULL,
  creator_name TEXT,
  
  -- Bonding curve state
  virtual_sol_reserves DECIMAL(20, 9) NOT NULL DEFAULT 30.0,
  virtual_token_reserves DECIMAL(20, 0) NOT NULL DEFAULT 1073000000,
  real_sol_reserves DECIMAL(20, 9) NOT NULL DEFAULT 0,
  real_token_reserves DECIMAL(20, 0) NOT NULL DEFAULT 1073000000,
  
  -- Status
  graduated BOOLEAN NOT NULL DEFAULT FALSE,
  raydium_pool TEXT,
  
  -- Social links
  twitter TEXT,
  telegram TEXT,
  website TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX idx_tokens_created_at ON tokens(created_at DESC);
CREATE INDEX idx_tokens_creator ON tokens(creator);
CREATE INDEX idx_tokens_graduated ON tokens(graduated);

-- ============================================
-- TRADES TABLE
-- ============================================
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  token_mint TEXT NOT NULL,
  
  trader TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  
  sol_amount DECIMAL(20, 9) NOT NULL,
  token_amount DECIMAL(20, 0) NOT NULL,
  price_sol DECIMAL(30, 18) NOT NULL,
  
  signature TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for queries
CREATE INDEX idx_trades_token_id ON trades(token_id);
CREATE INDEX idx_trades_token_mint ON trades(token_mint);
CREATE INDEX idx_trades_trader ON trades(trader);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);

-- ============================================
-- AGENTS TABLE (for API keys)
-- ============================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet TEXT UNIQUE NOT NULL,
  name TEXT,
  api_key TEXT UNIQUE NOT NULL,
  
  -- Verification
  moltbook_verified BOOLEAN DEFAULT FALSE,
  moltx_verified BOOLEAN DEFAULT FALSE,
  twitter_handle TEXT,
  
  -- Stats (updated via triggers/functions)
  tokens_created INTEGER DEFAULT 0,
  total_volume DECIMAL(20, 9) DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_api_key ON agents(api_key);
CREATE INDEX idx_agents_wallet ON agents(wallet);

-- ============================================
-- TOKEN STATS VIEW (computed fields)
-- ============================================
CREATE OR REPLACE VIEW token_stats AS
SELECT 
  t.id,
  t.mint,
  t.name,
  t.symbol,
  t.description,
  t.image,
  t.creator,
  t.creator_name,
  t.virtual_sol_reserves,
  t.virtual_token_reserves,
  t.real_sol_reserves,
  t.real_token_reserves,
  t.graduated,
  t.raydium_pool,
  t.created_at,
  
  -- Computed price
  (t.virtual_sol_reserves / t.virtual_token_reserves) AS price_sol,
  
  -- Computed market cap (price * total supply)
  (t.virtual_sol_reserves / t.virtual_token_reserves * 1073000000) AS market_cap_sol,
  
  -- 24h volume
  COALESCE(
    (SELECT SUM(sol_amount) FROM trades 
     WHERE token_mint = t.mint 
     AND created_at > NOW() - INTERVAL '24 hours'),
    0
  ) AS volume_24h,
  
  -- 24h trade count
  COALESCE(
    (SELECT COUNT(*) FROM trades 
     WHERE token_mint = t.mint 
     AND created_at > NOW() - INTERVAL '24 hours'),
    0
  ) AS trades_24h,
  
  -- Holder count (unique traders)
  COALESCE(
    (SELECT COUNT(DISTINCT trader) FROM trades WHERE token_mint = t.mint),
    1
  ) AS holders

FROM tokens t;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tokens
CREATE TRIGGER tokens_updated_at
  BEFORE UPDATE ON tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger for agents
CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Generate API key function
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
BEGIN
  RETURN 'cv_' || encode(gen_random_bytes(24), 'hex');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Public read access for tokens
CREATE POLICY "Tokens are viewable by everyone" 
  ON tokens FOR SELECT 
  USING (true);

-- Public read access for trades
CREATE POLICY "Trades are viewable by everyone" 
  ON trades FOR SELECT 
  USING (true);

-- Service role can do everything
CREATE POLICY "Service role has full access to tokens"
  ON tokens FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to trades"
  ON trades FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to agents"
  ON agents FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- SEED DATA (optional test tokens)
-- ============================================

-- Uncomment to add test data:
/*
INSERT INTO tokens (mint, name, symbol, description, creator, creator_name)
VALUES 
  ('TEST1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'Test Token 1', 'TEST1', 'First test token', 'anonymous', 'Anonymous'),
  ('TEST2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'Test Token 2', 'TEST2', 'Second test token', 'anonymous', 'Anonymous');
*/

-- Done!
SELECT 'ClawdVault schema created successfully! 🔐' as status;
