'use client';

import React from 'react';
import { PlusCircle, Lock, Building2, CheckCircle2 } from 'lucide-react';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useTranslation } from '../../hooks/useTranslation';
import { SideDrawer } from '../common/SideDrawer';

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
  const { t } = useTranslation();
  const canCreate = canPerform('create', 'settings');

  const drawerFooter = (
    <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end' }}>
      <button
        type="button"
        onClick={onClose}
        className="action-btn-secondary"
      >
        {t('common.cancel')}
      </button>
      {canCreate && (
        <button
          type="submit"
          form="branch-onboard-form"
          className="modal-submit-btn"
          style={{ margin: 0, width: 'auto' }}
        >
          <PlusCircle size={16} />
          <span>Onboard Location</span>
        </button>
      )}
    </div>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('businessMgmt.headerTitle')}
      subtitle="Switch active branch context or register a new business branch"
      icon={<Building2 size={20} />}
      footer={drawerFooter}
      maxWidth="560px"
    >
      {/* 1. Branch Switcher List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h4 className="form-title" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Registered Branches</span>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 'normal' }}>
            {businesses.length} locations
          </span>
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--dark)' }}>
                    {biz.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    {biz.address || 'No physical address configured'}
                  </div>
                </div>
                {isActive && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontWeight: '700', fontSize: '11px' }}>
                    <CheckCircle2 size={16} />
                    <span>ACTIVE</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '8px 0' }} />

      {/* 2. Onboard New Branch Form */}
      {canCreate ? (
        <form
          id="branch-onboard-form"
          onSubmit={onSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <h4 className="form-title" style={{ margin: 0 }}>{t('businessMgmt.createNew')}</h4>

          <div className="modal-input-group">
            <label className="modal-label">{t('businessMgmt.bizNameLabel')}</label>
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
        </form>
      ) : (
        <div
          style={{
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
    </SideDrawer>
  );
};
