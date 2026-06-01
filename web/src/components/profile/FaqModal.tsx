'use client';

import React from 'react';
import { X } from 'lucide-react';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FaqModal: React.FC<FaqModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3>Help & Support FAQs</h3>
          <button onClick={onClose} className="modal-close-btn"><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <div className="faq-block">
            <h4>🔌 How do I connect to thermal printers?</h4>
            <p>On the web terminal, printer support is handled via the native browser Print dialog. You can print invoices directly to standard thermal roll printers (58mm/80mm) connected via USB or Wifi. Make sure to adjust margins to 'None' inside the browser print settings.</p>
          </div>
          <div className="faq-block">
            <h4>📦 How do I manage low stock alert triggers?</h4>
            <p>Inside the Stocks Management workspace page, edit any product details to configure the low stock unit alerts. Alerts trigger visual highlights inside both stock lists and billing catalog cards.</p>
          </div>
          <div className="faq-block">
            <h4>☁️ How does database backup sync operate?</h4>
            <p>The Pro web client saves all catalog adjustments, staff settings, and billing logs inside IndexedDB locally. Enabling backup sync syncs offline operations automatically to Supabase. Manual backups can be triggered in Profile settings or the sidebar panel.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
