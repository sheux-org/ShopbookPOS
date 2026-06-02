'use client';

import React from 'react';
import { X, Save, Lock } from 'lucide-react';
import { useUserPermissions } from '../../hooks/useUserPermissions';

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
  const { canPerform } = useUserPermissions();
  const canUpdate = canPerform('update', 'settings');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Update Store details</h3>
          <button onClick={onClose} className="modal-close-btn"><X size={16} /></button>
        </div>
        <form onSubmit={onSubmit} className="modal-body">
          {!canUpdate && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '8px',
              color: '#d97706',
              fontSize: '11px',
              fontWeight: '500',
              marginBottom: '14px'
            }}>
              <Lock size={14} />
              <span>Viewing Mode: Only administrators can update store configuration details.</span>
            </div>
          )}

          <div className="modal-input-group">
            <label className="modal-label">Business Brand Name</label>
            <input 
              type="text" 
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              disabled={!canUpdate}
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
              disabled={!canUpdate}
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
              disabled={!canUpdate}
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
              disabled={!canUpdate}
              className="modal-input"
            />
          </div>

          {canUpdate ? (
            <button type="submit" className="modal-submit-btn">
              <Save size={16} />
              <span>Save receipt details</span>
            </button>
          ) : (
            <button type="button" onClick={onClose} className="modal-submit-btn" style={{ backgroundColor: 'var(--dark)' }}>
              <span>Close View</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

