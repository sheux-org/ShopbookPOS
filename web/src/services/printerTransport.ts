// Print transport — the single path. Sends chittie ESC/POS bytes to the Chittie
// Companion (a battle-tested localhost print bridge) via its published SDK, which
// drives USB printer-class / OS-queue / TCP printers. If the companion isn't
// running, callers fall back to the system print dialog (see useThermalPrinter.ts).
import { createCompanionClient, type CompanionClient } from '@angadie/chittie-companion';

const BRIDGE_URL = (process.env.NEXT_PUBLIC_PRINT_BRIDGE_URL || 'http://localhost:8930').replace(
  /\/$/,
  ''
);
// Optional shared secret — must match the companion's CHITTIE_TOKEN / PRINT_AGENT_TOKEN.
const BRIDGE_TOKEN = process.env.NEXT_PUBLIC_PRINT_BRIDGE_TOKEN || '';
// Optional explicit target ("usb", a queue name, or "host:port"); default = companion's chosen printer.
const BRIDGE_TARGET = process.env.NEXT_PUBLIC_PRINT_TARGET || '';

export type PrinterTransportId = 'bridge';

let client: CompanionClient | null = null;
function companion(): CompanionClient {
  if (!client) {
    client = createCompanionClient({ url: BRIDGE_URL, token: BRIDGE_TOKEN || undefined });
  }
  return client;
}

/** Cheap, short-timeout probe for a reachable Chittie Companion. */
export async function isBridgeAvailable(timeoutMs = 700): Promise<boolean> {
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs));
  try {
    return await Promise.race([companion().available(), timeout]);
  } catch {
    return false;
  }
}

/** Send raw ESC/POS bytes to the companion. Throws if it didn't print. */
export async function printViaBridge(data: Uint8Array): Promise<void> {
  const res = await companion().print(data, BRIDGE_TARGET ? { target: BRIDGE_TARGET } : {});
  if (!res.printed) throw new Error(res.reason || 'Print bridge failed');
}

export { BRIDGE_URL };
