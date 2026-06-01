'use client';

import React from 'react';
import { X, Save } from 'lucide-react';

interface StoreDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  editName: string;
  setEditName: (val: string) => void;
  editCategory: string;
  setEditCategory: (val: string) => void;
  editAddress: string;
  setEditAddress: (val: string) => void;
  editPhone: string;
  setEditPhone: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const StoreDetailsModal: React.FC<StoreDetailsModalProps> = ({
  isOpen,
  onClose,
  editName,
  setEditName,
  editCategory,
  setEditCategory,
  editAddress,
  setEditAddress,
  editPhone,
  setEditPhone,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Update Store details</h3>
          <button onClick={onClose} className="modal-close-btn"><X size={16} /></button>
        </div>
        <form onSubmit={onSubmit} className="modal-body">
          <div className="modal-input-group">
            <label className="modal-label">Business Brand Name</label>
            <input 
              type="text" 
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="modal-input"
            />
          </div>

          <div className="modal-input-group">
            <label className="modal-label">Store Category</label>
            <input 
              type="text" 
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              required
              className="modal-input"
            />
          </div>

          <div className="modal-input-group">
            <label className="modal-label">Billing Address</label>
            <input 
              type="text" 
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              required
              className="modal-input"
            />
          </div>

          <div className="modal-input-group">
            <label className="modal-label">Receipt Phone Number</label>
            <input 
              type="text" 
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              required
              className="modal-input"
            />
          </div>

          <button type="submit" className="modal-submit-btn">
            <Save size={16} />
            <span>Save receipt details</span>
          </button>
        </form>
      </div>
    </div>
  );
};
