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
import { ProductImage } from '../../components/ProductImage';
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

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '📦' },
  { id: 'grocery', label: 'Grocery', icon: '🛒' },
  { id: 'dairy', label: 'Dairy', icon: '🥛' },
  { id: 'drinks', label: 'Drinks', icon: '🥤' },
  { id: 'snacks', label: 'Snacks', icon: '🍿' },
  { id: 'household', label: 'Household', icon: '🏠' },
];

const getAvatarColor = (name: string) => {
  const colors = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
    '#14b8a6', '#06b6d4', '#059669', '#4f46e5', '#d97706', '#2563eb', '#db2777'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function PosBillingPage() {
  const router = useRouter();
  const cart = useCart((s) => s.cart);
  const customer = useCart((s) => s.customer);
  const customCustomers = useCart((s) => s.customCustomers) || [];
  const addCartItem = useCart((s) => s.addCartItem);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const clearCart = useCart((s) => s.clearCart);
  const setCustomer = useCart((s) => s.setCustomer);
  const addCustomCustomer = useCart((s) => s.addCustomCustomer);
  
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const employeeName = useAuthStore((s) => s.employeeName);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);

  // States
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Customer modal
  const [showCustModal, setShowCustModal] = useState(false);
  const [custModalTab, setCustModalTab] = useState<'search' | 'create'>('search');
  const [custSearchQuery, setCustSearchQuery] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // Discount state
  const [discountType, setDiscountType] = useState<'none' | 'flat' | 'percent'>('none');
  const [discountVal, setDiscountVal] = useState(0);
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [tempDiscount, setTempDiscount] = useState('0');
  const [tempDiscountType, setTempDiscountType] = useState<'flat' | 'percent'>('flat');

  // Tax/VAT state
  const [taxRate, setTaxRate] = useState(8); // Default 8%
  const [isEditingTax, setIsEditingTax] = useState(false);
  const [tempTaxRate, setTempTaxRate] = useState('8');

  // Payment Tender state (inline)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [bankName, setBankName] = useState('');
  const [cardDigits, setCardDigits] = useState('');
  const [paying, setPaying] = useState(false);

  // Completed Receipt Modal state
  const [showReceipt, setShowReceipt] = useState(false);
  const [latestOrder, setLatestOrder] = useState<any>(null);

  // Focus Refs
  const discountInputRef = useRef<HTMLInputElement>(null);
  const taxInputRef = useRef<HTMLInputElement>(null);
  const cashReceivedRef = useRef<HTMLInputElement>(null);
  const cardDigitsRef = useRef<HTMLInputElement>(null);
  const bankNameRef = useRef<HTMLInputElement>(null);
  const custNameRef = useRef<HTMLInputElement>(null);

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
    return ((subtotal - discountAmount) * taxRate) / 100;
  }, [subtotal, discountAmount, taxRate]);

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
          ord.taxRate = taxRate;
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

  // Inline Discount/Tax savers
  const handleSaveDiscount = () => {
    const val = parseFloat(tempDiscount);
    if (!isNaN(val) && val >= 0) {
      if (tempDiscountType === 'percent' && val > 100) {
        triggerToast('Percentage discount cannot exceed 100% ⚠️');
        return;
      }
      setDiscountType(tempDiscountType);
      setDiscountVal(val);
      setIsEditingDiscount(false);
      triggerToast(`Discount set to ${tempDiscountType === 'percent' ? `${val}%` : `Rs. ${val}`} 🏷️`);
    } else {
      triggerToast('Invalid discount value ⚠️');
    }
  };

  const handleSaveTax = () => {
    const val = parseFloat(tempTaxRate);
    if (!isNaN(val) && val >= 0) {
      if (val > 100) {
        triggerToast('Tax rate cannot exceed 100% ⚠️');
        return;
      }
      setTaxRate(val);
      setIsEditingTax(false);
      triggerToast(`Tax rate set to ${val}% 📊`);
    } else {
      triggerToast('Invalid tax rate ⚠️');
    }
  };

  // Filtered customer list for Customer Modal
  const filteredCustomers = useMemo(() => {
    const q = custSearchQuery.trim().toLowerCase();
    if (!q) return customCustomers;
    return customCustomers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customCustomers, custSearchQuery]);

  // Submit checkout ref to bypass stale closures in useEffect
  const checkoutSubmitRef = useRef(handleConfirmCheckout);
  useEffect(() => {
    checkoutSubmitRef.current = handleConfirmCheckout;
  }, [handleConfirmCheckout]);

  // Hotkey listener state ref
  const stateRef = useRef({
    cart,
    showCustModal,
    showReceipt,
    discountVal,
    discountType,
    taxRate,
    paymentMethod,
    custModalTab,
  });

  useEffect(() => {
    stateRef.current = {
      cart,
      showCustModal,
      showReceipt,
      discountVal,
      discountType,
      taxRate,
      paymentMethod,
      custModalTab,
    };
  }, [cart, showCustModal, showReceipt, discountVal, discountType, taxRate, paymentMethod, custModalTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;

      // Close modals on Escape
      if (e.key === 'Escape') {
        setShowCustModal(false);
        setShowReceipt(false);
        setIsEditingDiscount(false);
        setIsEditingTax(false);
        return;
      }

      // If receipt is open, Enter closes it and starts new sale
      if (state.showReceipt && e.key === 'Enter') {
        e.preventDefault();
        setShowReceipt(false);
        return;
      }

      // If customer modal is open
      if (state.showCustModal) {
        if (e.key === 'Tab') {
          e.preventDefault();
          setCustModalTab(prev => prev === 'search' ? 'create' : 'search');
        }
        return;
      }

      const activeEl = document.activeElement;
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      // Global F8 / Enter inside payment inputs settles transaction
      if (e.key === 'F8' || (e.key === 'Enter' && (activeEl === cashReceivedRef.current || activeEl === cardDigitsRef.current || activeEl === bankNameRef.current))) {
        e.preventDefault();
        checkoutSubmitRef.current();
        return;
      }

      // Switch payment method keys (1, 2, 3) only when not typing inside an input
      if (!isTyping) {
        if (e.key === '1') {
          e.preventDefault();
          setPaymentMethod('cash');
          setTimeout(() => cashReceivedRef.current?.focus(), 50);
        } else if (e.key === '2') {
          e.preventDefault();
          setPaymentMethod('card');
          setTimeout(() => cardDigitsRef.current?.focus(), 50);
        } else if (e.key === '3') {
          e.preventDefault();
          setPaymentMethod('bank');
          setTimeout(() => bankNameRef.current?.focus(), 50);
        }
      }

      // Global page hotkeys
      if (e.key === 'F2') {
        e.preventDefault();
        setIsEditingDiscount(prev => {
          if (!prev) {
            setTempDiscount(state.discountVal.toString());
            setTempDiscountType(state.discountType === 'none' ? 'flat' : state.discountType);
            setTimeout(() => discountInputRef.current?.focus(), 50);
          }
          return !prev;
        });
      } else if (e.key === 'F3') {
        e.preventDefault();
        setShowCustModal(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (state.paymentMethod === 'cash') cashReceivedRef.current?.focus();
        else if (state.paymentMethod === 'card') cardDigitsRef.current?.focus();
        else if (state.paymentMethod === 'bank') bankNameRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div style={styles.workspace} className="fade-in">
      {/* Toast popup */}
      {toastMsg && (
        <div style={styles.toast}>
          <CheckCircle size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      <div style={styles.gridContainer}>
        {/* Left pane: Cart Invoice Item list (Invoice Summary) */}
        <div style={styles.invoicePane}>
          <div style={styles.paneTitleBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={styles.paneTitle}>Invoice Summary</h3>
            </div>
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
                <ProductImage icon={item.icon} size={48} style={{ border: 'none', borderRadius: '10px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={styles.cartItemName}>{item.name}</h4>
                  <span style={styles.cartItemPrice}>Rs. {item.price.toLocaleString()}</span>
                </div>
                
                {/* Quantity adjustments */}
                <div style={styles.qtyContainer}>
                  <button onClick={() => updateQuantity(item.id, -1)} style={styles.qtyBtn}>
                    <MinusCircle size={18} color="var(--muted)" />
                  </button>
                  <span style={styles.qtyText}>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} style={styles.qtyBtn}>
                    <PlusCircle size={18} color="var(--primary)" />
                  </button>
                </div>

                <span style={styles.cartItemSum}>
                  Rs. {(item.price * item.quantity).toLocaleString()}
                </span>
                
                {/* Delete button */}
                <button 
                  onClick={() => updateQuantity(item.id, -item.quantity)} 
                  style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--error)', cursor: 'pointer', marginLeft: '8px' }}
                  title="Remove item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {cart.length === 0 && (
              <div style={styles.emptyCartState}>
                <ShoppingBag size={48} color="var(--muted)" style={{ opacity: 0.5 }} />
                <h4>No items in invoice</h4>
                <p>Add products to the cart from the Home page catalog grid.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right pane: Checkout, Totals & Payment Settlement Panel */}
        <div style={styles.checkoutSettlePane}>
          <div style={styles.paneTitleBar}>
            <h3 style={styles.paneTitle}>Checkout & Payment</h3>
          </div>
          
          <div style={styles.settleFormContainer}>
            {/* 1. Customer Attachment Block */}
            <div style={{ ...styles.customerBar, width: '100%', marginBottom: '16px' }}>
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
                  <span style={styles.hotkeyBadge}>F3</span>
                </button>
              )}
            </div>

            {/* 2. Totals Summary */}
            <div style={{ ...styles.summaryBox, width: '100%', marginBottom: '20px' }}>
              <div style={styles.summaryRow}>
                <span style={styles.summaryLabel}>
                  Discount
                  <span style={styles.hotkeyBadge}>F2</span>
                </span>
                
                {isEditingDiscount ? (
                  <div style={styles.inlineEditContainer}>
                    <div style={{ display: 'flex', gap: '3px', marginRight: '6px' }}>
                      <button 
                        onClick={() => setTempDiscountType('flat')} 
                        style={{ 
                          padding: '2px 6px', 
                          fontSize: '10px', 
                          fontWeight: 'bold', 
                          border: '1px solid var(--border)', 
                          backgroundColor: tempDiscountType === 'flat' ? 'var(--primary)' : 'transparent',
                          color: tempDiscountType === 'flat' ? '#ffffff' : 'var(--muted)',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Rs
                      </button>
                      <button 
                        onClick={() => setTempDiscountType('percent')} 
                        style={{ 
                          padding: '2px 6px', 
                          fontSize: '10px', 
                          fontWeight: 'bold', 
                          border: '1px solid var(--border)', 
                          backgroundColor: tempDiscountType === 'percent' ? 'var(--primary)' : 'transparent',
                          color: tempDiscountType === 'percent' ? '#ffffff' : 'var(--muted)',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        %
                      </button>
                    </div>
                    <input
                      ref={discountInputRef}
                      type="number"
                      value={tempDiscount}
                      onChange={(e) => setTempDiscount(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDiscount(); }}
                      style={{ width: '60px', padding: '2px 4px', fontSize: '12px', border: '1px solid var(--border)', outline: 'none' }}
                    />
                    <button 
                      onClick={handleSaveDiscount} 
                      style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--success)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', padding: '0 4px' }}
                    >
                      ✓
                    </button>
                    <button 
                      onClick={() => setIsEditingDiscount(false)} 
                      style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--error)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', padding: '0 4px' }}
                    >
                      ✗
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {discountAmount > 0 ? (
                      <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                        - Rs. {discountAmount.toLocaleString()} {discountType === 'percent' ? `(${discountVal}%)` : ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>No Discount</span>
                    )}
                    <button 
                      onClick={() => {
                        setTempDiscount(discountVal.toString());
                        setTempDiscountType(discountType === 'none' ? 'flat' : discountType);
                        setIsEditingDiscount(true);
                        setTimeout(() => discountInputRef.current?.focus(), 50);
                      }} 
                      style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.summaryRow}>
                <span>Subtotal</span>
                <span>Rs. {subtotal.toLocaleString()}</span>
              </div>

              <div style={styles.summaryRow}>
                <span style={styles.summaryLabel}>
                  VAT / Tax
                  {taxRate > 0 && <span style={{ color: 'var(--primary)', marginLeft: '4px' }}>({taxRate}%)</span>}
                </span>
                
                {isEditingTax ? (
                  <div style={styles.inlineEditContainer}>
                    <input
                      ref={taxInputRef}
                      type="number"
                      value={tempTaxRate}
                      onChange={(e) => setTempTaxRate(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTax(); }}
                      style={{ width: '40px', padding: '2px 4px', fontSize: '12px', border: '1px solid var(--border)', outline: 'none' }}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 'bold', margin: '0 2px' }}>%</span>
                    <button 
                      onClick={handleSaveTax} 
                      style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--success)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', padding: '0 4px' }}
                    >
                      ✓
                    </button>
                    <button 
                      onClick={() => setIsEditingTax(false)} 
                      style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--error)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', padding: '0 4px' }}
                    >
                      ✗
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Rs. {taxAmount.toLocaleString()}</span>
                    <button 
                      onClick={() => {
                        setTempTaxRate(taxRate.toString());
                        setIsEditingTax(true);
                        setTimeout(() => taxInputRef.current?.focus(), 50);
                      }} 
                      style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.summaryDivider} />

              <div style={styles.totalRowLarge}>
                <span>Total Payable</span>
                <span>Rs. {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* 3. Payment Method Grid Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...styles.modalLabel, marginBottom: '8px', display: 'block' }}>Payment Method</label>
              <div style={styles.payMethodsGrid}>
                <button 
                  onClick={() => { setPaymentMethod('cash'); setTimeout(() => cashReceivedRef.current?.focus(), 50); }}
                  style={{ ...styles.payMethodCard, ...(paymentMethod === 'cash' ? styles.payMethodActive : {}) }}
                >
                  <DollarSign size={20} />
                  <span>[1] Cash</span>
                </button>
                <button 
                  onClick={() => { setPaymentMethod('card'); setTimeout(() => cardDigitsRef.current?.focus(), 50); }}
                  style={{ ...styles.payMethodCard, ...(paymentMethod === 'card' ? styles.payMethodActive : {}) }}
                >
                  <CreditCard size={20} />
                  <span>[2] Card</span>
                </button>
                <button 
                  onClick={() => { setPaymentMethod('bank'); setTimeout(() => bankNameRef.current?.focus(), 50); }}
                  style={{ ...styles.payMethodCard, ...(paymentMethod === 'bank' ? styles.payMethodActive : {}) }}
                >
                  <Wallet size={20} />
                  <span>[3] Bank</span>
                </button>
              </div>
            </div>

            {/* 4. Payment Tender Inputs */}
            <div style={{ flex: 1 }}>
              {paymentMethod === 'cash' && (
                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Cash Received</label>
                  <input 
                    ref={cashReceivedRef}
                    type="number" 
                    placeholder="Enter cash amount... [F4]" 
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    style={styles.modalInput}
                  />
                  
                  {/* Quick Cash Buttons */}
                  <div style={styles.quickCashContainer}>
                    <button 
                      onClick={() => setCashReceived(Math.ceil(totalAmount).toString())}
                      style={styles.quickCashChip}
                    >
                      Exact (Rs. {Math.ceil(totalAmount)})
                    </button>
                    {[100, 200, 500, 1000, 5000].map((note) => {
                      if (note < totalAmount) return null;
                      return (
                        <button 
                          key={note}
                          onClick={() => setCashReceived(note.toString())}
                          style={styles.quickCashChip}
                        >
                          Rs. {note}
                        </button>
                      );
                    })}
                  </div>

                  {parseFloat(cashReceived) > 0 && (
                    <div style={styles.changeDueBoxLarge}>
                      <span>Change Due:</span>
                      <span>Rs. {changeDue.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'card' && (
                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Last 4 Digits of Card</label>
                  <input 
                    ref={cardDigitsRef}
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
                    ref={bankNameRef}
                    type="text" 
                    placeholder="e.g. HNB / Commercial Bank" 
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 5. Checkout Submit Button */}
          <button 
            onClick={handleConfirmCheckout}
            disabled={paying || cart.length === 0}
            style={{
              ...styles.payCompleteBtn,
              ...(cart.length === 0 ? styles.payCompleteBtnDisabled : {})
            }}
          >
            {paying ? 'Completing sale...' : 'Confirm Checkout & Settle [F8]'}
          </button>
        </div>
      </div>

      {/* Customer Selector Modal (with tabs Search/Create) */}
      {showCustModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>Attach Customer Profile</h3>
              <button onClick={() => setShowCustModal(false)} style={styles.modalCloseBtn}><X size={16} /></button>
            </div>
            
            {/* Modal Tabs */}
            <div style={styles.modalTabHeader}>
              <button 
                onClick={() => setCustModalTab('search')} 
                style={{ ...styles.modalTabBtn, ...(custModalTab === 'search' ? styles.modalTabBtnActive : {}) }}
              >
                Search Contacts
              </button>
              <button 
                onClick={() => setCustModalTab('create')} 
                style={{ ...styles.modalTabBtn, ...(custModalTab === 'create' ? styles.modalTabBtnActive : {}) }}
              >
                Create Customer
              </button>
            </div>

            {custModalTab === 'search' ? (
              <div style={styles.modalBody}>
                <div style={styles.searchBoxInput}>
                  <Search size={16} color="var(--muted)" />
                  <input
                    type="text"
                    placeholder="Search name or phone..."
                    value={custSearchQuery}
                    onChange={(e) => setCustSearchQuery(e.target.value)}
                    style={styles.searchBoxInputEl}
                  />
                </div>

                <div style={styles.customerList}>
                  {/* Walking Customer Row */}
                  <div 
                    onClick={() => {
                      setCustomer(null);
                      setShowCustModal(false);
                      triggerToast('Set as Walking Customer 👤');
                    }}
                    style={styles.walkingCustomerRow}
                  >
                    <div style={{ ...styles.customerAvatar, backgroundColor: '#f3f4f6', color: 'var(--muted)', fontSize: '18px' }}>
                      🚶
                    </div>
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: 'bold' }}>Walking Customer</h4>
                      <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Default non-attached checkout</p>
                    </div>
                  </div>

                  {filteredCustomers.map((cust, idx) => {
                    const avatarColor = getAvatarColor(cust.name);
                    const initials = getInitials(cust.name);
                    return (
                      <div 
                        key={idx}
                        onClick={() => {
                          setCustomer(cust);
                          setShowCustModal(false);
                          triggerToast(`Attached customer: ${cust.name} 👤`);
                        }}
                        style={styles.customerRow}
                      >
                        <div style={{ ...styles.customerAvatar, backgroundColor: avatarColor }}>
                          {initials}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '13px', fontWeight: 'bold' }}>{cust.name}</h4>
                          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>{cust.phone}</p>
                        </div>
                      </div>
                    );
                  })}

                  {filteredCustomers.length === 0 && custSearchQuery.trim() !== '' && (
                    <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '12px', padding: '16px' }}>
                      No customers found
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div style={styles.modalBody}>
                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Customer Name *</label>
                  <input 
                    ref={custNameRef}
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
                    if (!custName) return;
                    const newCust = { name: custName, phone: custPhone || 'Walking Customer' };
                    addCustomCustomer(newCust);
                    setCustomer(newCust);
                    setShowCustModal(false);
                    setCustName('');
                    setCustPhone('');
                    triggerToast('Customer created & attached 👤');
                  }}
                  disabled={!custName}
                  style={styles.modalSubmitBtn}
                >
                  Create & Attach Profile
                </button>
              </div>
            )}
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
                  <span>VAT / Tax ({latestOrder.taxRate || 8}%)</span>
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
                Done / New Sale [Enter]
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
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflowY: 'hidden',
    boxSizing: 'border-box',
    backgroundColor: 'var(--background)',
  },
  lowProfileBackBtn: {
    padding: '6px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--dark)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
    transition: 'all 0.2s',
  },
  inlineEditContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--background)',
    padding: '4px 8px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  catalogLayout: {
    display: 'flex',
    flex: 1,
    gap: '16px',
    height: '100%',
    minHeight: 0,
  },
  sidebar: {
    width: '100px',
    backgroundColor: '#f3f4f6',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '8px',
    overflowY: 'auto',
    flexShrink: 0,
  },
  sidebarBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 6px',
    borderRadius: 'var(--radius)',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    gap: '4px',
    transition: 'all 0.2s',
  },
  sidebarBtnActive: {
    backgroundColor: '#ffffff',
    color: 'var(--primary)',
    boxShadow: 'var(--shadow)',
  },
  gridWrapper: {
    flex: 1,
    overflowY: 'auto',
    paddingRight: '4px',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '12px',
    paddingBottom: '16px',
  },
  productCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '8px',
    cursor: 'pointer',
    transition: 'transform 0.15s, border-color 0.15s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    boxSizing: 'border-box',
    position: 'relative',
  },
  productIcon: {
    fontSize: '28px',
    alignSelf: 'center',
    margin: '8px 0',
  },
  productName: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    lineHeight: '1.3',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  productPrice: {
    fontSize: '13px',
    fontWeight: '800',
    color: 'var(--primary)',
  },
  productStock: {
    fontSize: '10px',
    color: 'var(--muted)',
  },
  productStockLow: {
    color: 'var(--warning)',
    fontWeight: 'bold',
  },
  productStockOut: {
    color: 'var(--error)',
    fontWeight: 'bold',
  },
  productAddBtn: {
    width: '100%',
    padding: '6px 0',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  productAddBtnDisabled: {
    backgroundColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  modalTabHeader: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    backgroundColor: '#f9fafb',
  },
  modalTabBtn: {
    flex: 1,
    padding: '12px 0',
    border: 'none',
    borderBottom: '2px solid transparent',
    backgroundColor: 'transparent',
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--muted)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modalTabBtnActive: {
    borderBottomColor: 'var(--primary)',
    color: 'var(--primary)',
    backgroundColor: '#ffffff',
  },
  customerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '300px',
    overflowY: 'auto',
    padding: '8px 0',
  },
  customerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    backgroundColor: '#ffffff',
  },
  walkingCustomerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    backgroundColor: '#f9fafb',
    transition: 'border-color 0.2s',
  },
  customerAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '12px',
  },
  hotkeyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    color: '#374151',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '10px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginLeft: '6px',
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
    display: 'flex',
    alignItems: 'center',
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
  checkoutSettlePane: {
    flex: 4,
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  settleFormContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
  },
  totalRowLarge: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '20px',
    fontWeight: '800',
    color: 'var(--dark)',
  },
  quickCashContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '10px',
  },
  quickCashChip: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#f3f4f6',
    color: 'var(--dark)',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  changeDueBoxLarge: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'var(--success)',
    backgroundColor: '#f0fdf4',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #bbf7d0',
    marginTop: '12px',
  },
  payCompleteBtnDisabled: {
    backgroundColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  controlsPane: {
    flex: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: 0,
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
    padding: '16px',
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
