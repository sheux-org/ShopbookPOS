'use client';

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { usePosBilling } from '../hooks/usePosBilling';
import './page.css';

import { DenseCartTable } from '../components/pos/DenseCartTable';
import { TabletCartScroller } from '../components/pos/TabletCartScroller';
import { TotalsSummary } from '../components/pos/TotalsSummary';
import { SettlementCard } from '../components/pos/SettlementCard';
import { CustomerModal } from '../components/pos/CustomerModal';
import { CatalogView } from '../components/pos/CatalogView';
import { ReceiptModal } from '../components/pos/ReceiptModal';

export default function PosBillingPage() {
  const {
    cart,
    customer,
    customCustomers,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    viewMode,
    setViewMode,
    toastMsg,
    scanQuery,
    setScanQuery,
    selectedRowIndex,
    setSelectedRowIndex,
    showCustModal,
    setShowCustModal,
    discountType,
    discountVal,
    isEditingDiscount,
    setIsEditingDiscount,
    tempDiscount,
    setTempDiscount,
    tempDiscountType,
    setTempDiscountType,
    taxRate,
    isEditingTax,
    setIsEditingTax,
    tempTaxRate,
    setTempTaxRate,
    paymentMethod,
    cashReceived,
    setCashReceived,
    bankName,
    setBankName,
    cardDigits,
    setCardDigits,
    paying,
    isCustomBank,
    setIsCustomBank,
    showReceipt,
    setShowReceipt,
    latestOrder,
    activeBusiness,
    posMode,
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount,
    changeDue,
    categories,
    filteredProducts,
    isPaymentValid,
    handleScanSubmit,
    handleConfirmCheckout,
    resetAllState,
    handleSaveDiscount,
    handleSaveTax,
    handleCreateCustomer,
    handlePaymentMethodChange,
    scanInputRef,
    discountInputRef,
    taxInputRef,
    cashReceivedRef,
    cardBrandSelectRef,
    cardDigitsRef,
    bankNameSelectRef,
    bankNameRef,
    settleBtnRef,
    addCartItem,
    triggerToast,
    updateQuantity,
    setCustomer,
  } = usePosBilling();

  return (
    <div className="unified-pos-workspace fade-in">
      {toastMsg && (
        <div className="toast-popup">
          <CheckCircle size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="pos-grid-container">
        {/* Left Panel: Catalog OR Dense Scanned Cart Table */}
        <div className="pos-left-pane">
          {posMode === 'tablet' ? (
            <CatalogView 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              viewMode={viewMode}
              setViewMode={setViewMode}
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              filteredProducts={filteredProducts}
              addCartItem={addCartItem}
              triggerToast={triggerToast}
            />
          ) : (
            <DenseCartTable 
              cart={cart}
              selectedRowIndex={selectedRowIndex}
              setSelectedRowIndex={setSelectedRowIndex}
              scanQuery={scanQuery}
              setScanQuery={setScanQuery}
              handleScanSubmit={handleScanSubmit}
              scanInputRef={scanInputRef}
            />
          )}
        </div>

        {/* Right Panel: Persistent Invoice summaries & payment settlement details */}
        <div className="pos-right-pane">
          <div className="pane-title-bar">
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <h3 className="pane-title">Invoice Summary</h3>
              {cart.length > 0 && (
                <button 
                  onClick={() => {
                    if (confirm('Clear entire cart invoice?')) {
                      resetAllState();
                      triggerToast('Cart cleared');
                    }
                  }}
                  className="clear-btn"
                >
                  Clear Cart
                </button>
              )}
            </div>
          </div>

          <div className="right-body-container">
            {posMode === 'tablet' && (
              <TabletCartScroller 
                cart={cart}
                updateQuantity={updateQuantity}
              />
            )}

            {/* Customer Lookup Profile */}
            <div style={{ marginBottom: '12px', marginTop: posMode === 'tablet' ? '12px' : 0 }}>
              {customer ? (
                <div className="customer-status-card">
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px' }}>{customer.name}</h4>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{customer.phone}</span>
                  </div>
                  <button 
                    onClick={() => setCustomer(null)} 
                    className="remove-customer-btn"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowCustModal(true)} className="attach-cust-btn-compact">
                  <span>Attach Customer {posMode === 'normal' ? '[F3]' : ''}</span>
                </button>
              )}
            </div>

            <TotalsSummary 
              subtotal={subtotal}
              discountAmount={discountAmount}
              discountVal={discountVal}
              discountType={discountType}
              taxAmount={taxAmount}
              taxRate={taxRate}
              totalAmount={totalAmount}
              isEditingDiscount={isEditingDiscount}
              setIsEditingDiscount={setIsEditingDiscount}
              isEditingTax={isEditingTax}
              setIsEditingTax={setIsEditingTax}
              tempDiscount={tempDiscount}
              setTempDiscount={setTempDiscount}
              tempDiscountType={tempDiscountType}
              setTempDiscountType={setTempDiscountType}
              tempTaxRate={tempTaxRate}
              setTempTaxRate={setTempTaxRate}
              handleSaveDiscount={handleSaveDiscount}
              handleSaveTax={handleSaveTax}
              discountInputRef={discountInputRef}
              taxInputRef={taxInputRef}
              posMode={posMode}
            />

            <SettlementCard 
              paymentMethod={paymentMethod}
              handlePaymentMethodChange={handlePaymentMethodChange}
              cashReceived={cashReceived}
              setCashReceived={setCashReceived}
              totalAmount={totalAmount}
              changeDue={changeDue}
              isCustomBank={isCustomBank}
              setIsCustomBank={setIsCustomBank}
              bankName={bankName}
              setBankName={setBankName}
              cardDigits={cardDigits}
              setCardDigits={setCardDigits}
              paying={paying}
              cartLength={cart.length}
              isPaymentValid={isPaymentValid}
              handleConfirmCheckout={handleConfirmCheckout}
              posMode={posMode}
              cashReceivedRef={cashReceivedRef}
              cardBrandSelectRef={cardBrandSelectRef}
              cardDigitsRef={cardDigitsRef}
              bankNameSelectRef={bankNameSelectRef}
              bankNameRef={bankNameRef}
              settleBtnRef={settleBtnRef}
            />
          </div>
        </div>
      </div>

      <CustomerModal 
        isOpen={showCustModal}
        onClose={() => setShowCustModal(false)}
        customers={customCustomers}
        onAttachCustomer={setCustomer}
        onRegisterCustomer={handleCreateCustomer}
        posMode={posMode}
        scanInputRef={scanInputRef}
      />

      <ReceiptModal 
        isOpen={showReceipt}
        order={latestOrder}
        items={cart}
        activeBusiness={activeBusiness}
        changeDue={changeDue}
        onClose={() => {
          setShowReceipt(false);
          resetAllState();
        }}
      />
    </div>
  );
}
