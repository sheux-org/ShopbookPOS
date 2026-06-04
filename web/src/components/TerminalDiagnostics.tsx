'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import styles from './TerminalDiagnostics.module.css';
import { useSettingsStore } from '@/stores/settingsStore';

interface TerminalDiagnosticsProps {
  showPrinter?: boolean;
}

// -----------------------------------------------------------------------
// Known USB Vendor IDs for barcode scanners (USB HID devices)
// WebHID API allows reading the device list if permission was granted.
// -----------------------------------------------------------------------
const KNOWN_SCANNER_VENDOR_IDS = new Set([
  0x0c2e, // Honeywell / Metrologic
  0x05e0, // Symbol / Zebra
  0x05f9, // Datalogic
  0x065a, // Opticon
  0x04b4, // Unitech / Cypress
  0x1eab, // Newland
  0x0536, // Hand Held Products (Honeywell legacy)
  0x05d5, // Inateck / Generic USB HID Scanner
  0x1a86, // QinHeng Electronics (common clone scanners)
  0x067b, // Prolific (common USB serial/scanner adapters)
  0x2dd6, // Symcode / budget scanners
  0x26ca, // Adesso
]);

// Known USB Vendor IDs for receipt printers
const KNOWN_PRINTER_VENDOR_IDS = new Set([
  0x04b8, // Epson
  0x0519, // Star Micronics
  0x154f, // Bixolon
  0x08a9, // Citizen
  0x0dd4, // Custom
  0x6868, // Rongta
  0x0fe6, // ICS Advent / Xprinter
  0x20d1, // Beiyang / Generic thermal
]);

// -----------------------------------------------------------------------
// Hook: Real USB HID barcode scanner connection detection via WebHID API
// Falls back to keystroke burst analysis if WebHID is not supported.
// -----------------------------------------------------------------------
function useBarcodeScannerStatus() {
  // 'connected' = WebHID confirmed device present
  // 'active'    = no WebHID but a scan burst was just detected
  // 'disconnected' = nothing detected
  const [status, setStatus] = useState<'connected' | 'active' | 'disconnected'>('disconnected');
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── WebHID detection ──────────────────────────────────────────────
  const checkHidDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('hid' in navigator)) return;
    try {
      const devices: any[] = await (navigator as any).hid.getDevices();
      const found = devices.some((d) => KNOWN_SCANNER_VENDOR_IDS.has(d.vendorId));
      setStatus((prev) => {
        // Don't downgrade 'active' to 'disconnected' if WebHID says nothing
        // (user may not have granted permission yet)
        if (found) return 'connected';
        if (prev === 'active') return 'active';
        return 'disconnected';
      });
    } catch {
      // WebHID permission not granted – rely on keystroke fallback
    }
  }, []);

  // ── WebHID connect / disconnect events ───────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('hid' in navigator)) return;

    checkHidDevices();

    const onConnect = (e: any) => {
      if (KNOWN_SCANNER_VENDOR_IDS.has(e.device?.vendorId)) {
        setStatus('connected');
      }
    };
    const onDisconnect = (e: any) => {
      if (KNOWN_SCANNER_VENDOR_IDS.has(e.device?.vendorId)) {
        // Re-check remaining devices
        checkHidDevices();
      }
    };

    (navigator as any).hid.addEventListener('connect', onConnect);
    (navigator as any).hid.addEventListener('disconnect', onDisconnect);

    return () => {
      (navigator as any).hid.removeEventListener('connect', onConnect);
      (navigator as any).hid.removeEventListener('disconnect', onDisconnect);
    };
  }, [checkHidDevices]);

  // ── Keystroke burst fallback (USB HID scanners type very fast) ───
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      if (diff < 50) {
        if (e.key === 'Enter') {
          if (buffer.length > 3) {
            // Confirmed scanner burst — mark active for 30s
            setStatus((prev) => (prev === 'connected' ? 'connected' : 'active'));
            if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
            burstTimerRef.current = setTimeout(() => {
              setStatus((prev) => (prev === 'connected' ? 'connected' : 'disconnected'));
            }, 30000);
          }
          buffer = '';
        } else {
          buffer += e.key;
        }
      } else {
        buffer = e.key === 'Enter' ? '' : e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    };
  }, []);

  return status;
}

// -----------------------------------------------------------------------
// Hook: USB printer detection via WebUSB API
// -----------------------------------------------------------------------
function useUsbPrinterStatus(pairedPrinter: { name: string; address: string } | null) {
  const [usbFound, setUsbFound] = useState(false);

  const check = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('usb' in navigator)) return;
    try {
      const devices: any[] = await (navigator as any).usb.getDevices();
      const found = devices.some((d) => {
        if (KNOWN_PRINTER_VENDOR_IDS.has(d.vendorId)) return true;
        for (const iface of d.configuration?.interfaces ?? []) {
          for (const alt of iface.alternates ?? []) {
            if (alt.interfaceClass === 7) return true; // USB Printer class
          }
        }
        return false;
      });
      setUsbFound(found);
    } catch {
      setUsbFound(false);
    }
  }, []);

  useEffect(() => {
    check();
    if (typeof navigator === 'undefined' || !('usb' in navigator)) return;
    (navigator as any).usb.addEventListener('connect', check);
    (navigator as any).usb.addEventListener('disconnect', check);
    return () => {
      (navigator as any).usb.removeEventListener('connect', check);
      (navigator as any).usb.removeEventListener('disconnect', check);
    };
  }, [check, pairedPrinter]);

  return usbFound;
}

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------
export const TerminalDiagnostics: React.FC<TerminalDiagnosticsProps> = ({ showPrinter = true }) => {
  const isBackupEnabled = useSettingsStore((s) => s.isBackupEnabled);
  const pairedPrinter = useSettingsStore((s) => s.pairedPrinter);

  const scannerStatus = useBarcodeScannerStatus();
  const usbPrinterFound = useUsbPrinterStatus(pairedPrinter);
  const printerConnected = usbPrinterFound || !!pairedPrinter;

  return (
    <div className={styles.diagnosticsCard}>
      <div className={styles.list}>
        {/* Local DB */}
        <div className={styles.item}>
          <span className={styles.label}>Local DB</span>
          <span className={`${styles.badge} ${styles.active}`}>Connected</span>
        </div>

        {/* Cloud DB */}
        <div className={styles.item}>
          <span className={styles.label}>Cloud DB</span>
          <span className={`${styles.badge} ${isBackupEnabled ? styles.active : styles.inactive}`}>
            {isBackupEnabled ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Barcode Scanner */}
        <div className={styles.item}>
          <span className={styles.label}>Barcode Scanner</span>
          <div className={styles.badgeGroup}>
            {scannerStatus === 'connected' && (
              <span className={`${styles.badge} ${styles.active}`}>Connected (USB HID)</span>
            )}
            {scannerStatus === 'active' && (
              <span className={`${styles.badge} ${styles.active}`}>Connected (USB HID)</span>
            )}
            {scannerStatus === 'disconnected' && (
              <>
                <span className={`${styles.badge} ${styles.inactive}`}>Not Connected</span>
                <span className={styles.hint}>Connect USB scanner or scan to detect</span>
              </>
            )}
          </div>
        </div>

        {/* Receipt Printer */}
        {showPrinter && (
          <div className={styles.item}>
            <span className={styles.label}>Receipt Printer</span>
            <span
              className={`${styles.badge} ${printerConnected ? styles.active : styles.inactive}`}
            >
              {usbPrinterFound
                ? 'Connected (USB)'
                : pairedPrinter
                  ? `Paired: ${pairedPrinter.name}`
                  : 'Not Connected'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
