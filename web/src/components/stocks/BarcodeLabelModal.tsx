import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, Download, Sparkles, CheckCircle2, Copy } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    price: number;
    category: string;
    barcode: string;
  };
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const barcodeSvgRef = useRef<SVGSVGElement>(null);
  const [copied, setCopied] = useState(false);

  // Detect format (EAN-13 if 13 digits, otherwise CODE128)
  const isEan13 = /^\d{13}$/.test(product.barcode);
  const barcodeFormat = isEan13 ? 'EAN13' : 'CODE128';

  useEffect(() => {
    if (isOpen && product.barcode) {
      setTimeout(() => {
        if (barcodeSvgRef.current) {
          try {
            JsBarcode(barcodeSvgRef.current, product.barcode, {
              format: barcodeFormat,
              lineColor: '#0f172a',
              width: 2,
              height: 60,
              displayValue: true,
              font: 'monospace',
              fontSize: 14,
              fontOptions: 'bold',
              margin: 10,
            });
          } catch (err) {
            console.error('Failed to generate barcode SVG:', err);
          }
        }
      }, 50);
    }
  }, [isOpen, product.barcode, barcodeFormat]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocker is enabled. Please allow pop-ups to print labels.');
      return;
    }

    const barcodeSvgHtml = barcodeSvgRef.current?.outerHTML || '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Label - ${product.name}</title>
          <style>
            @page {
              size: 58mm 80mm;
              margin: 0;
            }
            body {
              font-family: 'Inter', system-ui, sans-serif;
              margin: 0;
              padding: 14px;
              text-align: center;
              color: #0f172a;
              background-color: #ffffff;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              box-sizing: border-box;
              height: 100vh;
            }
            .label-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              width: 100%;
              box-sizing: border-box;
            }
            .business-name {
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              margin-bottom: 6px;
              color: #64748b;
            }
            .product-name {
              font-size: 15px;
              font-weight: 800;
              margin: 4px 0;
              word-wrap: break-word;
              max-width: 100%;
              line-height: 1.25;
            }
            .price {
              font-size: 17px;
              font-weight: 900;
              margin-bottom: 12px;
              color: #000000;
            }
            .barcode-wrapper {
              margin: 8px 0;
              width: 100%;
              display: flex;
              justify-content: center;
            }
            .barcode-wrapper svg {
              width: 100% !important;
              height: auto !important;
              max-height: 65px;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="business-name">SHOPBOOK POS</div>
            <div class="product-name">${product.name}</div>
            <div class="price">Rs. ${product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div class="barcode-wrapper">
              ${barcodeSvgHtml}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadLabel = () => {
    try {
      const barcodeSvgHtml = barcodeSvgRef.current?.outerHTML || '';

      const fullLabelSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="360" height="240" viewBox="0 0 360 240" style="background:#ffffff; font-family: system-ui, sans-serif;">
          <rect width="360" height="240" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
          <text x="180" y="32" font-size="11" font-weight="800" fill="#64748b" text-anchor="middle" letter-spacing="2">SHOPBOOK POS</text>
          <text x="180" y="58" font-size="16" font-weight="800" fill="#0f172a" text-anchor="middle">${product.name.length > 28 ? product.name.slice(0, 26) + '...' : product.name}</text>
          <text x="180" y="84" font-size="18" font-weight="900" fill="#000000" text-anchor="middle">Rs. ${product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</text>
          <g transform="translate(45, 95)">
            ${barcodeSvgHtml}
          </g>
        </svg>
      `;

      const blob = new Blob([fullLabelSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `Label_${product.name.replace(/\s+/g, '_')}_${product.barcode}.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download barcode label:', err);
    }
  };

  const handleCopyCode = () => {
    const text = product.barcode;
    if (!text) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Copy fallback failed', err);
      }
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--primary)" />
            <div>
              <h3 style={styles.modalTitle}>Product Scan Label</h3>
              <p style={styles.modalSubtitle}>{product.name}</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.modalCloseBtn}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={styles.modalBody}>
          {/* Label Preview Container */}
          <div style={styles.previewSection}>
            <span style={styles.previewLabel}>PRINT PREVIEW (58mm x 80mm Roll)</span>
            <div style={styles.labelCard} id="printable-product-label">
              <div style={styles.labelBrand}>SHOPBOOK POS</div>
              <div style={styles.labelProductName}>{product.name}</div>
              <div style={styles.labelPrice}>
                Rs. {product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>

              {/* Barcode SVG Container */}
              <div style={styles.barcodeWrapper}>
                <svg
                  ref={barcodeSvgRef}
                  style={{ width: '100%', height: 'auto', maxHeight: '75px' }}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div style={styles.actionsPanel}>
            <div style={styles.metaBox}>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Barcode Value:</span>
                <span style={styles.metaValue}>{product.barcode}</span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Symbology:</span>
                <span style={styles.metaValue}>{barcodeFormat}</span>
              </div>
            </div>

            <div style={styles.buttonCol}>
              <button onClick={handlePrint} style={styles.printBtn}>
                <Printer size={16} />
                <span>Print Thermal Label</span>
              </button>

              <button onClick={handleDownloadLabel} style={styles.actionBtn}>
                <Download size={16} />
                <span>Download Label</span>
              </button>

              <button onClick={handleCopyCode} style={styles.actionBtn}>
                {copied ? <CheckCircle2 size={16} color="var(--success)" /> : <Copy size={16} />}
                <span>{copied ? 'Barcode Copied!' : 'Copy Barcode'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    animation: 'modalSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: '#f8fafc',
  },
  modalTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#0f172a',
  },
  modalSubtitle: {
    margin: 0,
    fontSize: '12px',
    color: '#64748b',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  previewSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  previewLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  labelCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
  },
  labelBrand: {
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  labelProductName: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#0f172a',
    marginTop: '4px',
    textAlign: 'center',
    lineHeight: 1.25,
  },
  labelPrice: {
    fontSize: '16px',
    fontWeight: 900,
    color: '#0f172a',
    marginTop: '2px',
  },
  barcodeWrapper: {
    margin: '12px 0 0 0',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  actionsPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  metaBox: {
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    padding: '12px',
    border: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
  },
  metaLabel: {
    color: '#64748b',
    fontWeight: 500,
  },
  metaValue: {
    color: '#0f172a',
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  buttonCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  printBtn: {
    backgroundColor: 'var(--primary, #2563eb)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '11px 16px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  actionBtn: {
    backgroundColor: '#ffffff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
};
