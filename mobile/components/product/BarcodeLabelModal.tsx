import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Modal, Alert, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import Barcode from 'react-native-barcode-svg';
import { SvgXml } from 'react-native-svg';
import QRCode from 'qrcode';
import { TOKENS } from '../../constants/tokens';

interface BarcodeLabelModalProps {
  visible: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    price: number;
    category: string;
    barcode: string;
  };
}

/**
 * Offline-first EAN-13 SVG Generator.
 * Returns an inline XML SVG string for the printed HTML.
 */
function generateEan13Svg(barcode: string): string {
  if (!/^\d{13}$/.test(barcode)) return '';
  const first = parseInt(barcode[0], 10);
  const left = barcode.substring(1, 7);
  const right = barcode.substring(7, 13);

  const parities = [
    'LLLLLL', // 0
    'LLGLGG', // 1
    'LLGGLG', // 2
    'LLGGGL', // 3
    'LGLLGG', // 4
    'LGGLLG', // 5
    'LGGGLL', // 6
    'LGLGLG', // 7
    'LGLGGL', // 8
    'LGGLGL', // 9
  ];

  const L = [
    '0001101',
    '0011001',
    '0010011',
    '0111101',
    '0100011',
    '0110001',
    '0101111',
    '0111011',
    '0110111',
    '0001011',
  ];

  const G = [
    '0100111',
    '0110011',
    '0011011',
    '0100001',
    '0011101',
    '0111001',
    '0000101',
    '0010001',
    '0001001',
    '0010111',
  ];

  const R = [
    '1110010',
    '1100110',
    '1101100',
    '1000010',
    '1011100',
    '1001110',
    '1010000',
    '1000100',
    '1001000',
    '1110100',
  ];

  let binary = '101'; // Left guard
  const parity = parities[first];

  for (let i = 0; i < 6; i++) {
    const digit = parseInt(left[i], 10);
    const code = parity[i];
    if (code === 'L') {
      binary += L[digit];
    } else {
      binary += G[digit];
    }
  }

  binary += '01010'; // Center guard

  for (let i = 0; i < 6; i++) {
    const digit = parseInt(right[i], 10);
    binary += R[digit];
  }

  binary += '101'; // Right guard

  // Build the SVG vector elements. Total modules: 95. We use a viewBox of 0 0 115 65 to add margins.
  let svg =
    '<svg viewBox="0 0 115 65" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated; max-height: 80px;">';
  for (let i = 0; i < 95; i++) {
    if (binary[i] === '1') {
      // Guards (left, center, right) extend slightly lower (55px) than data bars (48px)
      const isGuard = i < 3 || (i >= 45 && i < 50) || i >= 92;
      const height = isGuard ? 53 : 46;
      svg += `<rect x="${i + 10}" y="0" width="1" height="${height}" fill="#000000" />`;
    }
  }
  // Add human-readable numbers
  svg += `<text x="2" y="58" font-family="monospace" font-size="10" font-weight="bold">${barcode[0]}</text>`;
  svg += `<text x="18" y="58" font-family="monospace" font-size="10" font-weight="bold" letter-spacing="3.5">${left}</text>`;
  svg += `<text x="65" y="58" font-family="monospace" font-size="10" font-weight="bold" letter-spacing="3.5">${right}</text>`;
  svg += '</svg>';

  return svg;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  visible,
  onClose,
  product,
}) => {
  const [copied, setCopied] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string>('');
  const isEan13 = /^\d{13}$/.test(product.barcode);

  // Generate offline-friendly QR code as vector SVG
  useEffect(() => {
    if (visible && product.barcode) {
      QRCode.toString(
        product.barcode,
        {
          type: 'svg',
          width: 80,
          margin: 1,
        },
        (err, xml) => {
          if (err) {
            console.error('Failed to generate local QR Code SVG:', err);
          } else {
            setQrCodeSvg(xml);
          }
        }
      );
    } else {
      setQrCodeSvg('');
    }
  }, [visible, product.barcode]);

  const handleCopyBarcode = async () => {
    await Clipboard.setStringAsync(product.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintLabel = async () => {
    try {
      const barcodeFormat = isEan13 ? 'EAN13' : 'CODE128';
      let barcodeHtml = '';

      if (isEan13) {
        barcodeHtml = generateEan13Svg(product.barcode);
      } else {
        // Fallback for non-EAN-13: load JsBarcode from CDN
        barcodeHtml = `
          <svg id="barcode-elem" style="width: 100%; max-height: 55px;"></svg>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <script>
            setTimeout(function() {
              try {
                JsBarcode('#barcode-elem', '${product.barcode}', {
                  format: '${barcodeFormat}',
                  lineColor: '#000000',
                  width: 2,
                  height: 50,
                  displayValue: true,
                  font: 'monospace',
                  fontSize: 12,
                  margin: 5
                });
              } catch(e) {
                console.error('JsBarcode render error:', e);
              }
            }, 50);
          </script>
        `;
      }

      const html = `
        <html>
          <head>
            <title>Print Label - ${product.name}</title>
            <style>
              @page {
                size: 58mm 80mm;
                margin: 0;
              }
              body {
                font-family: system-ui, -apple-system, sans-serif;
                margin: 0;
                padding: 10px 14px;
                text-align: center;
                color: #111827;
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
                font-size: 9px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                margin-bottom: 4px;
                color: #4b5563;
              }
              .product-name {
                font-size: 14px;
                font-weight: 800;
                margin: 4px 0;
                word-wrap: break-word;
                max-width: 100%;
                line-height: 1.2;
              }
              .price {
                font-size: 16px;
                font-weight: 900;
                margin-bottom: 6px;
                color: #000000;
              }
              .barcode-wrapper {
                margin: 6px 0;
                width: 100%;
                display: flex;
                justify-content: center;
              }
              .barcode-wrapper svg {
                width: 100% !important;
                height: auto !important;
                max-height: 55px;
              }
              .qr-code {
                width: 70px;
                height: 70px;
                margin-top: 6px;
                display: flex;
                justify-content: center;
                align-items: center;
              }
              .qr-code svg {
                width: 70px !important;
                height: 70px !important;
              }
              .footer-sku {
                font-size: 8px;
                color: #6b7280;
                margin-top: 6px;
                font-weight: 600;
                letter-spacing: 0.5px;
              }
            </style>
          </head>
          <body>
            <div class="label-container">
              <div class="business-name">SHOPBOOK POS SYSTEM</div>
              <div class="product-name">${product.name}</div>
              <div class="price">Rs. ${product.price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}</div>
              <div class="barcode-wrapper">
                ${barcodeHtml}
              </div>
              <div class="qr-code">
                ${qrCodeSvg}
              </div>
              <div class="footer-sku">CODE: ${product.barcode}</div>
            </div>
          </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Print Failed', err.message || 'Failed to print thermal label.');
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Feather name="tag" size={18} color={TOKENS.primary} />
              <View>
                <Text style={styles.title}>Product Scan Label</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {product.name}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Feather name="x" size={18} color={TOKENS.muted} />
            </TouchableOpacity>
          </View>

          {/* Body Scroll */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {/* Print Preview */}
            <Text style={styles.sectionLabel}>PRINT PREVIEW (58mm x 80mm Roll)</Text>
            <View style={styles.labelPreview}>
              <Text style={styles.labelBrand}>SHOPBOOK POS</Text>
              <Text style={styles.labelProductName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.labelPrice}>
                Rs. {product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>

              {/* Barcode SVG rendering using react-native-barcode-svg */}
              <View style={styles.barcodeBox}>
                <Barcode
                  value={product.barcode}
                  format={isEan13 ? 'EAN13' : 'CODE128'}
                  singleBarWidth={1.8}
                  height={50}
                  maxWidth={240}
                />
              </View>

              {/* QR Code */}
              <View style={styles.qrBox}>
                {qrCodeSvg ? (
                  <View style={styles.qrSvgContainer}>
                    <SvgXml xml={qrCodeSvg} width={64} height={64} />
                  </View>
                ) : (
                  <View style={styles.qrPlaceholder} />
                )}
                <Text style={styles.qrText}>Scan to Quick Sale</Text>
              </View>

              <Text style={styles.labelFooter}>* SYSTEM REGISTERED DIGITAL LABEL *</Text>
            </View>

            {/* Meta Info & Actions */}
            <View style={styles.metaBox}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Barcode:</Text>
                <Text style={styles.metaValue}>{product.barcode}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Format:</Text>
                <Text style={styles.metaValue}>{isEan13 ? 'EAN-13' : 'CODE-128'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.printBtn}
              activeOpacity={0.8}
              onPress={handlePrintLabel}
            >
              <Feather name="printer" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.printBtnText}>Print Thermal Label</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.copyBtn}
              activeOpacity={0.8}
              onPress={handleCopyBarcode}
            >
              <Feather
                name={copied ? 'check-circle' : 'copy'}
                size={14}
                color={copied ? TOKENS.success : '#374151'}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.copyBtnText, copied && { color: TOKENS.success }]}>
                {copied ? 'Barcode Copied!' : 'Copy Barcode String'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: TOKENS.card,
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    boxShadow: '0px 10px 15px 0px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: '#F9FAFB',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  subtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: 20,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: TOKENS.muted,
    letterSpacing: 1,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  labelPreview: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.05)',
    marginBottom: 16,
  },
  labelBrand: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  labelProductName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 16,
  },
  labelPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },
  barcodeBox: {
    marginVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  qrBox: {
    alignItems: 'center',
    marginTop: 6,
  },
  qrSvgContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholder: {
    width: 64,
    height: 64,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 3,
  },
  labelFooter: {
    fontSize: 7,
    color: '#D1D5DB',
    marginTop: 12,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  metaBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    width: '100%',
    gap: 6,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 11,
    color: TOKENS.dark,
    fontWeight: 'bold',
  },
  printBtn: {
    backgroundColor: TOKENS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    boxShadow: '0px 4px 6px 0px rgba(37, 99, 235, 0.15)',
    marginBottom: 8,
  },
  printBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  copyBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
  },
  copyBtnText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 12,
  },
});
