'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCart, CartItem, Customer } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import database from '../db/database';
import { Q } from '@nozbe/watermelondb';
import { 
  Search, Camera, Plus, Trash2, PlusCircle, MinusCircle, 
  Percent, DollarSign, ArrowRight, CheckCircle, CreditCard, 
  Wallet, Sparkles, Printer, UserPlus, ShoppingBag, X
} from 'lucide-react';
import { Scanner, useHardwareScanner } from '../components/Scanner';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cameraActive, setCameraActive] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Customer sheet state
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

  // Add Product catalog quick modal
  const [showAddProdModal, setShowAddProdModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Snacks');
  const [newProdIcon, setNewProdIcon] = useState('📦');
  const [newProdStock, setNewProdStock] = useState('20');
  const [newProdQuickCode, setNewProdQuickCode] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');

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
      console.error('Failed to load products from IndexedDB:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadProducts();
    }
  }, [isLoggedIn, activeBusiness]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category.toLowerCase());
    });
    return ['All', ...Array.from(set).map(c => c.charAt(0).toUpperCase() + c.slice(1))];
  }, [products]);

  // Search and Category filters
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.quickCode && p.quickCode.includes(searchQuery)) ||
        (p.barcode && p.barcode.includes(searchQuery));
      const matchCat = selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchSearch && matchCat;
    });
  }, [products, searchQuery, selectedCategory]);

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
      setCameraActive(false);
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
    // 8% VAT
    return ((subtotal - discountAmount) * 8) / 100;
  }, [subtotal, discountAmount]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount + taxAmount);
  }, [subtotal, discountAmount, taxAmount]);

  const changeDue = useMemo(() => {
    const cash = parseFloat(cashReceived) || 0;
    return Math.max(0, cash - totalAmount);
  }, [cashReceived, totalAmount]);

  // Submit Order to IndexedDB
  const handleConfirmCheckout = async () => {
    if (cart.length === 0) return;
    setPaying(true);

    try {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      let dbBiz: any;
      
      await database.write(async () => {
        // 1. Fetch business record
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

        // 2. Create Order
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

        // 3. Create Order Items & Adjust Stock
        for (const item of cart) {
          const dbProducts = await database.get('products').query(Q.where('name', item.name)).fetch();
          let matchedProduct = null;
          
          if (dbProducts.length > 0) {
            matchedProduct = dbProducts[0];
            await matchedProduct.update((p: any) => {
              p.stockCount = Math.max(0, p.stockCount - item.quantity);
            });
          }

          // Create OrderItem record
          await database.get('order_items').create((oi: any) => {
            oi.order.set(newOrder);
            if (matchedProduct) {
              oi.product.set(matchedProduct);
            }
            oi.name = item.name;
            oi.quantity = item.quantity;
            oi.price = item.price;
          });

          // Log Inventory out
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

  // Quick Catalog Add submit
  const handleAddCatalogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) return;

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

        const newProd = await database.get('products').create((p: any) => {
          p.business.set(dbBiz);
          p.name = newProdName;
          p.price = parseFloat(newProdPrice);
          p.category = newProdCategory.toLowerCase();
          p.icon = newProdIcon;
          p.stockCount = parseInt(newProdStock) || 0;
          if (newProdQuickCode) p.quickCode = newProdQuickCode;
          if (newProdBarcode) p.barcode = newProdBarcode;
          p.isFavorite = false;
        });

        if (parseInt(newProdStock) > 0) {
          await database.get('inventory_logs').create((log: any) => {
            log.product.set(newProd);
            log.type = 'in';
            log.quantity = parseInt(newProdStock);
            log.reason = 'Initial Catalog Seed';
          });
        }
      });

      triggerToast(`Added ${newProdName} to Catalog! 📦`);
      setShowAddProdModal(false);
      setNewProdName('');
      setNewProdPrice('');
      setNewProdQuickCode('');
      setNewProdBarcode('');
      setNewProdStock('20');
      loadProducts();
    } catch (err) {
      console.error('Failed to write new catalog product:', err);
    }
  };

  return (
    <div style={styles.workspace} className="fade-in">
      {/* Toast popup */}
      {toastMsg && (
        <div style={styles.toast}>
          <CheckCircle size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Camera scan module */}
      {cameraActive && (
        <Scanner
          onScan={handleScanCode}
          onClose={() => setCameraActive(false)}
        />
      )}

      {/* Split pane POS workspace */}
      <div style={styles.gridContainer}>
        
        {/* Left Side: Product Catalog Grid */}
        <div style={styles.catalogPane}>
          {/* Header query panel */}
          <div style={styles.searchRow}>
            <div style={styles.searchBox}>
              <Search size={18} color="var(--muted)" />
              <input
                type="text"
                placeholder="Search products by name, code (e.g. 2001), or scan barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            
            <button 
              onClick={() => setCameraActive(true)}
              style={styles.cameraBtn}
              title="Open camera viewfinder scanner"
            >
              <Camera size={18} />
              <span>Camera Scan</span>
            </button>

            <button 
              onClick={() => setShowAddProdModal(true)}
              style={styles.addCatalogBtn}
              title="Add new product to the catalog database"
            >
              <Plus size={18} />
              <span>Add Product</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div style={styles.categoryScroller}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  ...styles.categoryTab,
                  ...(selectedCategory === cat ? styles.categoryTabActive : {}),
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Catalog grid */}
          <div style={styles.productsGrid}>
            {filteredProducts.map((p) => {
              const isOut = p.stockCount <= 0;
              const isLow = p.lowStockAlert && p.stockCount <= p.lowStockAlert;
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
                  style={{
                    ...styles.prodCard,
                    ...(isOut ? styles.prodCardOut : {}),
                  }}
                >
                  <div style={styles.cardHeader}>
                    {/* Icon */}
                    {p.icon.startsWith('http') ? (
                      <img src={p.icon} alt={p.name} style={styles.prodImg} />
                    ) : (
                      <span style={styles.prodEmoji}>{p.icon}</span>
                    )}

                    {/* Stock Alert Badge */}
                    <span style={{
                      ...styles.stockBadge,
                      backgroundColor: isOut ? '#FEE2E2' : isLow ? '#FFEDD5' : '#DCFCE7',
                      color: isOut ? '#DC2626' : isLow ? '#D97706' : '#15803D',
                    }}>
                      {isOut ? 'Out of Stock' : `${p.stockCount} left`}
                    </span>
                  </div>

                  <h3 style={styles.prodName}>{p.name}</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <span style={styles.prodPrice}>Rs. {p.price.toLocaleString()}</span>
                    {p.quickCode && <span style={styles.quickCodeBadge}>#{p.quickCode}</span>}
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div style={styles.emptyGridState}>
                <ShoppingBag size={48} color="var(--muted)" />
                <h3>No products found</h3>
                <p>Try searching another item or add a new product to the catalog.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Invoice Billing Panel */}
        <div style={styles.invoicePane}>
          {/* Metadata */}
          <div style={styles.invoiceHeader}>
            <div>
              <h3 style={styles.invoiceTitle}>Active Invoice</h3>
              <p style={styles.invoiceDate}>{new Date().toLocaleDateString()} · Terminal POS</p>
            </div>
            <button 
              onClick={() => {
                if (confirm('Clear entire invoice cart?')) {
                  clearCart();
                  triggerToast('Cart cleared');
                }
              }}
              disabled={cart.length === 0}
              style={styles.clearCartBtn}
              title="Clear invoice items"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Cart items scroll panel */}
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
                <ShoppingBag size={36} color="var(--muted)" style={{ opacity: 0.7 }} />
                <p>No items added yet</p>
                <span>Click product cards or scan barcodes directly to add items.</span>
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
                <span>Attach Customer to Invoice</span>
              </button>
            )}
          </div>

          {/* Discounts/Tax summary billing panel */}
          <div style={styles.summaryBox}>
            {/* Discount selector input */}
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

            {/* Checkout proceed button */}
            <button
              onClick={() => setShowPayModal(true)}
              disabled={cart.length === 0}
              style={{
                ...styles.checkoutBtn,
                ...(cart.length === 0 ? styles.checkoutBtnDisabled : {}),
              }}
            >
              <span>Confirm Invoice Checkout</span>
              <ArrowRight size={18} />
            </button>
          </div>
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
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--muted)' }}>INVOICE TOTAL DUE</span>
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
                disabled={paying || (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < totalAmount)) || (paymentMethod === 'card' && cardDigits.length !== 4) || (paymentMethod === 'bank' && !bankName)}
                style={styles.payCompleteBtn}
              >
                {paying ? 'Completing Sale Transaction...' : 'Settle Invoice & Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Invoice Receipt Printable Modal */}
      {showReceipt && latestOrder && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '420px', padding: '0px' }}>
            <div style={styles.receiptContainer} id="printable-receipt">
              <div style={styles.receiptHeader}>
                <span style={styles.receiptSparkle}><Sparkles size={16} /></span>
                <h3 style={styles.receiptStoreName}>{activeBusiness?.name || 'Shopbook POS Partner'}</h3>
                <p style={styles.receiptStoreAddress}>{activeBusiness?.address || 'Sri Lanka'}</p>
                <p style={styles.receiptStorePhone}>{activeBusiness?.phone || '+94 ** *** ****'}</p>
              </div>

              <div style={styles.receiptDivider} />

              <div style={styles.receiptMeta}>
                <div><strong>Invoice:</strong> {latestOrder.invoiceNumber}</div>
                <div><strong>Date:</strong> {latestOrder.date}</div>
                <div><strong>Cashier:</strong> {employeeName}</div>
                {latestOrder.customer && (
                  <div style={{ marginTop: '4px' }}>
                    <strong>Customer:</strong> {latestOrder.customer.name} ({latestOrder.customer.phone})
                  </div>
                )}
              </div>

              <div style={styles.receiptDivider} />

              {/* Items List */}
              <div style={styles.receiptItemsList}>
                <div style={{ ...styles.receiptItemRow, fontWeight: 'bold' }}>
                  <span style={{ flex: 2 }}>Item</span>
                  <span style={{ flex: 1, textAlign: 'center' }}>Qty</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Price</span>
                </div>
                {latestOrder.items.map((item: any, idx: number) => (
                  <div key={idx} style={styles.receiptItemRow}>
                    <span style={{ flex: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>{item.quantity}</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>Rs. {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={styles.receiptDivider} />

              {/* Totals */}
              <div style={styles.receiptTotals}>
                <div style={styles.receiptTotalsRow}>
                  <span>Subtotal</span>
                  <span>Rs. {latestOrder.subtotal.toLocaleString()}</span>
                </div>
                {latestOrder.discountAmount > 0 && (
                  <div style={styles.receiptTotalsRow}>
                    <span>Discount</span>
                    <span>- Rs. {latestOrder.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div style={styles.receiptTotalsRow}>
                  <span>VAT Tax (8%)</span>
                  <span>Rs. {latestOrder.taxAmount.toLocaleString()}</span>
                </div>
                <div style={{ ...styles.receiptTotalsRow, fontWeight: 'bold', fontSize: '15px', marginTop: '6px' }}>
                  <span>Total Amount</span>
                  <span>Rs. {latestOrder.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div style={styles.receiptDivider} />

              <div style={styles.receiptFooter}>
                <p>Method: {latestOrder.paymentMethod.toUpperCase()}</p>
                <p style={{ marginTop: '8px', fontWeight: 'bold', letterSpacing: '0.5px' }}>THANK YOU FOR YOUR VISIT! 🇱🇰</p>
                <p style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '4px' }}>Powered by Shopbook Mini POS Pro</p>
              </div>
            </div>

            {/* Receipt actions footer */}
            <div style={styles.receiptActions}>
              <button 
                onClick={() => {
                  window.print();
                }}
                style={styles.printBtn}
              >
                <Printer size={16} />
                <span>Print receipt (PDF)</span>
              </button>
              <button 
                onClick={() => setShowReceipt(false)}
                style={styles.receiptDoneBtn}
              >
                Start New Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product catalog quick modal */}
      {showAddProdModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '460px' }}>
            <div style={styles.modalHeader}>
              <h3>Add Product to Catalog</h3>
              <button onClick={() => setShowAddProdModal(false)} style={styles.modalCloseBtn}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddCatalogSubmit} style={styles.modalBody}>
              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Product Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Garlic Fried Rice" 
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  required
                  style={styles.modalInput}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Retail Price (Rs.)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 750" 
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    required
                    style={styles.modalInput}
                  />
                </div>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Category</label>
                  <select 
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    style={styles.select}
                  >
                    <option value="Pizza">Pizza</option>
                    <option value="Burgers">Burgers</option>
                    <option value="Salads">Salads</option>
                    <option value="Pasta">Pasta</option>
                    <option value="Rice">Rice</option>
                    <option value="Main">Main</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Dessert">Dessert</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Icon (Emoji)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 🍛" 
                    value={newProdIcon}
                    onChange={(e) => setNewProdIcon(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Initial Stock</label>
                  <input 
                    type="number" 
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Quick Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 2030" 
                    value={newProdQuickCode}
                    onChange={(e) => setNewProdQuickCode(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Barcode</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 880104" 
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
              </div>

              <button type="submit" style={styles.modalSubmitBtn}>
                Save to POS Catalog
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  workspace: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  toast: {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--success)',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontWeight: 'bold',
    fontSize: '13px',
    zIndex: 99999,
    boxShadow: '0 10px 20px rgba(22, 163, 74, 0.25)',
  },
  gridContainer: {
    display: 'flex',
    flex: 1,
    height: '100%',
    overflow: 'hidden',
  },
  catalogPane: {
    flex: 7,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    borderRight: '1px solid var(--border)',
    overflow: 'hidden',
  },
  searchRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    boxShadow: 'var(--shadow)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    color: 'var(--dark)',
  },
  cameraBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    backgroundColor: 'var(--light-blue)',
    border: '1px solid var(--accent-blue)',
    borderRadius: 'var(--radius)',
    color: 'var(--primary)',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
  },
  addCatalogBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    backgroundColor: '#effaf3',
    border: '1px solid #cceadb',
    borderRadius: 'var(--radius)',
    color: 'var(--success)',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
  },
  categoryScroller: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    marginBottom: '20px',
    paddingBottom: '6px',
    flexShrink: 0,
  },
  categoryTab: {
    padding: '8px 18px',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  categoryTabActive: {
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    borderColor: 'var(--primary)',
    boxShadow: '0 4px 6px rgba(37, 99, 235, 0.15)',
  },
  productsGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
    overflowY: 'auto',
    paddingBottom: '24px',
  },
  prodCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    position: 'relative',
    boxShadow: 'var(--shadow)',
  },
  prodCardOut: {
    opacity: 0.6,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  prodImg: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    objectFit: 'cover',
  },
  prodEmoji: {
    fontSize: '32px',
  },
  stockBadge: {
    fontSize: '9px',
    fontWeight: '800',
    padding: '2px 8px',
    borderRadius: '20px',
    letterSpacing: '0.3px',
  },
  prodName: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    marginBottom: '8px',
    lineHeight: '1.4',
  },
  prodPrice: {
    fontSize: '14px',
    fontWeight: '800',
    color: 'var(--primary)',
  },
  quickCodeBadge: {
    fontSize: '10px',
    color: 'var(--muted)',
    fontWeight: '600',
  },
  emptyGridState: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    textAlign: 'center',
    gap: '8px',
  },
  invoicePane: {
    flex: 3,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  invoiceHeader: {
    padding: '24px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  invoiceTitle: {
    fontSize: '16px',
    fontWeight: '800',
    color: 'var(--dark)',
  },
  invoiceDate: {
    fontSize: '11px',
    color: 'var(--muted)',
    marginTop: '2px',
  },
  clearCartBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '18px',
    backgroundColor: '#fff1f2',
    border: 'none',
    color: 'var(--error)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartScroller: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cartItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '12px',
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
  },
  customerBar: {
    padding: '16px 24px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--background)',
  },
  attachCustBtn: {
    width: '100%',
    padding: '10px',
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
    padding: '8px 12px',
  },
  custBoxName: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--primary)',
  },
  custBoxPhone: {
    fontSize: '10px',
    color: 'var(--muted)',
    marginTop: '2px',
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
    padding: '24px',
    borderTop: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
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
    fontSize: '17px',
    fontWeight: '800',
    color: 'var(--dark)',
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
    marginTop: '6px',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.15)',
  },
  checkoutBtnDisabled: {
    backgroundColor: '#f3f4f6',
    color: 'var(--muted)',
    cursor: 'not-allowed',
    boxShadow: 'none',
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
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--background)',
  },
};
