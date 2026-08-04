import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Modal, Alert, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import Barcode from 'react-native-barcode-svg';
import { SvgXml } from 'react-native-svg';
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
 * Offline-first EAN-13 SVG Generator according to standard EAN-13 specification.
 * Renders lead digit on far left, split 6+6 digit groups under data bars, and extended guard bars.
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

  let svg =
    '<svg viewBox="0 0 115 65" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated; max-height: 85px;">';
  for (let i = 0; i < 95; i++) {
    if (binary[i] === '1') {
      const isGuard = i < 3 || (i >= 45 && i < 50) || i >= 92;
      const height = isGuard ? 53 : 46;
      svg += `<rect x="${i + 10}" y="0" width="1" height="${height}" fill="#000000" />`;
    }
  }
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
  const isEan13 = /^\d{13}$/.test(product.barcode);

  const getLabelHtml = () => {
    const barcodeFormat = isEan13 ? 'EAN13' : 'CODE128';
    let barcodeHtml = '';

    if (isEan13) {
      barcodeHtml = generateEan13Svg(product.barcode);
    } else {
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

    return `
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
              padding: 16px 14px;
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
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              margin-bottom: 6px;
              color: #4b5563;
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
              margin: 8px 0 4px 0;
              width: 100%;
              display: flex;
              justify-content: center;
            }
            .barcode-wrapper svg {
              width: 100% !important;
              height: auto !important;
              max-height: 60px;
            }
            .barcode-number {
              font-family: monospace;
              font-size: 12px;
              font-weight: 700;
              color: #111827;
              letter-spacing: 1.5px;
              margin-top: 4px;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="business-name">SHOPBOOK POS</div>
            <div class="product-name">${product.name}</div>
            <div class="price">Rs. ${product.price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}</div>
            <div class="barcode-wrapper">
              ${barcodeHtml}
            </div>
            ${!isEan13 ? `<div class="barcode-number">${product.barcode}</div>` : ''}
          </div>
        </body>
      </html>
    `;
  };

  const handleCopyBarcode = async () => {
    await Clipboard.setStringAsync(product.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintLabel = async () => {
    try {
      const html = getLabelHtml();
      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Print Failed', err.message || 'Failed to print thermal label.');
    }
  };

  const handleDownloadLabel = async () => {
    try {
      const html = getLabelHtml();
      const { uri } = await Print.printToFileAsync({ html });
      Alert.alert(
        'Label Document Created 📄',
        `Label file for "${product.name}" has been generated.\nLocation: ${uri}`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Failed to generate label file.');
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

              {/* Standard EAN-13 SVG / Code128 vector rendering */}
              <View style={styles.barcodeBox}>
                {isEan13 ? (
                  <SvgXml xml={generateEan13Svg(product.barcode)} width={230} height={70} />
                ) : (
                  <>
                    <Barcode
                      value={product.barcode}
                      format="CODE128"
                      singleBarWidth={1.8}
                      height={52}
                      maxWidth={240}
                    />
                    <Text style={styles.barcodeNumberText}>{product.barcode}</Text>
                  </>
                )}
              </View>
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
              style={styles.downloadBtn}
              activeOpacity={0.8}
              onPress={handleDownloadLabel}
            >
              <Feather name="download" size={16} color={TOKENS.dark} style={{ marginRight: 8 }} />
              <Text style={styles.downloadBtnText}>Download Label</Text>
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
                {copied ? 'Barcode Copied!' : 'Copy Barcode'}
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
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6B7280',
    letterSpacing: 1.5,
  },
  labelProductName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  labelPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },
  barcodeBox: {
    marginVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  barcodeNumberText: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 2,
    marginTop: 6,
    textAlign: 'center',
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
  downloadBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  downloadBtnText: {
    color: TOKENS.dark,
    fontWeight: '600',
    fontSize: 12,
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
