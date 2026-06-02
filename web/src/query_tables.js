const supabaseUrl = 'https://zsuxkwzcyulnlhkignrh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdXhrd3pjeXVsbmxoa2lnbnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjc1NzIsImV4cCI6MjA5NDc0MzU3Mn0.aHqY5iBTf9uq61cav6e1848Lps6XunSwdHrJiyPQV4o';

async function run() {
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/pull_watermelondb_changes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ last_pulled_at: 0 })
    });
    
    const data = await res.json();
    const orders = data.changes.orders.created.concat(data.changes.orders.updated);
    console.log('Total Orders in Supabase:', orders.length);
    console.log('Order Details:');
    orders.forEach(o => {
      console.log(`- ${o.invoice_number}: ${o.status} | Total: ${o.total_amount}`);
    });
  } catch (err) {
    console.error('Error calling RPC:', err);
  }
}

run();
