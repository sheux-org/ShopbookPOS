/**
 * RevenueCat webhook → Supabase `subscriptions`.
 *
 * Deploy with:  supabase functions deploy revenuecat-webhook --no-verify-jwt
 * (RevenueCat does not send a Supabase JWT.)
 *
 * Secrets:
 *   RC_WEBHOOK_AUTH       shared Authorization header value  (required)
 *   RC_WEBHOOK_SIGNING_SECRET  HMAC signing secret            (optional, preferred)
 *   RC_SECRET_API_KEY     RevenueCat v1 secret key            (required)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
 *
 * Design note — this handler is deliberately EVENT-TYPE-AGNOSTIC. Rather than
 * interpreting INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION /
 * TRANSFER / refunds separately, it re-fetches the subscriber from the
 * RevenueCat REST API and writes whatever the current truth is. That makes it
 * correct under out-of-order delivery, retries and promotional grants with a
 * single code path, at the cost of one REST call per event.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RC_WEBHOOK_AUTH = Deno.env.get('RC_WEBHOOK_AUTH') ?? '';
const RC_WEBHOOK_SIGNING_SECRET = Deno.env.get('RC_WEBHOOK_SIGNING_SECRET') ?? '';
const RC_SECRET_API_KEY = Deno.env.get('RC_SECRET_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const ENTITLEMENT_ID = 'shopbook_pos_pro';
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Length-safe, timing-safe string compare. */
function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  // Compare lengths without early-return by folding into the accumulator.
  let diff = ab.length ^ bb.length;
  const max = Math.max(ab.length, bb.length);
  for (let i = 0; i < max; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify `X-RevenueCat-Webhook-Signature: t=<unix>,v1=<hmac-sha256>`.
 * The HMAC covers "{timestamp}.{raw body}" and MUST be computed over the raw
 * bytes as received — re-serialising parsed JSON changes them.
 */
async function verifySignature(rawBody: string, header: string): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    })
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) return false;

  const ts = Number(parts.t);
  if (!Number.isFinite(ts)) return false;
  // RevenueCat sends seconds; tolerate a signed replay window either side.
  if (Math.abs(Date.now() - ts * 1000) > SIGNATURE_TOLERANCE_MS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(RC_WEBHOOK_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${parts.t}.${rawBody}`)
  );

  return timingSafeEqual(toHex(mac), parts.v1.toLowerCase());
}

async function isAuthorized(req: Request, rawBody: string): Promise<boolean> {
  const sigHeader = req.headers.get('X-RevenueCat-Webhook-Signature');
  if (RC_WEBHOOK_SIGNING_SECRET && sigHeader) {
    return await verifySignature(rawBody, sigHeader);
  }
  // Fallback: shared secret in the Authorization header. Configured in the
  // RevenueCat dashboard under Integrations → Webhooks.
  const auth = req.headers.get('Authorization') ?? '';
  return RC_WEBHOOK_AUTH.length > 0 && timingSafeEqual(auth, RC_WEBHOOK_AUTH);
}

type RcSubscriber = {
  subscriber?: {
    entitlements?: Record<
      string,
      { expires_date: string | null; product_identifier?: string; purchase_date?: string }
    >;
    subscriptions?: Record<
      string,
      {
        store?: string;
        period_type?: string;
        unsubscribe_detected_at?: string | null;
        billing_issues_detected_at?: string | null;
        grace_period_expires_date?: string | null;
      }
    >;
    management_url?: string | null;
  };
};

const ms = (iso?: string | null) => (iso ? Date.parse(iso) : NaN);

async function syncOwnerFromRevenueCat(ownerId: string, eventId: string, environment?: string) {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${ownerId}`, {
    headers: { Authorization: `Bearer ${RC_SECRET_API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`RevenueCat subscriber fetch failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as RcSubscriber;
  const sub = body.subscriber;
  const ent = sub?.entitlements?.[ENTITLEMENT_ID];
  const productId = ent?.product_identifier ?? null;
  const detail = productId ? sub?.subscriptions?.[productId] : undefined;

  // A billing-issue grace period keeps the customer entitled past expires_date.
  const expiryCandidates = [ms(ent?.expires_date), ms(detail?.grace_period_expires_date)].filter(
    (n) => Number.isFinite(n)
  ) as number[];

  const expiresAt = expiryCandidates.length ? Math.max(...expiryCandidates) : null;

  // No entitlement at all → not active. Entitlement with a null expiry →
  // lifetime or a non-expiring promotional grant → active.
  const isActive = ent ? (expiresAt === null ? true : expiresAt > Date.now()) : false;

  const { error } = await admin.from('subscriptions').upsert(
    {
      owner_id: ownerId,
      entitlement: ENTITLEMENT_ID,
      is_active: isActive,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      will_renew:
        !!ent && !detail?.unsubscribe_detected_at && !detail?.billing_issues_detected_at,
      product_id: productId,
      store: detail?.store ?? null,
      period_type: detail?.period_type ?? null,
      environment: environment ?? null,
      management_url: sub?.management_url ?? null,
      rc_last_event_id: eventId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_id' }
  );

  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Read the body ONCE, as text, so the signature is computed over raw bytes.
  const rawBody = await req.text();

  if (!(await isAuthorized(req, rawBody))) {
    return new Response('Unauthorized', { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = (JSON.parse(rawBody)?.event ?? {}) as Record<string, unknown>;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const eventId = String(event.id ?? '');
  const eventType = String(event.type ?? '');

  // RevenueCat's "Send test event" button.
  if (eventType === 'TEST') return new Response('ok (test)', { status: 200 });
  if (!eventId) return new Response('Missing event id', { status: 400 });

  // Every id this event could refer to. Anonymous ids ($RCAnonymousID:...) and
  // any other alias are filtered out by the uuid test — our App User IDs are
  // always owners.id.
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...((event.transferred_to as string[]) ?? []),
    ...((event.transferred_from as string[]) ?? []),
  ]
    .filter((v): v is string => typeof v === 'string' && UUID_RE.test(v))
    .filter((v, i, arr) => arr.indexOf(v) === i);

  // Idempotency gate. The primary key means a redelivery of an event we have
  // already processed inserts nothing and returns here.
  const { error: insertError } = await admin.from('subscription_events').insert({
    id: eventId,
    owner_id: candidates[0] ?? null,
    type: eventType,
    payload: event,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return new Response('ok (duplicate)', { status: 200 });
    }
    // 23503 = the owner_id FK does not exist; keep going, the upsert below
    // will surface the real problem.
    if (insertError.code !== '23503') {
      console.error('subscription_events insert failed', insertError);
      return new Response('DB error', { status: 500 });
    }
  }

  try {
    for (const ownerId of candidates) {
      await syncOwnerFromRevenueCat(ownerId, eventId, event.environment as string | undefined);
    }
  } catch (err) {
    // Non-2xx makes RevenueCat retry with backoff, which is what we want.
    console.error('webhook processing failed', err);
    return new Response('Processing failed', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});
