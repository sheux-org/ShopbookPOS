'use client';

import { useCallback, useEffect, useState } from 'react';
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

/**
 * Printing through the Chittie Companion (localhost:8930) — the single, battle-tested
 * path. No Web Serial: it can't see USB printer-class devices and is Chromium-only.
 * If the companion isn't reachable, callers fall back to the system print dialog.
 */
export function useThermalPrinter() {
  const paperWidth = useSettingsStore((s) => s.thermalPaperWidth);
  const cashDrawerPin = useSettingsStore((s) => s.cashDrawerPin);
  const openDrawerOnCashSale = useSettingsStore((s) => s.openDrawerOnCashSale);
  const widthChars = paperWidth === 58 ? 32 : 48;

  const [ready, setReady] = useState(false); // Chittie Companion reachable

  const refresh = useCallback(async () => {
    setReady(await isBridgeAvailable());
  }, []);

  // Keep status LIVE so it self-heals across the shop day (companion starting after
  // a reboot, tab refocus). Polling beats a one-shot mount probe that goes stale.
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
    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const printReceipt = useCallback(
    async (params: ReceiptParams) => {
      const openCashDrawer = openDrawerOnCashSale && params.order.paymentMethod === 'cash';
      const data = await renderReceiptBytes({
        ...params,
        widthChars,
        openCashDrawer,
        cashDrawerPin,
      });
      await printViaBridge(data);
      setReady(true);
    },
    [widthChars, cashDrawerPin, openDrawerOnCashSale]
  );

  const openCashDrawer = useCallback(async () => {
    await printViaBridge(await renderCashDrawerBytes(cashDrawerPin));
    setReady(true);
  }, [cashDrawerPin]);

  const printTestReceipt = useCallback(
    async (activeBusiness: ReceiptParams['activeBusiness']) => {
      await printViaBridge(await renderTestReceiptBytes(activeBusiness, widthChars));
      setReady(true);
    },
    [widthChars]
  );

  const activeTransport: PrinterTransportId | null = ready ? 'bridge' : null;

  return {
    ready,
    canPrint: ready,
    activeTransport,
    refresh,
    printReceipt,
    printTestReceipt,
    openCashDrawer,
  };
}
