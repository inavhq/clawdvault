-- Enable REPLICA IDENTITY FULL on all tables used by realtime subscriptions
-- Required for Supabase Realtime postgres_changes to work properly
ALTER TABLE trades REPLICA IDENTITY FULL;
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER TABLE price_candles REPLICA IDENTITY FULL;
ALTER TABLE chat_reactions REPLICA IDENTITY FULL;
ALTER TABLE tokens REPLICA IDENTITY FULL;
ALTER TABLE sol_price REPLICA IDENTITY FULL;

-- Ensure all tables are in the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE trades, chat_messages, price_candles, chat_reactions, tokens, sol_price;
