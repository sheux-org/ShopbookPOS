import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, Download, Sparkles, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
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
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detect format (EAN-13 if 13 digits, otherwise CODE128)
  const isEan13 = /^\d{13}$/.test(product.barcode);
  const barcodeFormat = isEan13 ? 'EAN13' : 'CODE128';

  useEffect(() => {
    if (isOpen && product.barcode) {
      // Generate Barcode SVG using JsBarcode
      setTimeout(() => {
        if (barcodeSvgRef.current) {
          try {
            JsBarcode(barcodeSvgRef.current, product.barcode, {
              format: barcodeFormat,
              lineColor: '#0f172a',
              width: 2,
              height: 70,
              displayValue: true,
              font: 'Inter, sans-serif',
              fontSize: 14,
              fontOptions: 'bold',
              margin: 10,
            });
          } catch (err) {
            console.error('Failed to generate barcode SVG:', err);
          }
        }
      }, 50);

      // Generate QR Code Data URL using qrcode library
      QRCode.toDataURL(
        product.barcode,
        {
          width: 300,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (err, url) => {
          if (err) console.error('Failed to generate QR Code:', err);
          else setQrCodeUrl(url);
        }
      );
    }
  }, [isOpen, product.barcode, barcodeFormat]);

  if (!isOpen) return null;

  const handlePrint = () => {
    // Open a print-specific window and print the label
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
              padding: 10px;
              text-align: center;
              color: #0f172a;
              background-color: #ffffff;
            }
            .label-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100%;
              box-sizing: border-box;
            }
            .business-name {
              font-size: 8px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 2px;
              color: #64748b;
            }
            .product-name {
              font-size: 13px;
              font-weight: 800;
              margin: 4px 0;
              word-wrap: break-word;
              max-width: 100%;
            }
            .price {
              font-size: 15px;
              font-weight: 900;
              margin-bottom: 6px;
            }
            .barcode-wrapper {
              margin: 4px 0;
              max-width: 100%;
            }
            .barcode-wrapper svg {
              width: 100% !important;
              height: auto !important;
              max-height: 55px;
            }
            .qr-code {
              width: 75px;
              height: 75px;
              margin-top: 6px;
            }
            .footer-sku {
              font-size: 8px;
              color: #94a3b8;
              margin-top: 4px;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="business-name">SHOPBOOK POS SYSTEM</div>
            <div class="product-name">${product.name}</div>
            <div class="price">Rs. ${product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div class="barcode-wrapper">
              ${barcodeSvgHtml}
            </div>
            ${qrCodeUrl ? `<img class="qr-code" src="${qrCodeUrl}" alt="QR Code" />` : ''}
            <div class="footer-sku">CODE: ${product.barcode}</div>
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

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `QR_${product.name.replace(/\s+/g, '_')}_${product.barcode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                  style={{ width: '100%', height: 'auto', maxHeight: '80px' }}
                />
              </div>

              {/* QR Code Container */}
              {qrCodeUrl && (
                <div style={styles.qrWrapper}>
                  <img src={qrCodeUrl} alt="QR Code" style={styles.qrImage} />
                  <span style={styles.qrText}>Scan to Quick Sale</span>
                </div>
              )}

              <div style={styles.labelFooter}>* SYSTEM REGISTERED DIGITAL LABEL *</div>
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

              <button onClick={handleDownloadQR} style={styles.actionBtn}>
                <Download size={16} />
                <span>Download QR Image</span>
              </button>

              <button onClick={handleCopyCode} style={styles.actionBtn}>
                {copied ? (
                  <CheckCircle2 size={16} color="var(--success)" />
                ) : (
                  <Printer size={16} style={{ opacity: 0 }} />
                )}
                <span>{copied ? 'Code Copied!' : 'Copy Barcode String'}</span>
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    backdropFilter: 'blur(6px)',
    padding: '16px',
  },
  modalContent: {
    width: '100%',
    maxWidth: '560px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    animation: 'scale-up 0.2s ease-out',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  modalTitle: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#0f172a',
    margin: 0,
  },
  modalSubtitle: {
    fontSize: '11px',
    color: 'var(--muted)',
    marginTop: '2px',
    fontWeight: '500',
  },
  modalCloseBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  modalBody: {
    padding: '24px',
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr',
    gap: '24px',
    overflowY: 'auto',
    backgroundColor: '#ffffff',
  },
  previewSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  previewLabel: {
    fontSize: '9px',
    fontWeight: '800',
    color: 'var(--muted)',
    letterSpacing: '1px',
  },
  labelCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '18px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
  },
  labelBrand: {
    fontSize: '8px',
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  labelProductName: {
    fontSize: '13px',
    fontWeight: '800',
    color: '#0f172a',
    marginTop: '6px',
    textAlign: 'center',
    lineHeight: '1.3',
  },
  labelPrice: {
    fontSize: '15px',
    fontWeight: '900',
    color: '#0f172a',
    marginTop: '4px',
  },
  barcodeWrapper: {
    width: '100%',
    margin: '12px 0 6px 0',
    display: 'flex',
    justifyContent: 'center',
  },
  qrWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '8px',
    gap: '4px',
  },
  qrImage: {
    width: '75px',
    height: '75px',
    border: '1px solid #f1f5f9',
    borderRadius: '6px',
  },
  qrText: {
    fontSize: '7px',
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  labelFooter: {
    fontSize: '7px',
    color: '#cbd5e1',
    marginTop: '12px',
    fontWeight: '700',
    letterSpacing: '0.3px',
  },
  actionsPanel: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
  },
  metaBox: {
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    padding: '12px',
    border: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
  },
  metaLabel: {
    color: 'var(--muted)',
    fontWeight: '500',
  },
  metaValue: {
    color: '#0f172a',
    fontWeight: '700',
  },
  buttonCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '20px',
  },
  printBtn: {
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
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)',
    transition: 'background-color 0.2s',
  },
  actionBtn: {
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
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};
