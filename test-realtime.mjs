import { createClient } from '@supabase/supabase-js';

const url = 'https://swbriwqaskacaxqfnmvk.supabase.co';
const key = 'sb_publishable_ODw2wjEVuRqLdNMEL_m2XQ_kEAjvpVE';

const client = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } }
});

const tables = ['trades', 'chat_messages', 'price_candles', 'chat_reactions', 'tokens', 'sol_price'];

for (const table of tables) {
  const channel = client
    .channel(`test-${table}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        console.log(`[${table}] Event:`, payload.eventType, payload.new?.id || '');
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ ${table}: SUBSCRIBED`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`❌ ${table}: ${status}`, err?.message || '');
      } else {
        console.log(`⏳ ${table}: ${status}`);
      }
    });
}

console.log('Listening for 15 seconds...');
setTimeout(() => {
  console.log('Done.');
  process.exit(0);
}, 15000);
