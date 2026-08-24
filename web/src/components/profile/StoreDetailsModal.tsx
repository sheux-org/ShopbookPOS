'use client';

import React from 'react';
import { X, Save, Lock, Store, Camera, Trash2 } from 'lucide-react';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useTranslation } from '../../hooks/useTranslation';

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
  editLogoUri: string;
  setEditLogoUri: (val: string) => void;
  onLogoUpload: (file: File) => void;
  onSubmit: (e: React.FormEvent) => void;
  hasItems?: boolean;
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
  editLogoUri,
  setEditLogoUri,
  onLogoUpload,
  onSubmit,
  hasItems = false,
}) => {
  const { canPerform } = useUserPermissions();
  const { t } = useTranslation();
  const canUpdate = canPerform('update', 'settings');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleLogoClick = () => {
    if (canUpdate) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLogoUpload(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{t('businessDetails.title')}</h3>
          <button onClick={onClose} className="modal-close-btn" type="button">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="modal-body">
          {!canUpdate && (
            <div
              style={{
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
                marginBottom: '14px',
              }}
            >
              <Lock size={14} />
              <span>Viewing Mode: Only administrators can update store configuration details.</span>
            </div>
          )}

          {/* Logo Section */}
          <div className="modal-logo-section">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <div
              className={`modal-logo-container ${canUpdate ? 'clickable' : ''}`}
              onClick={handleLogoClick}
              title={canUpdate ? 'Click to change store logo' : undefined}
            >
              {editLogoUri ? (
                <img src={editLogoUri} alt="Store Logo" className="modal-logo-preview" />
              ) : (
                <div className="modal-logo-placeholder">
                  <Store size={24} />
                  <span>Upload Logo</span>
                </div>
              )}
              {canUpdate && (
                <div className="modal-logo-camera-overlay">
                  <Camera size={14} />
                </div>
              )}
            </div>
            {editLogoUri && canUpdate && (
              <button
                type="button"
                onClick={() => setEditLogoUri('')}
                className="modal-remove-logo-btn"
              >
                <Trash2 size={12} />
                <span>Remove logo</span>
              </button>
            )}
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                {editName}
              </h4>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: '#6b7280',
                  fontWeight: '500',
                }}
              >
                📞 {editPhone}
              </p>
            </div>
          </div>

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
            <label className="modal-label">Business Type</label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              required
              disabled={!canUpdate || hasItems}
              className="modal-select"
            >
              <option value="Cafe">Cafe</option>
              <option value="Restaurant">Restaurant</option>
              <option value="Boutique">Boutique</option>
              <option value="Salon">Salon</option>
              <option value="Supermarket">Supermarket</option>
              <option value="Grocery Shop">Grocery Shop</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Hardware">Hardware</option>
              <option value="Other">Other</option>
            </select>
            {hasItems && (
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                Business type cannot be changed because items have already been created in the
                catalog.
              </p>
            )}
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

          {canUpdate ? (
            <button type="submit" className="modal-submit-btn">
              <Save size={16} />
              <span>Save store details</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="modal-submit-btn"
              style={{ backgroundColor: 'var(--dark)' }}
            >
              <span>Close View</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
