'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  isWebSerialSupported,
  isPrinterConnected,
  connectPrinter,
  restorePrinter,
  disconnectPrinter,
  printBytes,
  PrinterNotConnectedError,
} from '../services/webSerialPrinter';
import {
  renderReceiptBytes,
  renderTestReceiptBytes,
  renderCashDrawerBytes,
  type RenderReceiptParams,
} from '../utils/thermalReceipt';
import {
  isBridgeAvailable,
  printViaBridge,
  type PrinterTransportId,
} from '../services/printerTransport';
import { useSettingsStore } from '../stores/settingsStore';

type ReceiptParams = Omit<RenderReceiptParams, 'widthChars' | 'openCashDrawer' | 'cashDrawerPin'>;

export function useThermalPrinter() {
  const baudRate = useSettingsStore((s) => s.thermalBaudRate);
  const paperWidth = useSettingsStore((s) => s.thermalPaperWidth);
  const cashDrawerPin = useSettingsStore((s) => s.cashDrawerPin);
  const openDrawerOnCashSale = useSettingsStore((s) => s.openDrawerOnCashSale);
  const widthChars = paperWidth === 58 ? 32 : 48;

  const [supported] = useState(() => isWebSerialSupported());
  const [connected, setConnected] = useState(false); // a serial/COM printer is open
  const [bridgeReady, setBridgeReady] = useState(false); // a local print-bridge agent is reachable
  const [activeTransport, setActiveTransport] = useState<PrinterTransportId | null>(null);

  // Re-evaluate which transports are reachable: silently reopen a granted serial
  // printer (no prompt) and probe the local print-bridge agent. Cheap; safe to
  // call repeatedly (skips serial restore when already open).
  const refresh = useCallback(async () => {
    let serialOk = isPrinterConnected();
    if (supported && !serialOk) {
      try {
        serialOk = await restorePrinter(baudRate);
      } catch {
        serialOk = false;
      }
    }
    const bridgeOk = await isBridgeAvailable();
    setConnected(serialOk);
    setBridgeReady(bridgeOk);
    setActiveTransport(serialOk ? 'web-serial' : bridgeOk ? 'bridge' : null);
  }, [supported, baudRate]);

  // Keep status LIVE so it self-heals across the real shop day: the agent
  // starting after a reboot, a USB printer unplugged/replugged mid-shift, the
  // tab being refocused. Polling beats a one-shot mount probe that goes stale.
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (alive) void refresh();
    };
    tick();
    const interval = setInterval(tick, 6000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    const serial = (navigator as unknown as { serial?: EventTarget }).serial;
    const onConnect = () => tick();
    const onDisconnect = () => {
      // A granted serial printer was physically removed — drop it, then re-probe.
      void disconnectPrinter().finally(tick);
    };
    serial?.addEventListener?.('connect', onConnect);
    serial?.addEventListener?.('disconnect', onDisconnect);
    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      serial?.removeEventListener?.('connect', onConnect);
      serial?.removeEventListener?.('disconnect', onDisconnect);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    await connectPrinter(baudRate);
    setConnected(isPrinterConnected());
    setActiveTransport('web-serial');
  }, [baudRate]);

  const disconnect = useCallback(async () => {
    await disconnectPrinter();
    setConnected(false);
    setActiveTransport((prev) => (prev === 'web-serial' ? (bridgeReady ? 'bridge' : null) : prev));
  }, [bridgeReady]);

  // Smart tiered write: a connected (or silently-restorable) serial printer first,
  // then a local print-bridge agent, then — only with a user gesture — the serial
  // picker. Throws if nothing is reachable so callers can fall back to system print.
  const writeWithConnect = useCallback(
    async (data: Uint8Array) => {
      // Tier 1 — Web Serial (already open, or silently reopen a granted port).
      if (supported) {
        if (!isPrinterConnected()) {
          try {
            await restorePrinter(baudRate);
          } catch {
            /* fall through */
          }
        }
        if (isPrinterConnected()) {
          await printBytes(data);
          setConnected(true);
          setActiveTransport('web-serial');
          return;
        }
      }
      // Tier 2 — local print-bridge agent (USB printer-class / no COM port).
      if (await isBridgeAvailable()) {
        await printViaBridge(data);
        setBridgeReady(true);
        setActiveTransport('bridge');
        return;
      }
      // Tier 3 — prompt the serial picker (requires a user gesture).
      if (supported) {
        await connect();
        await printBytes(data);
        setActiveTransport('web-serial');
        return;
      }
      throw new PrinterNotConnectedError();
    },
    [supported, baudRate, connect]
  );

  const printReceipt = useCallback(
    async (params: ReceiptParams) => {
      const openCashDrawer = openDrawerOnCashSale && params.order.paymentMethod === 'cash';
      const data = await renderReceiptBytes({
        ...params,
        widthChars,
        openCashDrawer,
        cashDrawerPin,
      });
      await writeWithConnect(data);
    },
    [widthChars, cashDrawerPin, openDrawerOnCashSale, writeWithConnect]
  );

  const openCashDrawer = useCallback(async () => {
    const data = await renderCashDrawerBytes(cashDrawerPin);
    await writeWithConnect(data);
  }, [cashDrawerPin, writeWithConnect]);

  const printTestReceipt = useCallback(
    async (activeBusiness: ReceiptParams['activeBusiness']) => {
      const data = await renderTestReceiptBytes(activeBusiness, widthChars);
      await writeWithConnect(data);
    },
    [widthChars, writeWithConnect]
  );

  const canPrint = connected || bridgeReady;

  return {
    supported,
    connected,
    bridgeReady,
    canPrint,
    activeTransport,
    refresh,
    connect,
    disconnect,
    printReceipt,
    printTestReceipt,
    openCashDrawer,
  };
}
