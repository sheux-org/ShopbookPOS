// Minimal ambient declarations for the W3C Web Serial API.
// The TS DOM lib does not yet ship these; we only declare what webSerialPrinter.ts uses.

interface SerialPortOpenOptions {
  baudRate: number;
}

interface SerialPort {
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: SerialPortOpenOptions): Promise<void>;
  close(): Promise<void>;
}

interface Serial extends EventTarget {
  requestPort(): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

interface Navigator {
  readonly serial: Serial;
}
