// Web Serial transport for thermal (ESC/POS) printers on the web terminal.
// Takes raw ESC/POS bytes (e.g. from react-thermal-printer's `render`) and writes
// them to a printer connected over a serial port. Desktop Chromium only.

export class WebSerialUnsupportedError extends Error {
  constructor() {
    super('Web Serial is not supported in this browser.');
    this.name = 'WebSerialUnsupportedError';
  }
}

export class PrinterNotConnectedError extends Error {
  constructor() {
    super('No thermal printer is connected.');
    this.name = 'PrinterNotConnectedError';
  }
}

const DEFAULT_BAUD_RATE = 9600;

let port: SerialPort | null = null;

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/** True when the user dismissed the browser's device picker (vs a real failure). */
export function isUserCancellation(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotFoundError' || err.name === 'AbortError');
}

export function isPrinterConnected(): boolean {
  return port !== null;
}

/**
 * Prompts the user to pick a serial printer and opens it. Must be called from a
 * user gesture (click). The granted port is remembered for `restorePrinter`.
 */
export async function connectPrinter(baudRate = DEFAULT_BAUD_RATE): Promise<void> {
  if (!isWebSerialSupported()) throw new WebSerialUnsupportedError();

  const selected = await navigator.serial.requestPort();
  await selected.open({ baudRate });
  port = selected;
}

/**
 * Reopens a previously-granted printer without prompting (e.g. after a reload).
 * Returns true if a port was restored.
 */
export async function restorePrinter(baudRate = DEFAULT_BAUD_RATE): Promise<boolean> {
  if (!isWebSerialSupported()) return false;

  const granted = await navigator.serial.getPorts();
  const previous = granted[0];
  if (!previous) return false;

  await previous.open({ baudRate });
  port = previous;
  return true;
}

export async function disconnectPrinter(): Promise<void> {
  if (!port) return;
  try {
    await port.close();
  } finally {
    port = null;
  }
}

/** Writes raw ESC/POS bytes to the connected printer. */
export async function printBytes(data: Uint8Array): Promise<void> {
  if (!port) throw new PrinterNotConnectedError();

  const writable = port.writable;
  if (!writable) throw new PrinterNotConnectedError();

  const writer = writable.getWriter();
  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
  }
}
