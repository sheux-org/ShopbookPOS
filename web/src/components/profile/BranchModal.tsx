'use client';

import React from 'react';
import { X, PlusCircle, Lock } from 'lucide-react';
import { useUserPermissions } from '../../hooks/useUserPermissions';

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  businesses: any[];
  activeBusiness: any;
  setActiveBusiness: (id: string) => void;
  newBranchName: string;
  setNewBranchName: (val: string) => void;
  newBranchCategory: string;
  setNewBranchCategory: (val: string) => void;
  newBranchAddress: string;
  setNewBranchAddress: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  triggerToast: (msg: string) => void;
}

export const BranchModal: React.FC<BranchModalProps> = ({
  isOpen,
  onClose,
  businesses,
  activeBusiness,
  setActiveBusiness,
  newBranchName,
  setNewBranchName,
  newBranchCategory,
  setNewBranchCategory,
  newBranchAddress,
  setNewBranchAddress,
  onSubmit,
  triggerToast,
}) => {
  const { canPerform } = useUserPermissions();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h3>Multi-Business & Branches Portal</h3>
          <button onClick={onClose} className="modal-close-btn">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body modal-body-split">
          {canPerform('create', 'settings') ? (
            <form
              onSubmit={onSubmit}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <h4 className="form-title">Onboard New Business / Branch</h4>

              <div className="modal-input-group">
                <label className="modal-label">Branch Name</label>
                <input
                  type="text"
                  placeholder="e.g. Shopbook Kandy Branch"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  required
                  className="modal-input"
                />
              </div>

              <div className="modal-input-group">
                <label className="modal-label">Business Type</label>
                <select
                  value={newBranchCategory}
                  onChange={(e) => setNewBranchCategory(e.target.value)}
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
              </div>

              <div className="modal-input-group">
                <label className="modal-label">Physical Address</label>
                <input
                  type="text"
                  placeholder="e.g. 50 Temple Road, Kandy"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  required
                  className="modal-input"
                />
              </div>

              <button type="submit" className="modal-submit-btn">
                <PlusCircle size={16} />
                <span>Onboard Business/Branch</span>
              </button>
            </form>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--background)',
                gap: '12px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Lock size={18} color="var(--error)" />
              </div>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--dark)', margin: 0 }}>
                Registration Restricted
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: '1.5', margin: 0 }}>
                Only store administrators are authorized to initialize new branches and locations.
              </p>
            </div>
          )}

          <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 className="form-title">Registered Businesses & Branches ({businesses.length})</h4>
            <div className="branch-scroller">
              {businesses.map((biz) => {
                const isActive = biz.id === activeBusiness?.id;
                return (
                  <div
                    key={biz.id}
                    onClick={() => {
                      if (biz.id === '0') return;
                      setActiveBusiness(biz.id);
                      triggerToast(`Switched active context to ${biz.name}! 🏬`);
                      onClose();
                    }}
                    className={`branch-card ${isActive ? 'active' : ''}`}
                    style={{
                      cursor: biz.id === '0' ? 'default' : 'pointer',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="branch-name">{biz.name}</div>
                      <div className="branch-address">{biz.address}</div>
                    </div>
                    {isActive && <span className="active-label">ACTIVE</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
