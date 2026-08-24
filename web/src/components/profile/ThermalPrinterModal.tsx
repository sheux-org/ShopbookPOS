'use client';

import React, { useState } from 'react';
import { X, Printer, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useThermalPrinter } from '../../hooks/useThermalPrinter';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../hooks/useTranslation';
import { SideDrawer } from '../common/SideDrawer';

interface ThermalPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBusiness: { name?: string; address?: string; phone?: string } | null;
}

// Defaults to the R2-hosted installer (always latest). Override with
// NEXT_PUBLIC_COMPANION_INSTALL_URL to self-host (a copy ships at web/public/companion/).
const COMPANION_INSTALL_URL =
  process.env.NEXT_PUBLIC_COMPANION_INSTALL_URL ||
  'https://pub-4b53b304bc45450dbe0155abfe55778b.r2.dev/chittie-companion-latest-windows-x64-setup.exe';

export const ThermalPrinterModal: React.FC<ThermalPrinterModalProps> = ({
  isOpen,
  onClose,
  activeBusiness,
}) => {
  const { ready, refresh, printTestReceipt, openCashDrawer } = useThermalPrinter();
  const { t } = useTranslation();
  const printerProfile = useSettingsStore((s) => s.printerProfile);
  const setPrinterProfile = useSettingsStore((s) => s.setPrinterProfile);
  const cashDrawerDevice = useSettingsStore((s) => s.cashDrawerDevice);
  const setCashDrawerDevice = useSettingsStore((s) => s.setCashDrawerDevice);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const notify = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  };

  const handleTestPrint = async () => {
    setBusy(true);
    try {
      await printTestReceipt(activeBusiness);
      notify('Test receipt sent.');
    } catch (err) {
      console.error('Test print failed:', err);
      notify('Could not print. Is the Chittie Companion running?');
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
      notify('Could not kick drawer. Check companion connection.');
    } finally {
      setBusy(false);
    }
  };

  const drawerFooter = (
    <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => {
          refresh();
          notify('Refreshed printer status.');
        }}
        className="action-btn-secondary"
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <RefreshCw size={14} />
        <span>Re-check status</span>
      </button>
      <button
        type="button"
        onClick={onClose}
        className="modal-submit-btn"
        style={{ margin: 0, width: 'auto' }}
      >
        <span>Done</span>
      </button>
    </div>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('printer.headerTitle')}
      subtitle="Configure hardware receipt printer, paper width, and cash drawer triggers"
      icon={<Printer size={20} />}
      footer={drawerFooter}
      maxWidth="560px"
    >
      <div style={styles.body}>
          <div style={ready ? styles.statusConnected : styles.statusIdle}>
            {ready ? <CheckCircle2 size={18} /> : <Printer size={18} />}
            <span>{ready ? 'Chittie Companion connected & ready' : 'Companion not running'}</span>
          </div>

          {!ready && (
            <div style={styles.warningBox}>
              <AlertTriangle size={20} color="var(--warning)" />
              <div>
                <p style={styles.warningTitle}>Install the Chittie Companion</p>
                <p style={styles.warningSub}>
                  The print bridge runs in the tray and drives your USB/network thermal printer.{' '}
                  <a
                    href={COMPANION_INSTALL_URL}
                    style={{ color: 'var(--primary)', fontWeight: 700 }}
                  >
                    Download for Windows
                  </a>
                  , install it, then re-check. (No companion? Printing falls back to the system
                  dialog.)
                </p>
              </div>
            </div>
          )}

          <div style={styles.fieldRow}>
            <label style={styles.fieldLabel}>Paper width</label>
            <div style={styles.segment}>
              {(['58mm', '80mm'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPrinterProfile(p)}
                  style={printerProfile === p ? styles.segmentActive : styles.segmentBtn}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.fieldRow}>
            <label style={styles.fieldLabel}>Cash drawer pin</label>
            <div style={styles.segment}>
              {([0, 1] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setCashDrawerDevice(d)}
                  style={cashDrawerDevice === d ? styles.segmentActive : styles.segmentBtn}
                >
                  {d === 0 ? 'Pin 2' : 'Pin 5'}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.buttonCol}>
            <button
              onClick={() => {
                void refresh();
                notify('Re-checking…');
              }}
              disabled={busy}
              style={styles.secondaryBtn}
            >
              Re-check connection
            </button>
            <button onClick={handleTestPrint} disabled={busy} style={styles.secondaryBtn}>
              <Printer size={15} />
              <span>Print Test Receipt</span>
            </button>
            <button onClick={handleOpenDrawer} disabled={busy} style={styles.secondaryBtn}>
              <span>Open Cash Drawer</span>
            </button>
          </div>

          {message && <div style={styles.toast}>{message}</div>}
        </div>
    </SideDrawer>
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
  body: { padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' },
  warningBox: {
    display: 'flex',
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '10px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
  },
  warningTitle: { fontSize: '13px', fontWeight: 700, color: '#92400e', margin: '0 0 2px 0' },
  warningSub: { fontSize: '12px', color: '#b45309', margin: 0, lineHeight: 1.4 },
  statusConnected: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '10px',
    backgroundColor: '#ecfdf5',
    color: '#047857',
    fontSize: '12.5px',
    fontWeight: 700,
  },
  statusIdle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '10px',
    backgroundColor: '#f8fafc',
    color: 'var(--muted)',
    fontSize: '12.5px',
    fontWeight: 700,
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: '10px',
    backgroundColor: '#f8fafc',
    border: '1px solid var(--border)',
  },
  fieldLabel: { fontSize: '12.5px', fontWeight: 600, color: '#334155' },
  segment: { display: 'flex', gap: '6px' },
  segmentBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontWeight: 600,
    fontSize: '12px',
    cursor: 'pointer',
  },
  segmentActive: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid var(--primary)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer',
  },
  select: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    fontSize: '12px',
    color: '#0f172a',
  },
  buttonCol: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' },
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
