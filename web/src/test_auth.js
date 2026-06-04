const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zsuxkwzcyulnlhkignrh.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdXhrd3pjeXVsbmxoa2lnbnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjc1NzIsImV4cCI6MjA5NDc0MzU3Mn0.aHqY5iBTf9uq61cav6e1848Lps6XunSwdHrJiyPQV4o';
global.WebSocket = class {
  constructor() {}
  addEventListener() {}
  removeEventListener() {}
};

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function run() {
  const phone = '717133074';
  const otp = '11111';

  console.log('1. Checking phone number on Vercel backend...');
  try {
    const checkRes = await fetch('https://mini-pos-sync-server.vercel.app/api/v1/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone }),
    });

    if (!checkRes.ok) {
      console.error('Check failed:', await checkRes.text());
      return;
    }

    const checkData = await checkRes.json();
    console.log('Check response:', checkData);
    const token = checkData.token;

    console.log('2. Verifying OTP...');
    const verifyRes = await fetch('https://mini-pos-sync-server.vercel.app/api/v1/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: otp, phone_number: phone }),
    });

    if (!verifyRes.ok) {
      console.error('Verify failed:', await verifyRes.text());
      return;
    }

    const verifyData = await verifyRes.json();
    console.log('Verify response:', verifyData);

    const jwt = token;
    const parts = jwt.split('.');
    if (parts.length === 3) {
      const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
      console.log('JWT Payload:', JSON.parse(payload));
    }

    console.log('3. Trying to set session in Supabase...');
    const { data, error } = await supabase.auth.setSession({
      access_token: jwt,
      refresh_token: '',
    });

    if (error) {
      console.error('Supabase setSession failed:', error);
    } else {
      console.log('Supabase setSession succeeded! Session:', data);
    }
  } catch (err) {
    console.error('Error during test:', err);
  }
}

run();
