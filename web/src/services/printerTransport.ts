// Print-bridge transport: when no serial/COM port is available (e.g. a USB
// printer-class device like the MINJCODE MJ5818), the app sends the same raw
// ESC/POS bytes to a local print-bridge agent over localhost. In dev the
// serial-mock server fills this role; in production a native agent does.

const BRIDGE_URL = (process.env.NEXT_PUBLIC_PRINT_BRIDGE_URL || 'http://localhost:8930').replace(
  /\/$/,
  ''
);
// Optional shared secret — must match the agent's PRINT_AGENT_TOKEN in production.
const BRIDGE_TOKEN = process.env.NEXT_PUBLIC_PRINT_BRIDGE_TOKEN || '';

export type PrinterTransportId = 'web-serial' | 'bridge';

/** Cheap, short-timeout probe for a reachable local print-bridge agent. */
export async function isBridgeAvailable(timeoutMs = 700): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Send raw ESC/POS bytes to the print-bridge agent. */
export async function printViaBridge(data: Uint8Array): Promise<void> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (BRIDGE_TOKEN) headers['x-agent-token'] = BRIDGE_TOKEN;
  const res = await fetch(`${BRIDGE_URL}/print`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ bytes: Array.from(data) }),
  });
  if (!res.ok) throw new Error(`Print bridge responded ${res.status}`);
}

export { BRIDGE_URL };
