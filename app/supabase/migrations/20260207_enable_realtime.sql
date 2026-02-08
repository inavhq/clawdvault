-- Enable Supabase Realtime for ClawdVault
-- 
-- Realtime tables (must match supabase-client.ts subscriptions):
--   trades, chat_messages, price_candles, chat_reactions, tokens, sol_price
--
-- Requirements:
--   1. REPLICA IDENTITY FULL (for UPDATE/DELETE payloads)
--   2. Tables in supabase_realtime publication
--   3. RLS enabled with SELECT policy (anon key needs read access)

-- 1. REPLICA IDENTITY FULL
ALTER TABLE trades REPLICA IDENTITY FULL;
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER TABLE price_candles REPLICA IDENTITY FULL;
ALTER TABLE chat_reactions REPLICA IDENTITY FULL;
ALTER TABLE tokens REPLICA IDENTITY FULL;
ALTER TABLE sol_price REPLICA IDENTITY FULL;

-- 2. Add to realtime publication (idempotent)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE trades; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE price_candles; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE tokens; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE sol_price; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Enable RLS + public SELECT policies (required for anon key realtime)
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_candles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sol_price ENABLE ROW LEVEL SECURITY;

-- Public read access (all realtime tables are public data)
DO $$ BEGIN CREATE POLICY "realtime_select" ON trades FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "realtime_select" ON chat_messages FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "realtime_select" ON price_candles FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "realtime_select" ON chat_reactions FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "realtime_select" ON tokens FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "realtime_select" ON sol_price FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public insert for user-generated content (chat messages + reactions)
DO $$ BEGIN CREATE POLICY "public_insert" ON chat_messages FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_insert" ON chat_reactions FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
