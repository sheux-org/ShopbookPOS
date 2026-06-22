'use client';

import React, { useState } from 'react';
import { X, Usb, Printer, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useThermalPrinter } from '../../hooks/useThermalPrinter';
import { useSettingsStore } from '../../stores/settingsStore';

interface ThermalPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBusiness: { name?: string; address?: string; phone?: string } | null;
}

const BAUD_RATES = [9600, 19200, 38400, 115200];

export const ThermalPrinterModal: React.FC<ThermalPrinterModalProps> = ({
  isOpen,
  onClose,
  activeBusiness,
}) => {
  const { supported, connected, connect, disconnect, printTestReceipt, openCashDrawer } =
    useThermalPrinter();
  const paperWidth = useSettingsStore((s) => s.thermalPaperWidth);
  const setPaperWidth = useSettingsStore((s) => s.setThermalPaperWidth);
  const baudRate = useSettingsStore((s) => s.thermalBaudRate);
  const setBaudRate = useSettingsStore((s) => s.setThermalBaudRate);
  const cashDrawerPin = useSettingsStore((s) => s.cashDrawerPin);
  const setCashDrawerPin = useSettingsStore((s) => s.setCashDrawerPin);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const notify = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  };

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connect();
      notify('Printer connected.');
    } catch (err) {
      console.error('Printer connect failed:', err);
      notify('Connection cancelled or failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnect();
      notify('Printer disconnected.');
    } finally {
      setBusy(false);
    }
  };

  const handleTestPrint = async () => {
    setBusy(true);
    try {
      await printTestReceipt(activeBusiness);
      notify('Test receipt sent.');
    } catch (err) {
      console.error('Test print failed:', err);
      notify('Could not print. Check the printer and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenDrawer = async () => {
    setBusy(true);
    try {
      await openCashDrawer();
      notify('Cash drawer opened.');
    } catch (err) {
      console.error('Open drawer failed:', err);
      notify('Could not open the drawer. Is it wired to the printer?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Usb size={18} color="var(--primary)" />
            <h3 style={styles.title}>Thermal Printer (Web Serial)</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        <div style={styles.body}>
          {!supported ? (
            <div style={styles.warningBox}>
              <AlertTriangle size={20} color="var(--warning)" />
              <div>
                <p style={styles.warningTitle}>Not supported in this browser</p>
                <p style={styles.warningSub}>
                  Direct thermal printing uses the Web Serial API, available on desktop Chrome or
                  Edge over HTTPS. Use those, or fall back to the system print dialog.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div style={connected ? styles.statusConnected : styles.statusIdle}>
                {connected ? <CheckCircle2 size={18} /> : <Printer size={18} />}
                <span>{connected ? 'Printer connected & ready' : 'No printer connected'}</span>
              </div>

              <div style={styles.fieldRow}>
                <label style={styles.fieldLabel}>Paper width</label>
                <div style={styles.segment}>
                  {([58, 80] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setPaperWidth(w)}
                      style={paperWidth === w ? styles.segmentActive : styles.segmentBtn}
                    >
                      {w}mm
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.fieldRow}>
                <label style={styles.fieldLabel}>Baud rate</label>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  style={styles.select}
                >
                  {BAUD_RATES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldRow}>
                <label style={styles.fieldLabel}>Cash drawer pin</label>
                <div style={styles.segment}>
                  {(['2pin', '5pin'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCashDrawerPin(p)}
                      style={cashDrawerPin === p ? styles.segmentActive : styles.segmentBtn}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.buttonCol}>
                {!connected ? (
                  <button onClick={handleConnect} disabled={busy} style={styles.primaryBtn}>
                    <Usb size={15} />
                    <span>Connect Printer</span>
                  </button>
                ) : (
                  <button onClick={handleDisconnect} disabled={busy} style={styles.secondaryBtn}>
                    Disconnect
                  </button>
                )}
                <button onClick={handleTestPrint} disabled={busy} style={styles.secondaryBtn}>
                  <Printer size={15} />
                  <span>Print Test Receipt</span>
                </button>
                <button onClick={handleOpenDrawer} disabled={busy} style={styles.secondaryBtn}>
                  <span>Open Cash Drawer</span>
                </button>
              </div>
            </>
          )}

          {message && <div style={styles.toast}>{message}</div>}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    backdropFilter: 'blur(6px)',
    padding: '16px',
  },
  content: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  title: { fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
  },
  body: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' },
  warningBox: {
    display: 'flex',
    gap: '12px',
    padding: '14px',
    borderRadius: '10px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
  },
  warningTitle: { fontSize: '13px', fontWeight: 700, color: '#92400e', margin: '0 0 4px 0' },
  warningSub: { fontSize: '12px', color: '#b45309', margin: 0, lineHeight: 1.5 },
  statusConnected: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    borderRadius: '10px',
    backgroundColor: '#ecfdf5',
    color: '#047857',
    fontSize: '13px',
    fontWeight: 700,
  },
  statusIdle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    borderRadius: '10px',
    backgroundColor: '#f8fafc',
    color: 'var(--muted)',
    fontSize: '13px',
    fontWeight: 700,
  },
  fieldRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
  fieldLabel: { fontSize: '13px', fontWeight: 600, color: '#334155' },
  segment: { display: 'flex', gap: '6px' },
  segmentBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontWeight: 600,
    fontSize: '12px',
    cursor: 'pointer',
  },
  segmentActive: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid var(--primary)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    color: '#0f172a',
  },
  buttonCol: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '11px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    fontWeight: 600,
    fontSize: '12px',
    cursor: 'pointer',
  },
  toast: {
    textAlign: 'center',
    fontSize: '12px',
    color: 'var(--dark)',
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '8px',
  },
};
