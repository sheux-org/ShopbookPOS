'use client';

import React from 'react';
import { X, PlusCircle } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h3>Multi-Branch & Locations Portal</h3>
          <button onClick={onClose} className="modal-close-btn"><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ flexDirection: 'row', gap: '24px' }}>
          <form onSubmit={onSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 className="form-title">Initialize New Branch Location</h4>
            
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
                <option value="Restaurant / Cafe">Restaurant / Cafe</option>
                <option value="General Retail">General Retail</option>
                <option value="Grocery Store">Grocery Store</option>
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
              <span>Onboard location</span>
            </button>
          </form>

          <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 className="form-title">Registered branches ({businesses.length})</h4>
            <div className="branch-scroller">
              {businesses.map(biz => {
                const isActive = biz.id === activeBusiness?.id;
                return (
                  <div 
                    key={biz.id} 
                    onClick={() => {
                      if (biz.id === '0') return;
                      setActiveBusiness(biz.id);
                      triggerToast(`Switched active branch to ${biz.name}! 🏬`);
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
