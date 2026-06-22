import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

type Writer = { write: ReturnType<typeof vi.fn>; releaseLock: ReturnType<typeof vi.fn> };
type FakePort = {
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  writable: { getWriter: () => Writer } | null;
};

function makePort(): { port: FakePort; writer: Writer } {
  const writer: Writer = { write: vi.fn().mockResolvedValue(undefined), releaseLock: vi.fn() };
  const port: FakePort = {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    writable: { getWriter: () => writer },
  };
  return { port, writer };
}

function installSerial(impl: {
  requestPort?: () => Promise<FakePort>;
  getPorts?: () => Promise<FakePort[]>;
}) {
  Object.defineProperty(navigator, 'serial', {
    value: {
      requestPort: impl.requestPort ?? vi.fn(),
      getPorts: impl.getPorts ?? vi.fn().mockResolvedValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    configurable: true,
    writable: true,
  });
}

function removeSerial() {
  // @ts-expect-error - deleting an optional runtime-only property in tests
  delete navigator.serial;
}

beforeEach(() => {
  vi.resetModules();
  removeSerial();
});

afterEach(() => {
  removeSerial();
});

describe('webSerialPrinter', () => {
  test('isWebSerialSupported reflects navigator.serial presence', async () => {
    const mod = await import('../../services/webSerialPrinter');
    expect(mod.isWebSerialSupported()).toBe(false);

    installSerial({});
    expect(mod.isWebSerialSupported()).toBe(true);
  });

  test('connectPrinter requests and opens a port at the given baud rate', async () => {
    const { port } = makePort();
    installSerial({ requestPort: vi.fn().mockResolvedValue(port) });

    const mod = await import('../../services/webSerialPrinter');
    expect(mod.isPrinterConnected()).toBe(false);

    await mod.connectPrinter(19200);

    expect(port.open).toHaveBeenCalledWith({ baudRate: 19200 });
    expect(mod.isPrinterConnected()).toBe(true);
  });

  test('connectPrinter throws WebSerialUnsupportedError when unsupported', async () => {
    const mod = await import('../../services/webSerialPrinter');
    await expect(mod.connectPrinter()).rejects.toBeInstanceOf(mod.WebSerialUnsupportedError);
  });

  test('printBytes writes the exact bytes to the connected printer', async () => {
    const { port, writer } = makePort();
    installSerial({ requestPort: vi.fn().mockResolvedValue(port) });

    const mod = await import('../../services/webSerialPrinter');
    await mod.connectPrinter();

    const data = new Uint8Array([0x1b, 0x40, 0x41]);
    await mod.printBytes(data);

    expect(writer.write).toHaveBeenCalledWith(data);
    expect(writer.releaseLock).toHaveBeenCalled();
  });

  test('printBytes throws PrinterNotConnectedError when no printer is connected', async () => {
    const mod = await import('../../services/webSerialPrinter');
    await expect(mod.printBytes(new Uint8Array([1]))).rejects.toBeInstanceOf(
      mod.PrinterNotConnectedError
    );
  });

  test('restorePrinter reopens a previously-granted port without prompting', async () => {
    const { port } = makePort();
    installSerial({ getPorts: vi.fn().mockResolvedValue([port]) });

    const mod = await import('../../services/webSerialPrinter');
    const restored = await mod.restorePrinter();

    expect(restored).toBe(true);
    expect(port.open).toHaveBeenCalled();
    expect(mod.isPrinterConnected()).toBe(true);
  });

  test('restorePrinter returns false when no port was previously granted', async () => {
    installSerial({ getPorts: vi.fn().mockResolvedValue([]) });

    const mod = await import('../../services/webSerialPrinter');
    expect(await mod.restorePrinter()).toBe(false);
    expect(mod.isPrinterConnected()).toBe(false);
  });

  test('isUserCancellation distinguishes picker dismissal from real errors', async () => {
    const mod = await import('../../services/webSerialPrinter');
    expect(mod.isUserCancellation(new DOMException('no port', 'NotFoundError'))).toBe(true);
    expect(mod.isUserCancellation(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(mod.isUserCancellation(new DOMException('net', 'NetworkError'))).toBe(false);
    expect(mod.isUserCancellation(new Error('boom'))).toBe(false);
  });

  test('disconnectPrinter closes the port and clears connection state', async () => {
    const { port } = makePort();
    installSerial({ requestPort: vi.fn().mockResolvedValue(port) });

    const mod = await import('../../services/webSerialPrinter');
    await mod.connectPrinter();
    await mod.disconnectPrinter();

    expect(port.close).toHaveBeenCalled();
    expect(mod.isPrinterConnected()).toBe(false);
  });
});
