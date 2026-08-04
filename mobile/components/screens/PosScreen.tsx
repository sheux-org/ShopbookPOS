import { Feather, Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOKENS } from '../../constants/tokens';
import { usePermission } from '../../hooks/usePermissionHandler';
import { useFindProductByCode, DBProduct } from '../../hooks/useProducts';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { ScreenWrapper } from '../common/ScreenWrapper';
import { HeaderCartButton } from '../common/HeaderCartButton';
import { cartState } from '../data/cartState';
import { InvoiceItemCard } from '../common/InvoiceItemCard';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { PremiumUpgradeModal } from '../common/PremiumUpgradeModal';
import { hapticFeedback } from '../../utils/haptics';
import { useTranslation } from '../../hooks/useTranslation';

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  icon?: string;
  stockCount?: number;
  sku?: string;
}

export const PosScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { requestCameraAccess, hasCameraAccess } = usePermission();
  const { role } = useUserPermissions();
  const { t } = useTranslation();

  const [activeMode, setActiveMode] = useState<'scan' | 'quick_code'>('scan');

  // Sync state with shared cartState store
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const lastScanTime = useRef<number>(0);

  useEffect(() => {
    const syncCart = () => {
      setInvoiceItems(cartState.getCart());
    };
    syncCart();
    // Auto-generate invoice number once on mount
    const rand = Math.floor(100000 + Math.random() * 900000);
    setInvoiceNumber(`##${rand}`);
    return cartState.subscribe(syncCart);
  }, []);

  // Request permissions automatically when switching to scan tab
  useEffect(() => {
    if (activeMode === 'scan') {
      if (!hasCameraAccess) {
        requestCameraAccess();
      }
    }
  }, [activeMode, hasCameraAccess, requestCameraAccess]);

  // Quick code state
  const [quickCode, setQuickCode] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);

  const isPremium = useSettingsStore((s) => s.isPremium);
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);

  const findProductByCode = useFindProductByCode();
  const [matchedProduct, setMatchedProduct] = useState<DBProduct | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!quickCode) {
      setMatchedProduct(null);
      return;
    }

    findProductByCode(quickCode).then((prod) => {
      if (isMounted) {
        setMatchedProduct(prod);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [quickCode, findProductByCode]);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Laser animation for mockup scanner inside the panel
  const laserAnim = useRef(new Animated.Value(0)).current;

  // Blinking cursor effect for Quick Code input
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Mockup scanner animation loop
  useEffect(() => {
    if (activeMode === 'scan') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [activeMode, laserAnim]);

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 68],
  });

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 1500);
  };

  // Helper to add item to invoice using cartState
  const addItemToInvoice = useCallback(
    (name: string, price: number, icon?: string, sku?: string, stock?: number) => {
      cartState.addCartItem(name, price, icon, sku, stock);
      showToast(`Added ${name} to invoice`);
    },
    []
  );

  // Total invoice calculation
  const totalInvoiceAmount = useMemo(() => {
    return invoiceItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [invoiceItems]);

  // Handle numpad key presses
  const handleNumPress = (val: string) => {
    hapticFeedback.impactLight();
    if (val === 'backspace') {
      setQuickCode((prev) => prev.slice(0, -1));
    } else if (val === '.') {
      if (!quickCode.includes('.')) {
        setQuickCode((prev) => prev + '.');
      }
    } else {
      if (quickCode.length < 6) {
        setQuickCode((prev) => prev + val);
      }
    }
  };

  // Auto-add product if fully typed valid quick code from dynamic catalog
  useEffect(() => {
    if (!matchedProduct || !quickCode) return;
    const timer = setTimeout(() => {
      addItemToInvoice(
        matchedProduct.name,
        matchedProduct.price,
        matchedProduct.icon,
        `SKU 23400${matchedProduct.id}`,
        matchedProduct.stockCount
      );
      setQuickCode(''); // Reset after adding
    }, 700);
    return () => clearTimeout(timer);
  }, [matchedProduct, quickCode, addItemToInvoice]);

  // Camera Barcode Scanning Handler
  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    // Prevent double rapid scan triggers
    if (lastScanTime.current && Date.now() - lastScanTime.current < 2000) return;
    lastScanTime.current = Date.now();

    findProductByCode(data).then((prod) => {
      if (prod) {
        addItemToInvoice(prod.name, prod.price, prod.icon, `SKU 23400${prod.id}`, prod.stockCount);
      } else {
        Alert.alert(
          t('common.error'),
          `Scanned code "${data}" is not registered in catalog. Please register it in Stocks Screen first.`,
          [{ text: t('common.ok') }]
        );
      }
    });
  };

  return (
    <ScreenWrapper noPaddingBottom style={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header matching exact layout of user upload */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push('/')}
        >
          <Feather name="chevron-left" size={24} color={TOKENS.dark} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>Shopbook POS</Text>
          <Text style={styles.headerSubtitle}>
            {t('history.invoiceNo', { invoiceNo: invoiceNumber })}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          {role === 'admin' && (
            <TouchableOpacity
              style={styles.headerHistoryBtn}
              activeOpacity={0.7}
              onPress={() => router.push('/pos/history')}
            >
              <Feather name="list" size={16} color={TOKENS.primary} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: 'bold',
                  color: TOKENS.primary,
                  marginLeft: 4,
                }}
              >
                {t('navigation.history')}
              </Text>
            </TouchableOpacity>
          )}

          <HeaderCartButton />
        </View>
      </View>

      {/* Items Scrollable List */}
      <ScrollView
        style={styles.itemsList}
        contentContainerStyle={styles.itemsListContent}
        showsVerticalScrollIndicator={false}
      >
        {invoiceItems.map((item) => (
          <InvoiceItemCard key={item.id} item={item} />
        ))}

        {invoiceItems.length === 0 && (
          <View style={styles.emptyInvoiceState}>
            <Feather name="shopping-bag" size={40} color={TOKENS.muted} />
            <Text style={styles.emptyInvoiceTitle}>{t('cart.emptyCartTitle')}</Text>
            <Text style={styles.emptyInvoiceSub}>{t('cart.emptyCartSubtitle')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Panel - Segmented Control, Input Mode View, Numpad */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 75 }]}>
        {/* Three-column Mode Buttons */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeMode === 'quick_code' && styles.segmentButtonActive,
            ]}
            onPress={() => {
              hapticFeedback.selection();
              setActiveMode('quick_code');
            }}
            activeOpacity={0.8}
          >
            <Feather
              name="edit"
              size={15}
              color={activeMode === 'quick_code' ? TOKENS.card : TOKENS.dark}
            />
            <Text
              style={[styles.segmentText, activeMode === 'quick_code' && styles.segmentTextActive]}
            >
              {t('pos.quickCode')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentButton, activeMode === 'scan' && styles.segmentButtonActive]}
            onPress={() => {
              hapticFeedback.selection();
              if (isPremium) {
                setActiveMode('scan');
              } else {
                setPremiumModalVisible(true);
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="barcode-outline"
              size={16}
              color={activeMode === 'scan' ? TOKENS.card : TOKENS.dark}
            />
            <Text style={[styles.segmentText, activeMode === 'scan' && styles.segmentTextActive]}>
              {t('pos.scan')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.segmentButton}
            onPress={() => {
              hapticFeedback.selection();
              router.push('/pos/search');
            }}
            activeOpacity={0.8}
          >
            <Feather name="search" size={15} color={TOKENS.dark} />
            <Text style={styles.segmentText}>{t('pos.search')}</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Mode Area */}
        <View style={styles.modeContentWrapper}>
          {activeMode === 'quick_code' && (
            <View>
              {/* Quick Code box styled exactly as image */}
              <View style={styles.quickCodeBox}>
                <View style={styles.quickCodeTextCol}>
                  <Text style={styles.quickCodeBoxLabel}>{t('pos.quickCode')}</Text>
                  <View style={styles.codeTextRow}>
                    <Text style={styles.quickCodeVal}>{quickCode}</Text>
                    {cursorVisible && <View style={styles.blueCursor} />}
                  </View>
                </View>

                {/* Right side matches or action indicators */}
                <View style={styles.quickCodeMatchCol}>
                  {matchedProduct ? (
                    <TouchableOpacity
                      style={styles.matchBadgeClickable}
                      activeOpacity={0.7}
                      onPress={() => {
                        addItemToInvoice(
                          matchedProduct.name,
                          matchedProduct.price,
                          matchedProduct.icon
                        );
                        setQuickCode('');
                      }}
                    >
                      <Text style={styles.matchedText}>{matchedProduct.name}</Text>
                      <View style={styles.addSmallBadge}>
                        <Feather name="plus" size={12} color={TOKENS.card} />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    quickCode.length >= 4 && <Text style={styles.noMatchText}>No match</Text>
                  )}
                </View>
              </View>

              {/* Numpad Block */}
              <View style={styles.numpadContainer}>
                <View style={styles.numpadRow}>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress('1')}>
                    <Text style={styles.numpadBtnText}>1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress('2')}>
                    <Text style={styles.numpadBtnText}>2</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress('3')}>
                    <Text style={styles.numpadBtnText}>3</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.numpadRow}>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress('4')}>
                    <Text style={styles.numpadBtnText}>4</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress('5')}>
                    <Text style={styles.numpadBtnText}>5</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress('6')}>
                    <Text style={styles.numpadBtnText}>6</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.numpadRow}>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress('7')}>
                    <Text style={styles.numpadBtnText}>7</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress('8')}>
                    <Text style={styles.numpadBtnText}>8</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress('9')}>
                    <Text style={styles.numpadBtnText}>9</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.numpadRow}>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress('.')}>
                    <Text style={styles.numpadBtnText}>.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress('0')}>
                    <Text style={styles.numpadBtnText}>0</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.numpadBtn, styles.deleteBtn]}
                    onPress={() => handleNumPress('backspace')}
                  >
                    <Ionicons name="backspace-outline" size={22} color={TOKENS.dark} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {activeMode === 'scan' && (
            <View style={styles.scanWrapper}>
              <Text style={styles.scanLabel}>{t('pos.barcodeScanActive')}</Text>

              {/* Viewfinder box containing live CameraView */}
              <View style={styles.mockViewfinder}>
                {hasCameraAccess ? (
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    barcodeScannerSettings={{
                      barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8', 'qr', 'code128', 'code39'],
                    }}
                    onBarcodeScanned={handleBarcodeScanned}
                  />
                ) : (
                  <View
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 16,
                    }}
                  >
                    <Text
                      style={{
                        color: '#fff',
                        fontSize: 12,
                        textAlign: 'center',
                        marginBottom: 10,
                      }}
                    >
                      {t('pos.scanCameraRequired')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => requestCameraAccess()}
                      style={{
                        backgroundColor: TOKENS.primary,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 'bold',
                        }}
                      >
                        {t('pos.scanCameraPermissionBtn')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Viewfinder brackets overlay */}
                <View style={styles.bracketContainer}>
                  <View style={[styles.scanCorner, styles.topLeftScan]} />
                  <View style={[styles.scanCorner, styles.topRightScan]} />
                  <View style={[styles.scanCorner, styles.bottomLeftScan]} />
                  <View style={[styles.scanCorner, styles.bottomRightScan]} />

                  {/* Moving animated sweep laser */}
                  <Animated.View
                    style={[styles.scanLaser, { transform: [{ translateY: laserTranslateY }] }]}
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Proceed to Checkout button placed perfectly below inputs */}
        {invoiceItems.length > 0 && (
          <TouchableOpacity
            style={[styles.summaryBarButton, { marginTop: 12 }]}
            activeOpacity={0.85}
            onPress={() => {
              hapticFeedback.selection();
              router.push('/pos/cart');
            }}
          >
            <View style={styles.summaryBarLeft}>
              <Feather name="shopping-bag" size={16} color={TOKENS.card} style={styles.bagIcon} />
              <Text style={styles.summaryLabelActive}>{t('pos.proceedToCheckout')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.summaryValueActive}>
                Rs. {totalInvoiceAmount.toLocaleString()}
              </Text>
              <Feather name="arrow-right" size={16} color={TOKENS.card} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      <PremiumUpgradeModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
        featureName="In-app barcode transactions scanning"
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  toastContainer: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    backgroundColor: TOKENS.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 999,
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.15)',
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.card,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 1,
  },
  holdButton: {
    backgroundColor: TOKENS.lightBlue,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  holdButtonText: {
    color: TOKENS.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  itemsList: {
    flex: 1,
  },
  itemsListContent: {
    padding: 16,
    gap: 12,
  },

  emptyInvoiceState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyInvoiceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  emptyInvoiceSub: {
    fontSize: 13,
    color: TOKENS.muted,
    textAlign: 'center',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TOKENS.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
  },
  summaryBarButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 20,
    height: 48,
    marginHorizontal: 16,
    marginTop: 3,
    borderRadius: 24,
    boxShadow: `0px 4px 6px 0px ${TOKENS.primary}4D`,
  },
  summaryBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bagIcon: {
    marginTop: -1,
  },
  summaryLabelActive: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.card,
  },
  summaryValueActive: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.card,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.muted,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: 'bold',
    color: TOKENS.primary,
  },
  bottomPanel: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    paddingTop: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 3,
    height: 40,
    gap: 2,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 6,
  },
  segmentButtonActive: {
    backgroundColor: TOKENS.primary,
    boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.1)',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.muted,
  },
  segmentTextActive: {
    color: TOKENS.card,
    fontWeight: '700',
  },
  modeContentWrapper: {
    marginTop: 6,
    paddingHorizontal: 16,
  },
  quickCodeBox: {
    backgroundColor: TOKENS.card,
    borderWidth: 1.5,
    borderColor: TOKENS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: `0px 1px 3px 0px ${TOKENS.primary}0D`,
  },
  quickCodeTextCol: {
    flexDirection: 'column',
  },
  quickCodeBoxLabel: {
    fontSize: 10,
    color: TOKENS.muted,
    fontWeight: '500',
  },
  codeTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    height: 22,
  },
  quickCodeVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.dark,
    letterSpacing: 1.5,
  },
  blueCursor: {
    width: 2,
    height: 18,
    backgroundColor: TOKENS.primary,
    marginLeft: 4,
  },
  quickCodeMatchCol: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  matchBadgeClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  matchedText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.primary,
  },
  addSmallBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: TOKENS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMatchText: {
    fontSize: 12,
    color: TOKENS.error,
    fontWeight: '600',
  },
  numpadContainer: {
    marginTop: 6,
    gap: 5,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 5,
  },
  numpadBtn: {
    flex: 1,
    height: 38,
    backgroundColor: TOKENS.card,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1px 1px 0px rgba(0, 0, 0, 0.02)',
  },
  deleteBtn: {
    backgroundColor: '#F9FAFB',
  },
  numpadBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  scanWrapper: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  scanLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.muted,
    letterSpacing: 0.5,
  },
  mockViewfinder: {
    width: '100%',
    height: 104,
    backgroundColor: '#111827',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  bracketContainer: {
    width: 140,
    height: 72,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCorner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: TOKENS.yellow,
  },
  topLeftScan: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  topRightScan: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  bottomLeftScan: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  bottomRightScan: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  dummyBarcode: {
    flexDirection: 'row',
    gap: 3,
    height: 32,
    alignItems: 'center',
  },
  dummyBar: {
    height: '100%',
    backgroundColor: TOKENS.card,
    borderRadius: 0.5,
  },
  scanLaser: {
    position: 'absolute',
    top: 0,
    left: 2,
    right: 2,
    height: 2,
    backgroundColor: TOKENS.yellow,
    boxShadow: `0px 0px 3px 0px ${TOKENS.yellow}CC`,
  },
  scanActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.primary,
    width: '100%',
    height: 42,
    borderRadius: 10,
    gap: 8,
  },
  scanActionBtnText: {
    color: TOKENS.card,
    fontWeight: 'bold',
    fontSize: 14,
  },
  searchWrapper: {
    gap: 10,
    height: 236,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TOKENS.dark,
  },
  searchResultLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: TOKENS.muted,
    letterSpacing: 0.5,
  },
  searchResultsContainer: {
    flex: 1,
  },
  searchResultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  searchResultCard: {
    width: '48%',
    backgroundColor: TOKENS.card,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchProdIcon: {
    fontSize: 18,
  },
  searchProdName: {
    flex: 1,
    fontSize: 11,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  searchProdPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.primary,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 19,
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    paddingHorizontal: 12,
  },
});
