'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, CartItem, Customer } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import database from '../../db/database';
import { Q } from '@nozbe/watermelondb';
import { 
  ArrowLeft, ShoppingBag, Trash2, MinusCircle, PlusCircle, UserPlus, 
  ChevronRight, ArrowRight, DollarSign, CreditCard, Wallet, Sparkles, 
  Printer, X, CheckCircle, Barcode, Search, Edit
} from 'lucide-react';
import { useHardwareScanner } from '../../components/Scanner';
import './pos.css';


interface DBProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  stockCount: number;
  lowStockAlert?: number;
  unitType?: string;
  costPrice?: number;
  quickCode?: string;
  barcode?: string;
  isFavorite: boolean;
}

export default function PosBillingPage() {
  const router = useRouter();
  const cart = useCart((s) => s.cart);
  const customer = useCart((s) => s.customer);
  const addCartItem = useCart((s) => s.addCartItem);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const clearCart = useCart((s) => s.clearCart);
  const setCustomer = useCart((s) => s.setCustomer);
  
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const employeeName = useAuthStore((s) => s.employeeName);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);

  // States
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [activeMode, setActiveMode] = useState<'quick_code' | 'scan' | 'search'>('quick_code');
  const [quickCode, setQuickCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Mode matching product
  const [matchedProduct, setMatchedProduct] = useState<DBProduct | null>(null);

  // Customer modal
  const [showCustModal, setShowCustModal] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // Discount state
  const [discountType, setDiscountType] = useState<'none' | 'flat' | 'percent'>('none');
  const [discountVal, setDiscountVal] = useState(0);

  // Payment Tender Modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [bankName, setBankName] = useState('');
  const [cardDigits, setCardDigits] = useState('');
  const [paying, setPaying] = useState(false);

  // Completed Receipt Modal state
  const [showReceipt, setShowReceipt] = useState(false);
  const [latestOrder, setLatestOrder] = useState<any>(null);

  // Load products from IndexedDB
  const loadProducts = async () => {
    if (typeof window === 'undefined') return;
    try {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      let list: any[] = [];
      if (activeBiz && activeBiz.id !== '0') {
        const matchedBiz = await database.get('businesses').query(Q.where('name', activeBiz.name)).fetch();
        if (matchedBiz.length > 0) {
          list = await database.get('products').query(Q.where('business_id', matchedBiz[0].id)).fetch();
        }
      } else {
        list = await database.get('products').query().fetch();
      }

      setProducts(list.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category || '',
        icon: p.icon || '📦',
        stockCount: p.stockCount || 0,
        lowStockAlert: p.lowStockAlert,
        unitType: p.unitType,
        costPrice: p.costPrice,
        quickCode: p.quickCode,
        barcode: p.barcode,
        isFavorite: p.isFavorite || false
      })));
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadProducts();
    }
  }, [isLoggedIn, activeBusiness]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

  // Quick code matching
  useEffect(() => {
    if (!quickCode) {
      setMatchedProduct(null);
      return;
    }
    const match = products.find(p => p.quickCode === quickCode);
    if (match) {
      setMatchedProduct(match);
      // Auto-add product if valid code typed
      const timer = setTimeout(() => {
        if (match.stockCount <= 0) {
          triggerToast(`Out of stock: ${match.name} ⚠️`);
          setQuickCode('');
          return;
        }
        addCartItem(match.name, match.price, match.icon, match.barcode || match.id, match.stockCount);
        triggerToast(`Added ${match.name} 🛒`);
        setQuickCode('');
      }, 700);
      return () => clearTimeout(timer);
    } else {
      setMatchedProduct(null);
    }
  }, [quickCode, products]);

  // Scan handler
  const handleScanCode = (barcode: string) => {
    const matched = products.find(p => p.barcode === barcode || p.quickCode === barcode);
    if (matched) {
      if (matched.stockCount <= 0) {
        triggerToast(`Out of stock: ${matched.name} ⚠️`);
        return;
      }
      addCartItem(matched.name, matched.price, matched.icon, matched.barcode || matched.id, matched.stockCount);
      triggerToast(`Added ${matched.name} 🛒`);
    } else {
      triggerToast(`Barcode ${barcode} not in catalog ⚠️`);
    }
  };

  // Hardware Scanner Hook activation
  useHardwareScanner(handleScanCode);

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'flat') return discountVal;
    if (discountType === 'percent') return (subtotal * discountVal) / 100;
    return 0;
  }, [subtotal, discountType, discountVal]);

  const taxAmount = useMemo(() => {
    return ((subtotal - discountAmount) * 8) / 100;
  }, [subtotal, discountAmount]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount + taxAmount);
  }, [subtotal, discountAmount, taxAmount]);

  const changeDue = useMemo(() => {
    const cash = parseFloat(cashReceived) || 0;
    return Math.max(0, cash - totalAmount);
  }, [cashReceived, totalAmount]);

  // Submit checkout Order to WatermelonDB
  const handleConfirmCheckout = async () => {
    if (cart.length === 0) return;
    setPaying(true);

    try {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      let dbBiz: any;
      
      await database.write(async () => {
        const bizs = await database.get('businesses').query(Q.where('name', activeBiz.name)).fetch();
        if (bizs.length > 0) {
          dbBiz = bizs[0];
        } else {
          dbBiz = await database.get('businesses').create((b: any) => {
            b.name = activeBiz.name;
            b.businessType = activeBiz.category;
            b.address = activeBiz.address;
            b.phoneNumber = activeBiz.phone;
          });
        }

        const invoiceNum = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
        const newOrder = await database.get('orders').create((ord: any) => {
          ord.business.set(dbBiz);
          ord.invoiceNumber = invoiceNum;
          ord.totalAmount = totalAmount;
          ord.status = 'paid';
          ord.paymentMethod = paymentMethod;
          if (paymentMethod === 'bank') ord.bankName = bankName;
          if (paymentMethod === 'card') ord.cardLastFour = cardDigits.slice(-4);
          ord.discountType = discountType;
          ord.discountValue = discountAmount;
          ord.taxRate = 8;
          ord.taxValue = taxAmount;
        });

        for (const item of cart) {
          const dbProducts = await database.get('products').query(Q.where('name', item.name)).fetch();
          let matchedProduct = null;
          
          if (dbProducts.length > 0) {
            matchedProduct = dbProducts[0];
            await matchedProduct.update((p: any) => {
              p.stockCount = Math.max(0, p.stockCount - item.quantity);
            });
          }

          await database.get('order_items').create((oi: any) => {
            oi.order.set(newOrder);
            if (matchedProduct) {
              oi.product.set(matchedProduct);
            }
            oi.name = item.name;
            oi.quantity = item.quantity;
            oi.price = item.price;
          });

          if (matchedProduct) {
            await database.get('inventory_logs').create((log: any) => {
              log.product.set(matchedProduct);
              log.type = 'out';
              log.quantity = item.quantity;
              log.reason = `Order Sale ${invoiceNum}`;
            });
          }
        }

        setLatestOrder({
          invoiceNumber: invoiceNum,
          totalAmount,
          paymentMethod,
          subtotal,
          discountAmount,
          taxAmount,
          customer: customer ? { ...customer } : null,
          items: [...cart],
          date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      });

      triggerToast('Invoice completed successfully! 📑');
      setShowPayModal(false);
      setShowReceipt(true);
      clearCart();
      setCustomer(null);
      setDiscountType('none');
      setDiscountVal(0);
      setCashReceived('');
      setBankName('');
      setCardDigits('');
      loadProducts();
    } catch (err) {
      console.error('Failed to complete sale checkout:', err);
    } finally {
      setPaying(false);
    }
  };

  // Numpad key helper
  const handleNumpadPress = (val: string) => {
    if (val === 'backspace') {
      setQuickCode(prev => prev.slice(0, -1));
    } else if (val === '.') {
      if (!quickCode.includes('.')) {
        setQuickCode(prev => prev + '.');
      }
    } else {
      if (quickCode.length < 6) {
        setQuickCode(prev => prev + val);
      }
    }
  };

  // Search filtered products
  const searchedProductsList = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.quickCode && p.quickCode.includes(searchQuery)));
  }, [products, searchQuery]);

  return (
    <div style={styles.workspace} className="fade-in">
      {/* Toast popup */}
      {toastMsg && (
        <div style={styles.toast}>
          <CheckCircle size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* POS Screen Header */}
      <div style={styles.posHeader}>
        <button onClick={() => router.push('/')} style={styles.backBtn} title="Back to Products Catalog">
          <ArrowLeft size={18} />
          <span>Home</span>
        </button>
        <div style={styles.headerInfo}>
          <h2 style={styles.headerTitle}>Active Terminal POS</h2>
          <p style={styles.headerSubtitle}>{cart.length} unique items in active invoice</p>
        </div>
      </div>

      <div style={styles.gridContainer}>
        {/* Left pane: Cart Invoice Item list */}
        <div style={styles.invoicePane}>
          <div style={styles.paneTitleBar}>
            <h3 style={styles.paneTitle}>Invoice Summary</h3>
            {cart.length > 0 && (
              <button 
                onClick={() => {
                  if (confirm('Clear entire cart invoice?')) {
                    clearCart();
                    triggerToast('Cart cleared');
                  }
                }}
                style={styles.clearBtn}
              >
                Clear Cart
              </button>
            )}
          </div>

          <div style={styles.cartScroller}>
            {cart.map((item) => (
              <div key={item.id} style={styles.cartItemRow}>
                <span style={styles.cartItemIcon}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={styles.cartItemName}>{item.name}</h4>
                  <span style={styles.cartItemPrice}>Rs. {item.price.toLocaleString()}</span>
                </div>
                
                {/* Quantity adjustments */}
                <div style={styles.qtyContainer}>
                  <button onClick={() => updateQuantity(item.id, -1)} style={styles.qtyBtn}>
                    <MinusCircle size={16} />
                  </button>
                  <span style={styles.qtyText}>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} style={styles.qtyBtn}>
                    <PlusCircle size={16} />
                  </button>
                </div>

                <span style={styles.cartItemSum}>
                  Rs. {(item.price * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}

            {cart.length === 0 && (
              <div style={styles.emptyCartState}>
                <ShoppingBag size={48} color="var(--muted)" style={{ opacity: 0.5 }} />
                <h4>No items in invoice</h4>
                <p>Add items from Home catalog, use quick codes or scan barcodes below to populate the invoice.</p>
              </div>
            )}
          </div>

          {/* Customer Attachment panel */}
          <div style={styles.customerBar}>
            {customer ? (
              <div style={styles.customerSelectedBox}>
                <div style={{ flex: 1 }}>
                  <p style={styles.custBoxName}>{customer.name}</p>
                  <p style={styles.custBoxPhone}>{customer.phone}</p>
                </div>
                <button onClick={() => setCustomer(null)} style={styles.custBoxRemove}>Detach</button>
              </div>
            ) : (
              <button onClick={() => setShowCustModal(true)} style={styles.attachCustBtn}>
                <UserPlus size={16} />
                <span>Attach Customer Profile</span>
              </button>
            )}
          </div>

          {/* Summary pricing checkout panel */}
          <div style={styles.summaryBox}>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Discount Option</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  onClick={() => { setDiscountType('flat'); setDiscountVal(100); }} 
                  style={{ ...styles.discOptionBtn, ...(discountType === 'flat' ? styles.discOptionActive : {}) }}
                >
                  Flat Rs. 100
                </button>
                <button 
                  onClick={() => { setDiscountType('percent'); setDiscountVal(5); }} 
                  style={{ ...styles.discOptionBtn, ...(discountType === 'percent' ? styles.discOptionActive : {}) }}
                >
                  5% Off
                </button>
                {discountType !== 'none' && (
                  <button onClick={() => { setDiscountType('none'); setDiscountVal(0); }} style={styles.discResetBtn}>Clear</button>
                )}
              </div>
            </div>

            <div style={styles.summaryDivider} />

            <div style={styles.summaryRow}>
              <span>Subtotal</span>
              <span>Rs. {subtotal.toLocaleString()}</span>
            </div>

            {discountAmount > 0 && (
              <div style={{ ...styles.summaryRow, color: 'var(--success)' }}>
                <span>Discount Applied</span>
                <span>- Rs. {discountAmount.toLocaleString()}</span>
              </div>
            )}

            <div style={styles.summaryRow}>
              <span>VAT / Tax (8%)</span>
              <span>Rs. {taxAmount.toLocaleString()}</span>
            </div>

            <div style={styles.summaryDivider} />

            <div style={styles.totalRow}>
              <span>Total Payable</span>
              <span>Rs. {totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Right pane: Bottom Controls Selector (numpad, scan viewfinder, quick search list) */}
        <div style={styles.controlsPane}>
          {/* Segmented controls tab bar */}
          <div style={styles.segmentedControl}>
            <button 
              onClick={() => setActiveMode('quick_code')}
              style={{ ...styles.segmentBtn, ...(activeMode === 'quick_code' ? styles.segmentBtnActive : {}) }}
            >
              <Edit size={16} />
              <span>Quick Code</span>
            </button>
            <button 
              onClick={() => setActiveMode('scan')}
              style={{ ...styles.segmentBtn, ...(activeMode === 'scan' ? styles.segmentBtnActive : {}) }}
            >
              <Barcode size={16} />
              <span>Scan View</span>
            </button>
            <button 
              onClick={() => setActiveMode('search')}
              style={{ ...styles.segmentBtn, ...(activeMode === 'search' ? styles.segmentBtnActive : {}) }}
            >
              <Search size={16} />
              <span>Quick Search</span>
            </button>
          </div>

          {/* Mode Area Content */}
          <div style={styles.modeArea}>
            {activeMode === 'quick_code' && (
              <div style={styles.quickCodeContainer}>
                {/* Input box */}
                <div style={styles.quickCodeBox}>
                  <div>
                    <span style={styles.quickCodeLabel}>Quick Code Typed</span>
                    <div style={styles.codeTextRow}>
                      <span style={styles.quickCodeVal}>{quickCode || '—'}</span>
                      <div className="blink-cursor" />
                    </div>
                  </div>

                  <div style={styles.matchArea}>
                    {matchedProduct ? (
                      <div style={styles.matchBadge}>
                        <span>{matchedProduct.name}</span>
                        <div style={styles.addSmallBadge}><PlusCircle size={14} /></div>
                      </div>
                    ) : (
                      quickCode.length >= 3 && <span style={styles.noMatch}>No Match</span>
                    )}
                  </div>
                </div>

                {/* Interactive Numpad */}
                <div style={styles.numpadContainer}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key) => (
                    <button
                      key={key}
                      onClick={() => handleNumpadPress(key)}
                      style={{
                        ...styles.numpadBtn,
                        ...(key === 'backspace' ? styles.numpadBtnDelete : {})
                      }}
                    >
                      {key === 'backspace' ? '⌫' : key}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeMode === 'scan' && (
              <div style={styles.scanWrapper}>
                <span style={styles.scanLabel}>CAMERA VIEWFINDER ACTIVE</span>
                <div style={styles.mockViewfinder}>
                  <div style={styles.scannerBeamContainer}>
                    <div style={styles.laserCornerTopLeft} />
                    <div style={styles.laserCornerTopRight} />
                    <div style={styles.laserCornerBottomLeft} />
                    <div style={styles.laserCornerBottomRight} />
                    <div className="laser-beam" />
                  </div>
                  <span style={styles.viewfinderInstructions}>
                    Position barcode inside the viewfinder.<br/>
                    (Hardware scanner scans are supported globally)
                  </span>
                </div>
              </div>
            )}

            {activeMode === 'search' && (
              <div style={styles.quickSearchWrapper}>
                <div style={styles.searchBoxInput}>
                  <Search size={16} color="var(--muted)" />
                  <input
                    type="text"
                    placeholder="Search item by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={styles.searchBoxInputEl}
                  />
                </div>

                <div style={styles.searchListScroller}>
                  {searchedProductsList.map((p) => {
                    const isOut = p.stockCount <= 0;
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => {
                          if (isOut) {
                            triggerToast(`Out of stock: ${p.name} ⚠️`);
                            return;
                          }
                          addCartItem(p.name, p.price, p.icon, p.barcode || p.id, p.stockCount);
                          triggerToast(`Added ${p.name} 🛒`);
                        }}
                        style={{ ...styles.searchItemCard, opacity: isOut ? 0.6 : 1 }}
                      >
                        <span style={styles.searchItemIcon}>{p.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={styles.searchItemName}>{p.name}</h4>
                          <span style={styles.searchItemMeta}>Rs. {p.price} · {p.stockCount} left</span>
                        </div>
                        <PlusCircle size={18} color="var(--primary)" />
                      </div>
                    );
                  })}

                  {!searchQuery.trim() && (
                    <div style={styles.searchEmpty}>
                      <Search size={28} color="var(--muted)" style={{ opacity: 0.5 }} />
                      <p>Type above to search the catalog</p>
                    </div>
                  )}

                  {searchQuery.trim() && searchedProductsList.length === 0 && (
                    <div style={styles.searchEmpty}>
                      <ShoppingBag size={28} color="var(--muted)" style={{ opacity: 0.5 }} />
                      <p>No matches found in catalog</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settle checkout button */}
          <button
            onClick={() => setShowPayModal(true)}
            disabled={cart.length === 0}
            style={{
              ...styles.checkoutBtn,
              ...(cart.length === 0 ? styles.checkoutBtnDisabled : {}),
            }}
          >
            <span>Proceed to Payment Settlement</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* Customer Sheet Attach Modal */}
      {showCustModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>Attach Customer Profile</h3>
              <button onClick={() => setShowCustModal(false)} style={styles.modalCloseBtn}><X size={16} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Customer Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Kasun Perera" 
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  style={styles.modalInput}
                />
              </div>
              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Phone Number</label>
                <input 
                  type="tel" 
                  placeholder="e.g. +94 77 987 6543" 
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  style={styles.modalInput}
                />
              </div>
              <button 
                onClick={() => {
                  if (!custName || !custPhone) return;
                  setCustomer({ name: custName, phone: custPhone });
                  setShowCustModal(false);
                  setCustName('');
                  setCustPhone('');
                  triggerToast('Customer attached 👤');
                }}
                disabled={!custName || !custPhone}
                style={styles.modalSubmitBtn}
              >
                Attach Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Tender Sheet Modal */}
      {showPayModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '520px' }}>
            <div style={styles.modalHeader}>
              <h3>Payment Settlement Tender</h3>
              <button onClick={() => setShowPayModal(false)} style={styles.modalCloseBtn}><X size={16} /></button>
            </div>
            <div style={styles.modalBody}>
              {/* Payment methods tabs */}
              <div style={styles.payMethodsGrid}>
                <button 
                  onClick={() => setPaymentMethod('cash')}
                  style={{ ...styles.payMethodCard, ...(paymentMethod === 'cash' ? styles.payMethodActive : {}) }}
                >
                  <DollarSign size={20} />
                  <span>Cash Payment</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('card')}
                  style={{ ...styles.payMethodCard, ...(paymentMethod === 'card' ? styles.payMethodActive : {}) }}
                >
                  <CreditCard size={20} />
                  <span>Card Payment</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('bank')}
                  style={{ ...styles.payMethodCard, ...(paymentMethod === 'bank' ? styles.payMethodActive : {}) }}
                >
                  <Wallet size={20} />
                  <span>Bank Transfer</span>
                </button>
              </div>

              {/* Total Summary */}
              <div style={styles.paySummaryBox}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)' }}>INVOICE TOTAL DUE</span>
                <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)' }}>Rs. {totalAmount.toLocaleString()}</span>
              </div>

              {/* Tender specific fields */}
              {paymentMethod === 'cash' && (
                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Cash Received</label>
                  <input 
                    type="number" 
                    placeholder="Enter cash amount..." 
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    style={styles.modalInput}
                  />
                  {parseFloat(cashReceived) > 0 && (
                    <div style={styles.changeDueBox}>
                      <span>Change Due:</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>Rs. {changeDue.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'card' && (
                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Last 4 Digits of Card</label>
                  <input 
                    type="text" 
                    maxLength={4} 
                    placeholder="e.g. 5432" 
                    value={cardDigits}
                    onChange={(e) => setCardDigits(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
              )}

              {paymentMethod === 'bank' && (
                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Beneficiary Bank Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. HNB / Commercial Bank" 
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
              )}

              <button 
                onClick={handleConfirmCheckout}
                disabled={paying}
                style={styles.payCompleteBtn}
              >
                {paying ? 'Completing sale...' : 'Confirm Checkout Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Invoice Receipt Modal */}
      {showReceipt && latestOrder && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '400px' }}>
            <div style={styles.receiptContainer}>
              <div style={styles.receiptHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} style={styles.receiptSparkle} />
                  <span style={styles.receiptStoreName}>{activeBusiness.name}</span>
                </div>
                <span style={styles.receiptStoreAddress}>{activeBusiness.address}</span>
                <span style={styles.receiptStorePhone}>Tel: {activeBusiness.phone}</span>
              </div>

              <div style={styles.receiptDivider} />

              <div style={styles.receiptMeta}>
                <span>Invoice: {latestOrder.invoiceNumber}</span>
                <span>Date: {latestOrder.date}</span>
                <span>Cashier: {employeeName}</span>
                {latestOrder.customer && (
                  <span>Customer: {latestOrder.customer.name} ({latestOrder.customer.phone})</span>
                )}
              </div>

              <div style={styles.receiptDivider} />

              <div style={styles.receiptItemsList}>
                {latestOrder.items.map((item: any, idx: number) => (
                  <div key={idx} style={styles.receiptItemRow}>
                    <span>{item.name} x{item.quantity}</span>
                    <span>Rs. {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={styles.receiptDivider} />

              <div style={styles.receiptTotals}>
                <div style={styles.receiptTotalsRow}>
                  <span>Subtotal</span>
                  <span>Rs. {latestOrder.subtotal.toLocaleString()}</span>
                </div>
                {latestOrder.discountAmount > 0 && (
                  <div style={styles.receiptTotalsRow}>
                    <span>Discount</span>
                    <span>-Rs. {latestOrder.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div style={styles.receiptTotalsRow}>
                  <span>VAT / Tax (8%)</span>
                  <span>Rs. {latestOrder.taxAmount.toLocaleString()}</span>
                </div>
                <div style={{ ...styles.receiptTotalsRow, fontWeight: 'bold', fontSize: '13px' }}>
                  <span>Total Amount</span>
                  <span>Rs. {latestOrder.totalAmount.toLocaleString()}</span>
                </div>
                <div style={styles.receiptTotalsRow}>
                  <span>Payment Mode</span>
                  <span style={{ textTransform: 'uppercase' }}>{latestOrder.paymentMethod}</span>
                </div>
              </div>

              <div style={styles.receiptDivider} />

              <div style={styles.receiptFooter}>
                <p>Thank You For Your Business!</p>
                <p style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>Powered by Shopbook OS</p>
              </div>
            </div>

            <div style={styles.receiptActions}>
              <button 
                onClick={() => {
                  window.print();
                }} 
                style={styles.printBtn}
              >
                <Printer size={16} />
                <span>Print Invoice Receipt</span>
              </button>
              <button 
                onClick={() => setShowReceipt(false)} 
                style={styles.receiptDoneBtn}
              >
                Done / New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  workspace: {
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflowY: 'hidden',
  },
  posHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '24px',
    flexShrink: 0,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: 'var(--radius)',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    color: 'var(--dark)',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
    transition: 'all 0.2s',
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: '800',
    color: 'var(--dark)',
    lineHeight: '1.2',
  },
  headerSubtitle: {
    fontSize: '12px',
    color: 'var(--muted)',
    marginTop: '2px',
  },
  gridContainer: {
    display: 'flex',
    flex: 1,
    gap: '24px',
    minHeight: 0,
  },
  invoicePane: {
    flex: 5,
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  paneTitleBar: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paneTitle: {
    fontSize: '14px',
    fontWeight: '800',
    color: 'var(--dark)',
  },
  clearBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#fff1f2',
    color: 'var(--error)',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  cartScroller: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  cartItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '10px',
    borderBottom: '1px solid #f3f4f6',
  },
  cartItemIcon: {
    fontSize: '20px',
  },
  cartItemName: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cartItemPrice: {
    fontSize: '11px',
    color: 'var(--muted)',
    marginTop: '1px',
  },
  qtyContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  qtyBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: '13px',
    fontWeight: 'bold',
    width: '18px',
    textAlign: 'center',
  },
  cartItemSum: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    marginLeft: 'auto',
  },
  emptyCartState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '24px',
    gap: '8px',
    color: 'var(--muted)',
  },
  customerBar: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--background)',
  },
  attachCustBtn: {
    width: '100%',
    padding: '8px',
    borderRadius: 'var(--radius)',
    backgroundColor: '#ffffff',
    border: '1px dashed var(--border)',
    color: 'var(--muted)',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  customerSelectedBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 'var(--radius)',
    padding: '6px 12px',
  },
  custBoxName: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--primary)',
  },
  custBoxPhone: {
    fontSize: '10px',
    color: 'var(--muted)',
    marginTop: '1px',
  },
  custBoxRemove: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--error)',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  summaryBox: {
    padding: '20px',
    borderTop: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    color: 'var(--muted)',
  },
  summaryLabel: {
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  discOptionBtn: {
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--muted)',
    cursor: 'pointer',
  },
  discOptionActive: {
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    borderColor: 'var(--primary)',
  },
  discResetBtn: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--error)',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  summaryDivider: {
    height: '1px',
    backgroundColor: '#f3f4f6',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '16px',
    fontWeight: '800',
    color: 'var(--dark)',
  },
  controlsPane: {
    flex: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  segmentedControl: {
    display: 'flex',
    backgroundColor: '#f3f4f6',
    borderRadius: 'var(--radius)',
    padding: '3px',
    gap: '4px',
    flexShrink: 0,
  },
  segmentBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 0',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--muted)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  segmentBtnActive: {
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    boxShadow: 'var(--shadow)',
  },
  modeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  quickCodeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    height: '100%',
  },
  quickCodeBox: {
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickCodeLabel: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: 'var(--muted)',
    textTransform: 'uppercase',
  },
  codeTextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '2px',
  },
  quickCodeVal: {
    fontSize: '22px',
    fontWeight: '800',
    color: 'var(--primary)',
    letterSpacing: '1px',
  },
  matchArea: {
    display: 'flex',
    alignItems: 'center',
  },
  matchBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '20px',
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--primary)',
  },
  addSmallBadge: {
    display: 'flex',
    alignItems: 'center',
    color: 'var(--primary)',
  },
  noMatch: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--error)',
  },
  numpadContainer: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  numpadBtn: {
    borderRadius: '12px',
    border: '1px solid var(--border)',
    backgroundColor: '#f9fafb',
    fontSize: '18px',
    fontWeight: '800',
    color: 'var(--dark)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  numpadBtnDelete: {
    backgroundColor: '#fff1f2',
    color: 'var(--error)',
    borderColor: '#fecaca',
  },
  scanWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
  },
  scanLabel: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--muted)',
    letterSpacing: '1px',
  },
  mockViewfinder: {
    width: '100%',
    maxWidth: '280px',
    height: '200px',
    backgroundColor: 'var(--dark)',
    borderRadius: 'var(--radius-lg)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid var(--primary)',
    overflow: 'hidden',
  },
  scannerBeamContainer: {
    position: 'absolute',
    width: '180px',
    height: '120px',
    border: '1px dashed rgba(255,255,255,0.3)',
  },
  laserCornerTopLeft: {
    position: 'absolute',
    top: '-2px',
    left: '-2px',
    width: '12px',
    height: '12px',
    borderTop: '3px solid var(--primary)',
    borderLeft: '3px solid var(--primary)',
  },
  laserCornerTopRight: {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    width: '12px',
    height: '12px',
    borderTop: '3px solid var(--primary)',
    borderRight: '3px solid var(--primary)',
  },
  laserCornerBottomLeft: {
    position: 'absolute',
    bottom: '-2px',
    left: '-2px',
    width: '12px',
    height: '12px',
    borderBottom: '3px solid var(--primary)',
    borderLeft: '3px solid var(--primary)',
  },
  laserCornerBottomRight: {
    position: 'absolute',
    bottom: '-2px',
    right: '-2px',
    width: '12px',
    height: '12px',
    borderBottom: '3px solid var(--primary)',
    borderRight: '3px solid var(--primary)',
  },
  viewfinderInstructions: {
    position: 'absolute',
    bottom: '12px',
    fontSize: '9px',
    color: '#ffffff',
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: '1.4',
  },
  quickSearchWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    height: '100%',
    minHeight: 0,
  },
  searchBoxInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '8px 12px',
  },
  searchBoxInputEl: {
    flex: 1,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: '13px',
    color: 'var(--dark)',
  },
  searchListScroller: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  searchItemCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  searchItemIcon: {
    fontSize: '22px',
  },
  searchItemName: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  searchItemMeta: {
    fontSize: '10px',
    color: 'var(--muted)',
  },
  searchEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 0',
    gap: '8px',
    color: 'var(--muted)',
    fontSize: '12px',
  },
  checkoutBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    marginTop: 'auto',
    flexShrink: 0,
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.15)',
  },
  checkoutBtnDisabled: {
    backgroundColor: '#f3f4f6',
    color: 'var(--muted)',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  toast: {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--dark)',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontWeight: 'bold',
    fontSize: '13px',
    zIndex: 99999,
    boxShadow: 'var(--shadow-lg)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(3px)',
  },
  modalContent: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
  },
  modalBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  modalLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--dark)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--background)',
  },
  modalSubmitBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
  },
  payMethodsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  payMethodCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--muted)',
    transition: 'all 0.2s ease',
  },
  payMethodActive: {
    borderColor: 'var(--primary)',
    backgroundColor: 'var(--light-blue)',
    color: 'var(--primary)',
  },
  paySummaryBox: {
    backgroundColor: 'var(--background)',
    borderRadius: 'var(--radius)',
    padding: '16px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  changeDueBox: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    marginTop: '6px',
  },
  payCompleteBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--success)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '8px',
    boxShadow: '0 4px 6px rgba(22, 163, 74, 0.15)',
  },
  receiptContainer: {
    padding: '32px 24px',
    backgroundColor: '#ffffff',
    color: '#111827',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  receiptHeader: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  receiptSparkle: {
    color: 'var(--yellow)',
  },
  receiptStoreName: {
    fontSize: '16px',
    fontWeight: 'bold',
    fontFamily: 'var(--font-sans)',
  },
  receiptStoreAddress: {
    color: 'var(--muted)',
  },
  receiptStorePhone: {
    color: 'var(--muted)',
  },
  receiptDivider: {
    borderTop: '1px dashed #d1d5db',
    margin: '16px 0',
  },
  receiptMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  receiptItemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  receiptItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptTotals: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  receiptTotalsRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  receiptFooter: {
    textAlign: 'center',
    marginTop: '16px',
  },
  receiptActions: {
    padding: '20px 24px',
    backgroundColor: 'var(--background)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  printBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  receiptDoneBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--dark)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
  },
};
