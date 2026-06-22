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

  // On mount: silently reopen a granted serial printer (no prompt) AND probe for
  // a local print-bridge agent, so we know which tiers are available.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let serialOk = false;
      if (supported) {
        try {
          serialOk = await restorePrinter(baudRate);
        } catch {
          serialOk = false;
        }
      }
      const bridgeOk = await isBridgeAvailable();
      if (cancelled) return;
      setConnected(serialOk);
      setBridgeReady(bridgeOk);
      setActiveTransport(serialOk ? 'web-serial' : bridgeOk ? 'bridge' : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, baudRate]);

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
    connect,
    disconnect,
    printReceipt,
    printTestReceipt,
    openCashDrawer,
  };
}
