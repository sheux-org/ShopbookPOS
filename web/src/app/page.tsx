'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, CartItem, Customer } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import { useSettingsStore } from '../stores/settingsStore';
import database from '../db/database';
import { Q } from '@nozbe/watermelondb';
import { 
  Search, Plus, CheckCircle, X, ShoppingBag, ShoppingCart, 
  Trash2, UserPlus, DollarSign, CreditCard, Wallet, Printer, 
  MinusCircle, PlusCircle, AlertTriangle, Banknote
} from 'lucide-react';
import { useHardwareScanner } from '../components/Scanner';
import { ProductImage } from '../components/ProductImage';
import './page.css';

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

const SRI_LANKAN_BANKS = [
  "Bank of Ceylon (BOC)",
  "People's Bank",
  "Commercial Bank",
  "Hatton National Bank (HNB)",
  "Sampath Bank",
  "Seylan Bank",
  "Nations Trust Bank (NTB)",
  "DFCC Bank",
  "National Savings Bank (NSB)",
  "Pan Asia Bank",
  "Union Bank",
  "Amana Bank",
  "Cargills Bank",
  "Sanasa Development Bank (SDB)",
  "Regional Development Bank (RDB)"
];

const CARD_BRANDS_AND_BANKS = [
  "Visa",
  "Mastercard",
  "Amex",
  ...SRI_LANKAN_BANKS
];

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
  const posMode = useSettingsStore((s) => s.posMode);

  // States
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'catalog'>('grid');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Normal Mode scanner & table active index
  const [scanQuery, setScanQuery] = useState('');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);

  // Add Product catalog quick modal (Tablet view only)
  const [showAddProdModal, setShowAddProdModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Snacks');
  const [newProdIcon, setNewProdIcon] = useState('📦');
  const [newProdStock, setNewProdStock] = useState('20');
  const [newProdQuickCode, setNewProdQuickCode] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');

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
  const [taxRate, setTaxRate] = useState(0); // Default 0%
  const [isEditingTax, setIsEditingTax] = useState(false);
  const [tempTaxRate, setTempTaxRate] = useState('0');

  // Payment Tender state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [bankName, setBankName] = useState('');
  const [cardDigits, setCardDigits] = useState('');
  const [paying, setPaying] = useState(false);
  const [isCustomBank, setIsCustomBank] = useState(false);

  // Completed Receipt Modal state
  const [showReceipt, setShowReceipt] = useState(false);
  const [latestOrder, setLatestOrder] = useState<any>(null);

  // Focus Refs
  const scanInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const taxInputRef = useRef<HTMLInputElement>(null);
  const cashReceivedRef = useRef<HTMLInputElement>(null);
  const cardDigitsRef = useRef<HTMLInputElement>(null);
  const bankNameRef = useRef<HTMLInputElement>(null);
  const custSearchInputRef = useRef<HTMLInputElement>(null);
  const custNameInputRef = useRef<HTMLInputElement>(null);
  const cardBrandSelectRef = useRef<HTMLSelectElement>(null);
  const bankNameSelectRef = useRef<HTMLSelectElement>(null);
  const settleBtnRef = useRef<HTMLButtonElement>(null);

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

  // Keep selectedRowIndex bounded by cart length
  useEffect(() => {
    if (cart.length === 0) {
      setSelectedRowIndex(0);
    } else if (selectedRowIndex >= cart.length) {
      setSelectedRowIndex(cart.length - 1);
    }
  }, [cart.length, selectedRowIndex]);

  // Listen to open register product modal events (dispatched from layout header)
  useEffect(() => {
    const handleOpenRegisterModal = () => {
      setShowAddProdModal(true);
    };
    window.addEventListener('open-register-product-modal', handleOpenRegisterModal);
    return () => window.removeEventListener('open-register-product-modal', handleOpenRegisterModal);
  }, []);

  // Autofocus scan input in normal mode
  useEffect(() => {
    if (posMode === 'normal') {
      scanInputRef.current?.focus();
    }
  }, [posMode]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

  // Scan or search manual submit
  const handleScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let query = scanQuery.trim();
    if (!query) return;

    let scanQty = 1;
    if (query.includes('*')) {
      const parts = query.split('*');
      const parsedQty = parseInt(parts[0]);
      if (!isNaN(parsedQty) && parsedQty > 0) {
        scanQty = parsedQty;
        query = parts.slice(1).join('*').trim();
      }
    }

    const matched = products.find(p => p.barcode === query || p.quickCode === query || p.name.toLowerCase() === query.toLowerCase());
    if (matched) {
      if (matched.stockCount <= 0) {
        triggerToast(`Out of stock: ${matched.name} ⚠️`);
        return;
      }
      for (let i = 0; i < scanQty; i++) {
        addCartItem(matched.name, matched.price, matched.icon, matched.barcode || matched.id, matched.stockCount);
      }
      triggerToast(`Added ${scanQty}x ${matched.name} 🛒`);
      setScanQuery('');
      setSelectedRowIndex(cart.length);
    } else {
      triggerToast(`Item code "${query}" not found ⚠️`);
    }
  };

  // Hardware Scanner Hook capture
  const handleHardwareScan = (barcode: string) => {
    const matched = products.find(p => p.barcode === barcode || p.quickCode === barcode);
    if (matched) {
      if (matched.stockCount <= 0) {
        triggerToast(`Out of stock: ${matched.name} ⚠️`);
        return;
      }
      addCartItem(matched.name, matched.price, matched.icon, matched.barcode || matched.id, matched.stockCount);
      triggerToast(`Added ${matched.name} 🛒`);
      setSelectedRowIndex(cart.length);
    } else {
      triggerToast(`Barcode "${barcode}" not in catalog ⚠️`);
    }
  };

  useHardwareScanner(handleHardwareScan);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category.toLowerCase());
    });
    return ['All', ...Array.from(set).map(c => c.charAt(0).toUpperCase() + c.slice(1))];
  }, [products]);

  // Search and Category filters for Tablet catalog grid
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

  const handlePaymentMethodChange = (method: 'cash' | 'card' | 'bank') => {
    setPaymentMethod(method);
    setBankName('');
    setIsCustomBank(false);
    setCardDigits('');
    setTimeout(() => {
      if (method === 'cash') cashReceivedRef.current?.focus();
      else if (method === 'card') cardBrandSelectRef.current?.focus();
      else if (method === 'bank') bankNameSelectRef.current?.focus();
    }, 50);
  };

  const isPaymentValid = useMemo(() => {
    if (cart.length === 0) return false;
    if (paymentMethod === 'cash') {
      const cash = parseFloat(cashReceived);
      return !isNaN(cash) && cash >= totalAmount;
    }
    if (paymentMethod === 'card') {
      return bankName !== '' && cardDigits.length === 4 && /^\d+$/.test(cardDigits);
    }
    if (paymentMethod === 'bank') {
      return bankName.trim() !== '';
    }
    return false;
  }, [cart, paymentMethod, cashReceived, bankName, cardDigits, totalAmount]);

  const validatePayment = () => {
    if (cart.length === 0) {
      triggerToast("Cart is empty! 🛒");
      return false;
    }
    if (paymentMethod === 'cash') {
      const cash = parseFloat(cashReceived);
      if (isNaN(cash) || cash < totalAmount) {
        alert(`Insufficient Tender: Cash received (Rs. ${isNaN(cash) ? 0 : cash}) must be at least the total amount (Rs. ${totalAmount.toLocaleString()})`);
        return false;
      }
    } else if (paymentMethod === 'card') {
      if (!bankName) {
        alert("Card Brand/Bank Required: Please select a card brand or bank.");
        return false;
      }
      if (!cardDigits || cardDigits.length !== 4 || !/^\d+$/.test(cardDigits)) {
        alert("Card Number Required: Please enter the last 4 digits of the card.");
        return false;
      }
    } else if (paymentMethod === 'bank') {
      if (!bankName.trim()) {
        alert("Beneficiary Bank Name Required: Please select or type the bank name.");
        return false;
      }
    }
    return true;
  };

  // Settle Checkout & save to WatermelonDB
  const handleConfirmCheckout = async () => {
    if (!validatePayment()) return;
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
          if (paymentMethod === 'card') {
            ord.bankName = bankName;
            ord.cardLastFour = cardDigits.slice(-4);
          }
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
          bankName: paymentMethod === 'card' || paymentMethod === 'bank' ? bankName : undefined,
          cardLastFour: paymentMethod === 'card' ? cardDigits.slice(-4) : undefined,
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
    } catch (err) {
      console.error('Failed to complete sale checkout:', err);
    } finally {
      setPaying(false);
    }
  };

  const resetAllState = () => {
    clearCart();
    setCustomer(null);
    setDiscountType('none');
    setDiscountVal(0);
    setPaymentMethod('cash');
    setCashReceived('');
    setBankName('');
    setCardDigits('');
    setIsCustomBank(false);
    setSelectedRowIndex(0);
    setScanQuery('');
    loadProducts();
    if (posMode === 'normal') {
      setTimeout(() => scanInputRef.current?.focus(), 50);
    }
  };

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
      if (posMode === 'normal') setTimeout(() => scanInputRef.current?.focus(), 50);
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
      if (posMode === 'normal') setTimeout(() => scanInputRef.current?.focus(), 50);
    } else {
      triggerToast('Invalid tax rate ⚠️');
    }
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) return;
    const newCust = { name: custName, phone: custPhone };
    addCustomCustomer(newCust);
    setCustomer(newCust);
    setShowCustModal(false);
    setCustName('');
    setCustPhone('');
    triggerToast(`Customer ${custName} attached! 👤`);
    if (posMode === 'normal') setTimeout(() => scanInputRef.current?.focus(), 50);
  };

  // Add product from Quick Register form
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

  // Filtered customer list for Customer Modal
  const filteredCustomers = useMemo(() => {
    const q = custSearchQuery.trim().toLowerCase();
    if (!q) return customCustomers;
    return customCustomers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customCustomers, custSearchQuery]);

  // Submit checkout refs to bypass stale state closures inside useEffect hook
  const checkoutConfirmRef = useRef(handleConfirmCheckout);
  const resetAllStateRef = useRef(resetAllState);
  const handleSaveTaxRef = useRef(handleSaveTax);
  const handleSaveDiscountRef = useRef(handleSaveDiscount);
  useEffect(() => {
    checkoutConfirmRef.current = handleConfirmCheckout;
    resetAllStateRef.current = resetAllState;
    handleSaveTaxRef.current = handleSaveTax;
    handleSaveDiscountRef.current = handleSaveDiscount;
  });

  const stateRef = useRef({
    cart,
    selectedRowIndex,
    showCustModal,
    showReceipt,
    discountVal,
    discountType,
    taxRate,
    paymentMethod,
    custModalTab,
    posMode,
    isEditingDiscount,
    isEditingTax,
    isCustomBank,
    bankName,
  });

  useEffect(() => {
    stateRef.current = {
      cart,
      selectedRowIndex,
      showCustModal,
      showReceipt,
      discountVal,
      discountType,
      taxRate,
      paymentMethod,
      custModalTab,
      posMode,
      isEditingDiscount,
      isEditingTax,
      isCustomBank,
      bankName,
    };
  }, [
    cart,
    selectedRowIndex,
    showCustModal,
    showReceipt,
    discountVal,
    discountType,
    taxRate,
    paymentMethod,
    custModalTab,
    posMode,
    isEditingDiscount,
    isEditingTax,
    isCustomBank,
    bankName,
  ]);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      const state = stateRef.current;

      // Close modals on Escape
      if (e.key === 'Escape') {
        setShowCustModal(false);
        setShowReceipt(false);
        setIsEditingDiscount(false);
        setIsEditingTax(false);
        if (state.posMode === 'normal') {
          setTimeout(() => scanInputRef.current?.focus(), 50);
        }
        return;
      }

      // Enter key inside receipt modal resets state and closes it
      if (state.showReceipt && e.key === 'Enter') {
        e.preventDefault();
        setShowReceipt(false);
        resetAllStateRef.current();
        return;
      }

      // Block other triggers if customer modal is open
      if (state.showCustModal) {
        if (e.key === 'Tab') {
          e.preventDefault();
          setCustModalTab(prev => {
            const next = prev === 'search' ? 'create' : 'search';
            setTimeout(() => {
              if (next === 'search') custSearchInputRef.current?.focus();
              else custNameInputRef.current?.focus();
            }, 50);
            return next;
          });
        }
        return;
      }

      const activeEl = document.activeElement;
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      // Normal mode shortcuts
      if (state.posMode === 'normal') {
        // F2/slash: focus barcode search input
        if (e.key === 'F2' || (e.key === '/' && !isTyping)) {
          e.preventDefault();
          scanInputRef.current?.focus();
          return;
        }

        // F3: Customer modal toggle
        if (e.key === 'F3') {
          e.preventDefault();
          setShowCustModal(true);
          setTimeout(() => custSearchInputRef.current?.focus(), 50);
          return;
        }

        // F4: toggle payment method (Cash -> Card -> Bank -> Cash)
        if (e.key === 'F4') {
          e.preventDefault();
          const next = state.paymentMethod === 'cash' ? 'card' : state.paymentMethod === 'card' ? 'bank' : 'cash';
          handlePaymentMethodChange(next);
          // Focus select dropdowns instead of inputs on payment toggles if they are unselected
          setTimeout(() => {
            if (next === 'cash') {
              cashReceivedRef.current?.focus();
            } else if (next === 'card') {
              if (state.isCustomBank) {
                bankNameRef.current?.focus();
              } else if (!state.bankName) {
                cardBrandSelectRef.current?.focus();
              } else {
                cardDigitsRef.current?.focus();
              }
            } else if (next === 'bank') {
              if (state.isCustomBank) {
                bankNameRef.current?.focus();
              } else {
                bankNameSelectRef.current?.focus();
              }
            }
          }, 60);
          return;
        }

        // F6: Discount editing & toggle between flat and percent
        if (e.key === 'F6') {
          e.preventDefault();
          if (!state.isEditingDiscount) {
            setTempDiscount(state.discountVal.toString());
            setTempDiscountType(state.discountType === 'none' ? 'flat' : state.discountType);
            setIsEditingDiscount(true);
            setTimeout(() => discountInputRef.current?.focus(), 50);
          } else {
            setTempDiscountType(prev => prev === 'flat' ? 'percent' : 'flat');
          }
          return;
        }

        // F7: Tax rate editing & saving
        if (e.key === 'F7') {
          e.preventDefault();
          if (!state.isEditingTax) {
            setTempTaxRate(state.taxRate.toString());
            setIsEditingTax(true);
            setTimeout(() => taxInputRef.current?.focus(), 50);
          } else {
            handleSaveTaxRef.current();
          }
          return;
        }

        // F8: Focus Tender details input directly
        if (e.key === 'F8') {
          e.preventDefault();
          if (state.paymentMethod === 'cash') {
            cashReceivedRef.current?.focus();
          } else if (state.paymentMethod === 'card') {
            if (state.isCustomBank) {
              bankNameRef.current?.focus();
            } else if (!state.bankName) {
              cardBrandSelectRef.current?.focus();
            } else {
              cardDigitsRef.current?.focus();
            }
          } else if (state.paymentMethod === 'bank') {
            if (state.isCustomBank) {
              bankNameRef.current?.focus();
            } else {
              bankNameSelectRef.current?.focus();
            }
          }
          return;
        }

        // F10: Settle payment and print receipt
        if (e.key === 'F10') {
          e.preventDefault();
          checkoutConfirmRef.current();
          return;
        }

        // Enter inside tender input behavior
        if (e.key === 'Enter') {
          if (activeEl === cashReceivedRef.current || activeEl === cardDigitsRef.current) {
            e.preventDefault();
            checkoutConfirmRef.current();
            return;
          }
          if (activeEl === bankNameRef.current) {
            e.preventDefault();
            if (state.paymentMethod === 'card') {
              cardDigitsRef.current?.focus();
            } else {
              checkoutConfirmRef.current();
            }
            return;
          }
        }

        // F12 or Ctrl+Backspace / Cmd+Backspace / Ctrl+Delete / Cmd+Delete: Void active transaction
        if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && (e.key === 'Backspace' || e.key === 'Delete'))) {
          e.preventDefault();
          if (state.cart.length > 0 && confirm('Clear active invoice transaction?')) {
            resetAllStateRef.current();
            triggerToast('Transaction cleared');
          }
          return;
        }

        // Keys when NOT typing in inputs (navigation & cart adjustments)
        const isFocusOnScanner = activeEl === scanInputRef.current;
        if ((!isTyping || isFocusOnScanner) && state.cart.length > 0) {
          const item = state.cart[state.selectedRowIndex];

          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedRowIndex(prev => Math.max(0, prev - 1));
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedRowIndex(prev => Math.min(state.cart.length - 1, prev + 1));
          } else if ((e.key === '+' || e.key === '=') && (!isTyping || isFocusOnScanner)) {
            e.preventDefault();
            if (item) {
              updateQuantity(item.id, 1);
              triggerToast(`Increased ${item.name} quantity 🛒`);
            }
          } else if (e.key === '-' && (!isTyping || isFocusOnScanner)) {
            e.preventDefault();
            if (item) {
              updateQuantity(item.id, -1);
              triggerToast(`Decreased ${item.name} quantity 🛒`);
            }
          } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
            e.preventDefault();
            if (item) {
              updateQuantity(item.id, -item.quantity);
              triggerToast(`Removed ${item.name} from cart`);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  return (
    <div className="unified-pos-workspace fade-in" style={styles.workspace}>
      {/* Toast message popup */}
      {toastMsg && (
        <div style={styles.toast}>
          <CheckCircle size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Unified flex-row layout */}
      <div style={styles.posGridContainer}>
        
        {/* Left Panel: Catalog OR Dense Scanned Cart Table */}
        <div style={styles.leftPane}>
          {posMode === 'tablet' ? (
            /* Tablet POS Mode catalog layout */
            <div style={styles.catalogPane}>
              {/* Header query search panel */}
              <div style={styles.searchRow}>
                <div style={styles.searchBox}>
                  <Search size={18} color="var(--muted)" />
                  <input
                    type="text"
                    placeholder="Search products by code, barcode, name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={styles.searchInput}
                  />
                </div>

                {/* Grid vs Sidebar switcher */}
                <div style={styles.viewToggleGroup}>
                  <button 
                    onClick={() => setViewMode('grid')}
                    style={{
                      ...styles.viewToggleBtn,
                      ...(viewMode === 'grid' ? styles.viewToggleBtnActive : {})
                    }}
                  >
                    Grid View
                  </button>
                  <button 
                    onClick={() => setViewMode('catalog')}
                    style={{
                      ...styles.viewToggleBtn,
                      ...(viewMode === 'catalog' ? styles.viewToggleBtnActive : {})
                    }}
                  >
                    POS Catalog
                  </button>
                </div>
              </div>

              {viewMode === 'grid' ? (
                <>
                  {/* Category selector tabs */}
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

                  {/* Products Grid list */}
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
                          className="product-grid-card"
                        >
                          <div style={styles.imageContainer}>
                            <ProductImage 
                              icon={p.icon} 
                              size={120} 
                              style={{ width: '100%', height: '100%', borderRadius: 0, border: 'none' }} 
                            />
                            <span style={{
                              ...styles.stockBadge,
                              backgroundColor: isOut ? '#FEE2E2' : isLow ? '#FFEDD5' : '#DCFCE7',
                              color: isOut ? '#DC2626' : isLow ? '#D97706' : '#15803D',
                            }}>
                              {isOut ? 'Out of Stock' : `${p.stockCount} left`}
                            </span>
                          </div>

                          <div style={styles.prodCardDetails}>
                            <span style={styles.cardCategory}>{p.category || 'General'}</span>
                            <h3 style={styles.prodName}>{p.name}</h3>
                            <div style={styles.priceAddRow}>
                              <span style={styles.prodPrice}>Rs. {p.price.toLocaleString()}</span>
                              <div 
                                style={{
                                  ...styles.plusIconBadge,
                                  backgroundColor: isOut ? '#E5E7EB' : 'var(--primary)',
                                }}
                                className="plus-icon-badge"
                              >
                                <Plus size={10} color="#FFFFFF" />
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#FFFFFF' }}>Add</span>
                              </div>
                            </div>
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
                </>
              ) : (
                /* POS Sidebar + Catalog list layout */
                <div style={styles.catalogLayout}>
                  <div style={styles.sidebar}>
                    {categories.map((cat) => {
                      const isActive = selectedCategory === cat;
                      const catEmoji = cat === 'All' ? '📦' :
                                       cat === 'Grocery' ? '🛒' :
                                       cat === 'Dairy' ? '🥛' :
                                       cat === 'Drinks' ? '🥤' :
                                       cat === 'Snacks' ? '🍿' :
                                       cat === 'Household' ? '🏠' : '📦';
                      return (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          style={{
                            ...styles.sidebarBtn,
                            ...(isActive ? styles.sidebarBtnActive : {})
                          }}
                        >
                          <span style={{ fontSize: '16px' }}>{catEmoji}</span>
                          <span>{cat}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={styles.gridWrapper}>
                    <div style={styles.productGrid}>
                      {filteredProducts.map((p) => {
                        const isOut = p.stockCount <= 0;
                        const isLow = p.stockCount > 0 && p.stockCount <= 5;
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
                              ...styles.productCard,
                              opacity: isOut ? 0.6 : 1,
                            }}
                            className="pos-catalog-card"
                          >
                            <ProductImage icon={p.icon} size={80} style={{ alignSelf: 'center', margin: '0', border: 'none', borderRadius: '8px' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <h4 style={styles.productName} title={p.name}>{p.name}</h4>
                              <span style={styles.productPrice}>Rs. {p.price}</span>
                              {isOut ? (
                                <span style={{ ...styles.productStock, ...styles.productStockOut }}>Out of Stock</span>
                              ) : isLow ? (
                                <span style={{ ...styles.productStock, ...styles.productStockLow }}>Low Stock ({p.stockCount})</span>
                              ) : (
                                <span style={styles.productStock}>Stock: {p.stockCount}</span>
                              )}
                            </div>
                            <button
                              disabled={isOut}
                              className="product-add-btn"
                              style={{
                                ...styles.productAddBtn,
                                ...(isOut ? styles.productAddBtnDisabled : {})
                              }}
                            >
                              + Add
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {filteredProducts.length === 0 && (
                      <div style={styles.emptyGridState}>
                        <ShoppingBag size={48} color="var(--muted)" />
                        <h3>No products found</h3>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Normal Mode: Keyboard Dense Table view */
            <div style={styles.normalTablePanel}>
              {/* Scanner manual entry input field */}
              <form onSubmit={handleScanSubmit} style={styles.scannerBar}>
                <div style={styles.scannerInputBox}>
                  <Search size={18} color="var(--muted)" />
                  <input
                    ref={scanInputRef}
                    type="text"
                    placeholder="Scan product barcode or type Quick-Code... (Press [/] or [F2])"
                    value={scanQuery}
                    onChange={(e) => setScanQuery(e.target.value)}
                    style={styles.scannerInput}
                  />
                </div>
                <button type="submit" style={styles.scannerBtn}>Add Item</button>
              </form>

              {/* Dense products grid table */}
              <div style={styles.denseTableWrapper}>
                <table style={styles.posTable}>
                  <thead>
                    <tr style={styles.posHeaderRow}>
                      <th style={{ ...styles.posTh, width: '40px' }}>#</th>
                      <th style={{ ...styles.posTh, width: '120px' }}>SKU/Code</th>
                      <th style={styles.posTh}>Product Name</th>
                      <th style={{ ...styles.posTh, width: '90px', textAlign: 'right' }}>Price</th>
                      <th style={{ ...styles.posTh, width: '80px', textAlign: 'center' }}>Qty</th>
                      <th style={{ ...styles.posTh, width: '100px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, index) => {
                      const isSelected = index === selectedRowIndex;
                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => setSelectedRowIndex(index)}
                          style={{
                            ...styles.posBodyRow,
                            ...(isSelected ? styles.posRowActive : {})
                          }}
                        >
                          <td style={styles.posTd}>{index + 1}</td>
                          <td style={styles.posTd}>{item.sku?.substring(0, 10) || 'General'}</td>
                          <td style={{ ...styles.posTd, fontWeight: 'bold' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <ProductImage icon={item.icon} size={28} style={{ border: 'none', borderRadius: '4px' }} />
                              <span>{item.name}</span>
                            </div>
                          </td>
                          <td style={{ ...styles.posTd, textAlign: 'right' }}>Rs. {item.price.toLocaleString()}</td>
                          <td style={{ ...styles.posTd, textAlign: 'center' }}>
                            <span style={styles.qtyBadge}>{item.quantity}</span>
                          </td>
                          <td style={{ ...styles.posTd, textAlign: 'right', fontWeight: 'bold' }}>
                            Rs. {(item.price * item.quantity).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}

                    {cart.length === 0 && (
                      <tr>
                        <td colSpan={6} style={styles.emptyTableTd}>
                          <ShoppingBag size={48} color="var(--muted)" style={{ opacity: 0.4, marginBottom: '10px' }} />
                          <h4 style={{ margin: 0, color: 'var(--muted)' }}>Transaction Empty</h4>
                          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                            Scan product barcode or type a quick-code to begin checkout.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Cheat sheet keyboard guide */}
              <div style={styles.cheatSheetBar}>
                <span style={styles.cheatChip}><b>[↑/↓]</b> Select row</span>
                <span style={styles.cheatChip}><b>[+]</b> Qty+</span>
                <span style={styles.cheatChip}><b>[-]</b> Qty-</span>
                <span style={styles.cheatChip}><b>[Del]</b> Delete</span>
                <span style={styles.cheatChip}><b>[F2]</b> Focus Scan</span>
                <span style={styles.cheatChip}><b>[F3]</b> Customer</span>
                <span style={styles.cheatChip}><b>[F4]</b> Pay Method</span>
                <span style={styles.cheatChip}><b>[F6]</b> Discount</span>
                <span style={styles.cheatChip}><b>[F7]</b> Tax Rate</span>
                <span style={styles.cheatChip}><b>[F8]</b> Tender Val</span>
                <span style={styles.cheatChip}><b>[F10]</b> Print Invoice</span>
                <span style={styles.cheatChip}><b>[F12 / Ctrl+⌫]</b> Clear Cart</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Persistent Invoice summaries & payment settlement details */}
        <div style={styles.rightPane}>
          <div style={styles.paneTitleBar}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <h3 style={styles.paneTitle}>Invoice Summary</h3>
              {cart.length > 0 && (
                <button 
                  onClick={() => {
                    if (confirm('Clear entire cart invoice?')) {
                      resetAllState();
                      triggerToast('Cart cleared');
                    }
                  }}
                  style={styles.clearBtn}
                >
                  Clear Cart
                </button>
              )}
            </div>
          </div>

          <div style={styles.rightBodyContainer}>
            {/* Tablet mode cart scroller lists items inline on right panel */}
            {posMode === 'tablet' && (
              <div style={styles.tabletCartScroller}>
                {cart.map((item) => (
                  <div key={item.id} style={styles.cartItemRow}>
                    <ProductImage icon={item.icon} size={42} style={{ border: 'none', borderRadius: '6px' }} />
                    <div style={{ flex: 1, minWidth: 0, marginLeft: '8px' }}>
                      <h4 style={styles.cartItemName}>{item.name}</h4>
                      <span style={styles.cartItemPrice}>Rs. {item.price.toLocaleString()}</span>
                    </div>
                    
                    {/* Quantity adjust buttons */}
                    <div style={styles.qtyContainer}>
                      <button onClick={() => updateQuantity(item.id, -1)} style={styles.qtyBtn}>
                        <MinusCircle size={16} color="var(--muted)" />
                      </button>
                      <span style={styles.qtyText}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} style={styles.qtyBtn}>
                        <PlusCircle size={16} color="var(--primary)" />
                      </button>
                    </div>

                    <span style={styles.cartItemSum}>
                      Rs. {(item.price * item.quantity).toLocaleString()}
                    </span>

                    <button 
                      onClick={() => updateQuantity(item.id, -item.quantity)} 
                      style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--error)', cursor: 'pointer', marginLeft: '6px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {cart.length === 0 && (
                  <div style={styles.emptyCartState}>
                    <ShoppingBag size={32} color="var(--muted)" style={{ opacity: 0.5, marginBottom: '6px' }} />
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>No items in cart</span>
                  </div>
                )}
              </div>
            )}

            {/* Customer Lookup Profile attaching */}
            <div style={{ marginBottom: '12px', marginTop: posMode === 'tablet' ? '12px' : 0 }}>
              {customer ? (
                <div style={styles.customerStatusCard}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px' }}>{customer.name}</h4>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{customer.phone}</span>
                  </div>
                  <button 
                    onClick={() => setCustomer(null)} 
                    style={{ border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowCustModal(true)} style={styles.attachCustBtnCompact}>
                  <UserPlus size={14} />
                  <span>Attach Customer {posMode === 'normal' ? '[F3]' : ''}</span>
                </button>
              )}
            </div>

            {/* Totals Summary Panel card */}
            <div style={styles.denseSummaryCard}>
              <div style={styles.denseSumRow}>
                <span>Subtotal:</span>
                <span>Rs. {subtotal.toLocaleString()}</span>
              </div>
              
              <div style={styles.denseSumRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Discount:</span>
                  <button 
                    onClick={() => {
                      setTempDiscount(discountVal.toString());
                      setTempDiscountType(discountType === 'none' ? 'flat' : discountType);
                      setIsEditingDiscount(true);
                      setTimeout(() => discountInputRef.current?.focus(), 50);
                    }}
                    style={styles.inlineEditTextBtn}
                  >
                    Edit {posMode === 'normal' ? '[F6]' : ''}
                  </button>
                </div>
                {isEditingDiscount ? (
                  <div style={styles.inlineEditInputBox}>
                    <select 
                      value={tempDiscountType} 
                      onChange={(e) => setTempDiscountType(e.target.value as any)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          discountInputRef.current?.focus();
                        }
                      }}
                      style={styles.inlineSelect}
                    >
                      <option value="flat">Rs</option>
                      <option value="percent">%</option>
                    </select>
                    <input
                      ref={discountInputRef}
                      type="number"
                      value={tempDiscount}
                      onChange={(e) => setTempDiscount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveDiscount();
                        } else if (e.key === '%' || e.key === 'p' || e.key === 'P') {
                          e.preventDefault();
                          setTempDiscountType('percent');
                        } else if (e.key === '$' || e.key === 'r' || e.key === 'R') {
                          e.preventDefault();
                          setTempDiscountType('flat');
                        }
                      }}
                      style={styles.inlineInput}
                    />
                    <button onClick={handleSaveDiscount} style={{ ...styles.inlineIconBtn, color: 'var(--success)' }}>✓</button>
                    <button onClick={() => setIsEditingDiscount(false)} style={{ ...styles.inlineIconBtn, color: 'var(--error)' }}>✗</button>
                  </div>
                ) : (
                  <span style={discountAmount > 0 ? { color: 'var(--success)', fontWeight: 'bold' } : {}}>
                    {discountAmount > 0 ? `- Rs. ${discountAmount.toLocaleString()}` : 'Rs. 0'}
                  </span>
                )}
              </div>

              <div style={styles.denseSumRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>VAT / Taxes ({taxRate}%):</span>
                  <button 
                    onClick={() => {
                      setTempTaxRate(taxRate.toString());
                      setIsEditingTax(true);
                      setTimeout(() => taxInputRef.current?.focus(), 50);
                    }}
                    style={styles.inlineEditTextBtn}
                  >
                    Edit {posMode === 'normal' ? '[F7]' : ''}
                  </button>
                </div>
                {isEditingTax ? (
                  <div style={styles.inlineEditInputBox}>
                    <input
                      ref={taxInputRef}
                      type="number"
                      value={tempTaxRate}
                      onChange={(e) => setTempTaxRate(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTax(); }}
                      style={{ ...styles.inlineInput, width: '40px' }}
                    />
                    <span style={{ fontSize: '10px', margin: '0 2px' }}>%</span>
                    <button onClick={handleSaveTax} style={{ ...styles.inlineIconBtn, color: 'var(--success)' }}>✓</button>
                    <button onClick={() => setIsEditingTax(false)} style={{ ...styles.inlineIconBtn, color: 'var(--error)' }}>✗</button>
                  </div>
                ) : (
                  <span>Rs. {taxAmount.toLocaleString()}</span>
                )}
              </div>

              <div style={styles.denseSumDivider} />

              <div style={styles.denseSumTotalRow}>
                <span>TOTAL DUE:</span>
                <span>Rs. {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Redesigned Payment settlement container card */}
            <div style={styles.paymentSectionCard}>
              {/* Payment Method Selector */}
              <div>
                <label style={styles.denseFieldLabel}>Payment Mode {posMode === 'normal' ? '[F4]' : ''}</label>
                <div style={styles.payOptionRow}>
                  <button 
                    onClick={() => handlePaymentMethodChange('cash')}
                    style={{ 
                      ...styles.payOptionBtn, 
                      ...(paymentMethod === 'cash' ? styles.payOptionBtnCashActive : {}) 
                    }}
                  >
                    <Banknote size={16} />
                    <span>Cash</span>
                  </button>
                  <button 
                    onClick={() => handlePaymentMethodChange('card')}
                    style={{ 
                      ...styles.payOptionBtn, 
                      ...(paymentMethod === 'card' ? styles.payOptionBtnCardActive : {}) 
                    }}
                  >
                    <CreditCard size={16} />
                    <span>Card</span>
                  </button>
                  <button 
                    onClick={() => handlePaymentMethodChange('bank')}
                    style={{ 
                      ...styles.payOptionBtn, 
                      ...(paymentMethod === 'bank' ? styles.payOptionBtnBankActive : {}) 
                    }}
                  >
                    <Wallet size={16} />
                    <span>Bank</span>
                  </button>
                </div>
              </div>

              {/* Tender Amount inputs details area */}
              <div style={styles.tenderTogglesArea}>
                {paymentMethod === 'cash' && (
                  <div>
                    <label style={styles.denseFieldLabel}>Cash Tendered (Rs.) {posMode === 'normal' ? '[F8]' : ''}</label>
                    <input
                      ref={cashReceivedRef}
                      type="number"
                      placeholder="Enter cash received..."
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      style={styles.denseTenderInput}
                    />

                    {/* Cash chips selector */}
                    <div style={styles.fastTenderGrid}>
                      <button onClick={() => setCashReceived(Math.ceil(totalAmount).toString())} style={styles.fastTenderChip}>
                        Exact
                      </button>
                      {[100, 200, 500, 1000, 5000].map(note => {
                        if (note < totalAmount) return null;
                        return (
                          <button key={note} onClick={() => setCashReceived(note.toString())} style={styles.fastTenderChip}>
                            Rs. {note}
                          </button>
                        );
                      })}
                    </div>

                    {cashReceived !== '' && (
                      parseFloat(cashReceived) < totalAmount ? (
                        <div style={styles.tenderWarningBanner}>
                          <AlertTriangle size={14} />
                          <span>Short by Rs. {(totalAmount - (parseFloat(cashReceived) || 0)).toLocaleString()}</span>
                        </div>
                      ) : (
                        <div style={styles.tenderSuccessBanner}>
                          <CheckCircle size={14} />
                          <span>Change to Return: Rs. {changeDue.toLocaleString()}</span>
                        </div>
                      )
                    )}
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={styles.denseFieldLabel}>Card Brand / Bank *</label>
                      <select
                        ref={cardBrandSelectRef}
                        value={isCustomBank ? 'Other' : bankName}
                        onChange={(e) => {
                          if (e.target.value === 'Other') {
                            setIsCustomBank(true);
                            setBankName('');
                          } else {
                            setIsCustomBank(false);
                            setBankName(e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (e.currentTarget.value === 'Other') {
                              bankNameRef.current?.focus();
                            } else {
                              cardDigitsRef.current?.focus();
                            }
                          }
                        }}
                        style={styles.denseTenderSelect}
                      >
                        <option value="">Select Card brand/bank...</option>
                        {CARD_BRANDS_AND_BANKS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                        <option value="Other">Other Bank (Type...)</option>
                      </select>

                      {isCustomBank && (
                        <input
                          ref={bankNameRef}
                          type="text"
                          placeholder="Type custom card bank..."
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          style={{ ...styles.denseTenderInput, marginBottom: '8px' }}
                        />
                      )}
                    </div>
                    <div>
                      <label style={styles.denseFieldLabel}>Card Number (Last 4 Digits) * {posMode === 'normal' ? '[F8]' : ''}</label>
                      <input
                        ref={cardDigitsRef}
                        type="text"
                        maxLength={4}
                        placeholder="e.g. 9876"
                        value={cardDigits}
                        onChange={(e) => {
                          const numericVal = e.target.value.replace(/[^0-9]/g, "");
                          setCardDigits(numericVal.slice(0, 4));
                        }}
                        style={styles.denseTenderInput}
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === 'bank' && (
                  <div>
                    <label style={styles.denseFieldLabel}>Beneficiary Bank Name * {posMode === 'normal' ? '[F8]' : ''}</label>
                    <select
                      ref={bankNameSelectRef}
                      value={isCustomBank ? 'Other' : bankName}
                      onChange={(e) => {
                        if (e.target.value === 'Other') {
                          setIsCustomBank(true);
                          setBankName('');
                        } else {
                          setIsCustomBank(false);
                          setBankName(e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (e.currentTarget.value === 'Other') {
                            bankNameRef.current?.focus();
                          } else {
                            settleBtnRef.current?.focus();
                          }
                        }
                      }}
                      style={styles.denseTenderSelect}
                    >
                      <option value="">Select Beneficiary Bank...</option>
                      {SRI_LANKAN_BANKS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                      <option value="Other">Other Bank (Type...)</option>
                    </select>

                    {isCustomBank && (
                      <input
                        ref={bankNameRef}
                        type="text"
                        placeholder="Type bank name..."
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        style={styles.denseTenderInput}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Settle confirm checkout payment button */}
            <button 
              ref={settleBtnRef}
              onClick={handleConfirmCheckout} 
              disabled={paying || cart.length === 0 || !isPaymentValid}
              style={{
                ...styles.settleInvoiceBtn,
                ...((cart.length === 0 || !isPaymentValid) ? styles.settleInvoiceBtnDisabled : {})
              }}
            >
              <Printer size={16} />
              <span>Confirm & Print Receipt {posMode === 'normal' ? '[F10]' : ''}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Customer attachment modal */}
      {showCustModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>Attach Customer Profile</h3>
              <button 
                onClick={() => { 
                  setShowCustModal(false); 
                  if (posMode === 'normal') setTimeout(() => scanInputRef.current?.focus(), 50); 
                }} 
                style={styles.modalCloseBtn}
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Tab selector */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
              <button 
                onClick={() => { setCustModalTab('search'); setTimeout(() => custSearchInputRef.current?.focus(), 50); }}
                style={{
                  flex: 1, padding: '10px', fontSize: '13px', fontWeight: 'bold', border: 'none', background: 'transparent',
                  borderBottom: custModalTab === 'search' ? '2px solid var(--primary)' : 'none',
                  color: custModalTab === 'search' ? 'var(--primary)' : 'var(--muted)',
                  cursor: 'pointer'
                }}
              >
                Search Existing [Tab]
              </button>
              <button 
                onClick={() => { setCustModalTab('create'); setTimeout(() => custNameInputRef.current?.focus(), 50); }}
                style={{
                  flex: 1, padding: '10px', fontSize: '13px', fontWeight: 'bold', border: 'none', background: 'transparent',
                  borderBottom: custModalTab === 'create' ? '2px solid var(--primary)' : 'none',
                  color: custModalTab === 'create' ? 'var(--primary)' : 'var(--muted)',
                  cursor: 'pointer'
                }}
              >
                Register New [Tab]
              </button>
            </div>

            {custModalTab === 'search' ? (
              <div>
                <input
                  ref={custSearchInputRef}
                  type="text"
                  placeholder="Type name or phone number to filter..."
                  value={custSearchQuery}
                  onChange={(e) => setCustSearchQuery(e.target.value)}
                  style={styles.modalInput}
                />
                
                <div style={styles.custListContainer}>
                  {filteredCustomers.map(c => (
                    <div 
                      key={c.phone} 
                      onClick={() => {
                        setCustomer(c);
                        setShowCustModal(false);
                        triggerToast(`Attached ${c.name} 👤`);
                        if (posMode === 'normal') setTimeout(() => scanInputRef.current?.focus(), 50);
                      }}
                      style={styles.custSelectItem}
                    >
                      <h4 style={{ margin: 0, fontSize: '13px' }}>{c.name}</h4>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{c.phone}</span>
                    </div>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>No customers found</p>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Customer Name *</label>
                  <input
                    ref={custNameInputRef}
                    type="text"
                    placeholder="e.g. John Doe"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    style={styles.modalInput}
                    required
                  />
                </div>
                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Phone Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. 0771234567"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    style={styles.modalInput}
                    required
                  />
                </div>
                <button type="submit" style={styles.modalSubmitBtn}>Register & Attach Customer</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Quick Add Product catalog modal (Tablet mode view only) */}
      {showAddProdModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>Quick Register Product</h3>
              <button onClick={() => setShowAddProdModal(false)} style={styles.modalCloseBtn}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddCatalogSubmit} style={styles.modalBody}>
              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Product Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Anchor Milk 400g" 
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  style={styles.modalInput}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Price (Rs.) *</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 850" 
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    style={styles.modalInput}
                    required
                  />
                </div>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Initial Stock *</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 50" 
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    style={styles.modalInput}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Quick Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 101" 
                    value={newProdQuickCode}
                    onChange={(e) => setNewProdQuickCode(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Barcode</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 47900101" 
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Category</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Dairy / Snacks" 
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Icon Emoji</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 🥛" 
                    value={newProdIcon}
                    onChange={(e) => setNewProdIcon(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
              </div>
              <button type="submit" style={styles.modalSubmitBtn}>
                Register Product
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Completed Receipt Modal view */}
      {showReceipt && latestOrder && (
        <div style={styles.modalOverlay}>
          <div style={styles.receiptPaper}>
            <div style={styles.receiptHeader}>
              <h2 style={{ margin: 0, fontSize: '18px', letterSpacing: '0.5px' }}>SHOPBOOK MINI POS</h2>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{activeBusiness?.name || 'Partner Outlet'}</span>
              <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '4px 0 0 0' }}>{activeBusiness?.address || 'Terminal #1'}</p>
            </div>

            <div style={styles.receiptDivider} />

            <div style={styles.receiptMetaRow}>
              <span>Invoice: {latestOrder.invoiceNumber}</span>
              <span>Date: {latestOrder.date}</span>
            </div>
            <div style={styles.receiptMetaRow}>
              <span>Cashier: {employeeName}</span>
              <span>
                Method: {latestOrder.paymentMethod.toUpperCase()}
                {latestOrder.paymentMethod === 'card' && latestOrder.bankName ? ` (${latestOrder.bankName})` : ''}
                {latestOrder.paymentMethod === 'bank' && latestOrder.bankName ? ` (${latestOrder.bankName})` : ''}
              </span>
            </div>
            {latestOrder.paymentMethod === 'card' && latestOrder.cardLastFour && (
              <div style={styles.receiptMetaRow}>
                <span>Card No: •••• •••• •••• {latestOrder.cardLastFour}</span>
              </div>
            )}

            {latestOrder.customer && (
              <div style={{ ...styles.receiptMetaRow, borderTop: '1px dashed #000000', paddingTop: '4px', marginTop: '4px' }}>
                <span>Cust: {latestOrder.customer.name}</span>
                <span>Mob: {latestOrder.customer.phone}</span>
              </div>
            )}

            <div style={styles.receiptDivider} />

            {/* Items list */}
            <div style={styles.receiptItemsList}>
              {latestOrder.items.map((item: any) => (
                <div key={item.id} style={styles.receiptItemLine}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                    <span>Rs. {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                    {item.quantity} x Rs. {item.price.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div style={styles.receiptDivider} />

            {/* Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 4px' }}>
              <div style={styles.receiptTotalLine}>
                <span>Subtotal:</span>
                <span>Rs. {latestOrder.subtotal.toLocaleString()}</span>
              </div>
              {latestOrder.discountAmount > 0 && (
                <div style={styles.receiptTotalLine}>
                  <span>Discount:</span>
                  <span>- Rs. {latestOrder.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div style={styles.receiptTotalLine}>
                <span>Taxes:</span>
                <span>Rs. {latestOrder.taxAmount.toLocaleString()}</span>
              </div>
              <div style={{ ...styles.receiptTotalLine, fontWeight: 'bold', fontSize: '14px', borderTop: '1px solid #000000', paddingTop: '6px', marginTop: '4px' }}>
                <span>NET TOTAL:</span>
                <span>Rs. {latestOrder.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div style={styles.receiptDivider} />

            <div style={styles.receiptFooter}>
              <h3 style={{ margin: 0, fontSize: '12px' }}>Thank you for shopping!</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '9px', color: 'var(--muted)' }}>Powered by Shopbook POS Cloud System</p>
            </div>

            <button 
              onClick={() => { setShowReceipt(false); resetAllStateRef.current(); }} 
              style={styles.closeReceiptBtn}
            >
              Close & New Sale [Enter]
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  workspace: {
    height: 'calc(100vh - 73px)',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  posGridContainer: {
    display: 'flex',
    height: '100%',
    minHeight: 0,
    width: '100%',
  },
  leftPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    height: '100%',
    minWidth: 0,
  },
  rightPane: {
    width: '360px',
    backgroundColor: '#ffffff',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    borderLeft: '1px solid var(--border)',
  },
  catalogPane: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  searchRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '16px',
    flexShrink: 0,
  },
  searchBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 14px',
    boxShadow: 'var(--shadow)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    color: 'var(--dark)',
  },
  viewToggleGroup: {
    display: 'flex',
    border: '1px solid var(--border)',
    padding: '3px',
    borderRadius: '6px',
    backgroundColor: '#f3f4f6',
  },
  viewToggleBtn: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    transition: 'all 0.15s ease',
  },
  viewToggleBtnActive: {
    backgroundColor: '#ffffff',
    color: 'var(--primary)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  categoryScroller: {
    display: 'flex',
    gap: '6px',
    overflowX: 'auto',
    marginBottom: '14px',
    paddingBottom: '4px',
    flexShrink: 0,
  },
  categoryTab: {
    padding: '6px 14px',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    fontWeight: 'bold',
    fontSize: '11px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  categoryTabActive: {
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    borderColor: 'var(--primary)',
  },
  productsGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
    overflowY: 'auto',
    paddingBottom: '16px',
  },
  prodCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    position: 'relative',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
    overflow: 'hidden',
    height: '210px',
  },
  prodCardOut: {
    opacity: 0.7,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: '120px',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid var(--border)',
    overflow: 'hidden',
  },
  stockBadge: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    fontSize: '8px',
    fontWeight: '800',
    padding: '2px 6px',
    borderRadius: '10px',
  },
  prodCardDetails: {
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    justifyContent: 'space-between',
  },
  cardCategory: {
    fontSize: '9px',
    fontWeight: '700',
    color: 'var(--muted)',
    textTransform: 'uppercase',
  },
  prodName: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--dark)',
    lineHeight: '1.2',
    margin: '2px 0',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    height: '28px',
  },
  priceAddRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prodPrice: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--primary)',
  },
  plusIconBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    height: '22px',
    borderRadius: '6px',
    padding: '0 6px',
  },
  emptyGridState: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 16px',
    textAlign: 'center',
    gap: '6px',
  },
  catalogLayout: {
    flex: 1,
    display: 'flex',
    height: '100%',
    minHeight: 0,
  },
  sidebar: {
    width: '160px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 10px',
    gap: '4px',
    flexShrink: 0,
    overflowY: 'auto',
  },
  sidebarBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    fontSize: '12px',
    fontWeight: 'bold',
    textAlign: 'left',
    cursor: 'pointer',
  },
  sidebarBtnActive: {
    backgroundColor: 'var(--light-blue)',
    color: 'var(--primary)',
  },
  gridWrapper: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '12px',
  },
  productCard: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    height: '180px',
    cursor: 'pointer',
  },
  productName: {
    margin: 0,
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--dark)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  productPrice: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--primary)',
  },
  productStock: {
    fontSize: '9px',
    color: 'var(--muted)',
  },
  productStockOut: {
    color: 'var(--error)',
    fontWeight: 'bold',
  },
  productStockLow: {
    color: 'var(--warning)',
    fontWeight: 'bold',
  },
  productAddBtn: {
    width: '100%',
    padding: '6px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  productAddBtnDisabled: {
    backgroundColor: '#e2e8f0',
    color: '#94a3b8',
    cursor: 'not-allowed',
  },
  normalTablePanel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
  },
  scannerBar: {
    display: 'flex',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    gap: '12px',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  scannerInputBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 14px',
  },
  scannerInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    color: 'var(--dark)',
  },
  scannerBtn: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
  },
  denseTableWrapper: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  posTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  posHeaderRow: {
    borderBottom: '2px solid var(--border)',
  },
  posTh: {
    padding: '10px 8px',
    textAlign: 'left',
    color: 'var(--muted)',
    fontWeight: '700',
    fontSize: '11px',
  },
  posBodyRow: {
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
  },
  posRowActive: {
    backgroundColor: 'var(--light-blue)',
  },
  posTd: {
    padding: '10px 8px',
    color: 'var(--dark)',
    verticalAlign: 'middle',
  },
  qtyBadge: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '10px',
    backgroundColor: '#f1f5f9',
    fontWeight: 'bold',
    fontSize: '11px',
  },
  emptyTableTd: {
    padding: '48px 24px',
    textAlign: 'center',
  },
  cheatSheetBar: {
    display: 'flex',
    gap: '6px',
    padding: '8px 20px',
    borderTop: '1px solid var(--border)',
    backgroundColor: '#f8fafc',
    overflowX: 'auto',
  },
  cheatChip: {
    fontSize: '9px',
    color: 'var(--muted)',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 6px',
  },
  paneTitleBar: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
  },
  paneTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  clearBtn: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--error)',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  rightBodyContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
  },
  tabletCartScroller: {
    flex: 1,
    maxHeight: '180px',
    overflowY: 'auto',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '12px',
  },
  cartItemRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  cartItemName: {
    margin: 0,
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cartItemPrice: {
    fontSize: '11px',
    color: 'var(--primary)',
    fontWeight: 'bold',
  },
  qtyContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginLeft: '6px',
  },
  qtyBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: '11px',
    fontWeight: 'bold',
    minWidth: '12px',
    textAlign: 'center',
  },
  cartItemSum: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    marginLeft: '10px',
    minWidth: '60px',
    textAlign: 'right',
  },
  emptyCartState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 0',
  },
  customerStatusCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--light-blue)',
    border: '1px solid var(--accent-blue)',
    borderRadius: '8px',
    padding: '8px 12px',
  },
  attachCustBtnCompact: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px',
    border: '1px dashed var(--border)',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: 'var(--primary)',
    fontWeight: 'bold',
    fontSize: '11px',
    cursor: 'pointer',
  },
  denseSummaryCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '12px',
  },
  denseSumRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '11px',
    color: 'var(--dark)',
  },
  inlineEditTextBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--primary)',
    fontWeight: 'bold',
    fontSize: '9px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  inlineEditInputBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '1px 3px',
  },
  inlineSelect: {
    border: 'none',
    outline: 'none',
    fontSize: '9px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  inlineInput: {
    border: 'none',
    outline: 'none',
    width: '40px',
    fontSize: '10px',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  inlineIconBtn: {
    border: 'none',
    background: 'transparent',
    fontWeight: 'bold',
    fontSize: '10px',
    cursor: 'pointer',
    padding: '0 2px',
  },
  denseSumDivider: {
    height: '1px',
    backgroundColor: 'var(--border)',
    margin: '3px 0',
  },
  denseSumTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    fontWeight: '900',
    color: 'var(--dark)',
  },
  denseFieldLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
    display: 'block',
  },
  paymentSectionCard: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  payOptionRow: {
    display: 'flex',
    gap: '4px',
  },
  payOptionBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '12px 8px',
    borderRadius: '8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  payOptionBtnCashActive: {
    backgroundColor: '#effaf3',
    borderColor: '#137333',
    color: '#137333',
    boxShadow: '0 2px 4px rgba(19, 115, 51, 0.1)',
  },
  payOptionBtnCardActive: {
    backgroundColor: 'var(--light-blue)',
    borderColor: 'var(--primary)',
    color: 'var(--primary)',
    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.1)',
  },
  payOptionBtnBankActive: {
    backgroundColor: '#f5f3ff',
    borderColor: '#7c3aed',
    color: '#7c3aed',
    boxShadow: '0 2px 4px rgba(124, 58, 237, 0.1)',
  },
  tenderTogglesArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  denseTenderInput: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    fontSize: '12px',
    outline: 'none',
  },
  denseTenderSelect: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    fontSize: '12px',
    backgroundColor: '#ffffff',
    color: 'var(--dark)',
    outline: 'none',
    cursor: 'pointer',
  },
  fastTenderGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '3px',
    marginTop: '4px',
  },
  fastTenderChip: {
    padding: '3px 6px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    fontSize: '9px',
    fontWeight: 'bold',
    backgroundColor: '#f8fafc',
    cursor: 'pointer',
  },
  changeDueBoxCompact: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px',
    padding: '6px 10px',
    backgroundColor: '#effaf3',
    border: '1px solid #cceadb',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--success)',
  },
  tenderWarningBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '8px',
    padding: '8px 12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fee2e2',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--error)',
  },
  tenderSuccessBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '8px',
    padding: '8px 12px',
    backgroundColor: '#effaf3',
    border: '1px solid #cceadb',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--success)',
  },
  settleInvoiceBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: '0 3px 8px rgba(37, 99, 235, 0.15)',
    marginTop: 'auto',
  },
  settleInvoiceBtnDisabled: {
    backgroundColor: '#cbd5e1',
    color: '#94a3b8',
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
    padding: '10px 20px',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 'bold',
    fontSize: '12px',
    zIndex: 99999,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(3px)',
  },
  modalContent: {
    width: '100%',
    maxWidth: '360px',
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  modalCloseBtn: {
    width: '20px',
    height: '20px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#f1f5f9',
    color: 'var(--muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  modalLabel: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: 'var(--muted)',
  },
  modalInput: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    fontSize: '12px',
    outline: 'none',
  },
  custListContainer: {
    marginTop: '8px',
    maxHeight: '150px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  custSelectItem: {
    padding: '6px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    border: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  modalSubmitBtn: {
    width: '100%',
    padding: '10px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    marginTop: '6px',
  },
  receiptPaper: {
    width: '300px',
    backgroundColor: '#ffffff',
    borderRadius: '2px',
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'monospace',
    color: '#000000',
  },
  receiptHeader: {
    textAlign: 'center',
    marginBottom: '8px',
  },
  receiptDivider: {
    borderTop: '1px dashed #000000',
    margin: '10px 0',
  },
  receiptMetaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '9px',
  },
  receiptItemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  receiptItemLine: {
    fontSize: '10px',
  },
  receiptTotalLine: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
  },
  receiptFooter: {
    textAlign: 'center',
    fontSize: '9px',
    margin: '8px 0 12px 0',
  },
  closeReceiptBtn: {
    width: '100%',
    padding: '10px',
    borderRadius: '2px',
    border: 'none',
    backgroundColor: '#000000',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '11px',
    cursor: 'pointer',
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
};
