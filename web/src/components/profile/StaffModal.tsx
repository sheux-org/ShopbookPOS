'use client';

import React from 'react';
import { UserPlus, Pencil, Trash2, Users } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { SideDrawer } from '../common/SideDrawer';

interface DBEmployee {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier';
  phone: string;
  email?: string;
}

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: DBEmployee[];
  newStaffName: string;
  setNewStaffName: (val: string) => void;
  newStaffPhone: string;
  setNewStaffPhone: (val: string) => void;
  newStaffRole: 'admin' | 'manager' | 'cashier';
  setNewStaffRole: (val: 'admin' | 'manager' | 'cashier') => void;
  onSubmit: (e: React.FormEvent) => void;
  editingStaff: DBEmployee | null;
  onEdit: (emp: DBEmployee) => void;
  onDelete: (id: string) => void;
  onCancelEdit: () => void;
}

export const StaffModal: React.FC<StaffModalProps> = ({
  isOpen,
  onClose,
  employees,
  newStaffName,
  setNewStaffName,
  newStaffPhone,
  setNewStaffPhone,
  newStaffRole,
  setNewStaffRole,
  onSubmit,
  editingStaff,
  onEdit,
  onDelete,
  onCancelEdit,
}) => {
  const { t } = useTranslation();

  const drawerFooter = (
    <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end' }}>
      <button
        type="button"
        onClick={() => {
          if (editingStaff) onCancelEdit();
          onClose();
        }}
        className="action-btn-secondary"
      >
        {t('common.cancel')}
      </button>
      <button
        type="submit"
        form="staff-manage-form"
        className="modal-submit-btn"
        style={{ margin: 0, width: 'auto' }}
      >
        {editingStaff ? (
          <>
            <Pencil size={14} />
            <span>Update Details</span>
          </>
        ) : (
          <>
            <UserPlus size={16} />
            <span>Onboard Member</span>
          </>
        )}
      </button>
    </div>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('staff.headerTitle')}
      subtitle="Manage authorized staff, assigned roles, and terminal permissions"
      icon={<Users size={20} />}
      footer={drawerFooter}
      maxWidth="560px"
    >
      {/* 1. Active Store Personnel List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h4 className="form-title" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Active Store Personnel</span>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 'normal' }}>
            {employees.length} members
          </span>
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {employees.map((emp) => {
            const isOwner = emp.name.toLowerCase() === 'owner / admin';
            return (
              <div
                key={emp.id}
                className="staff-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  backgroundColor: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--dark)' }}>
                      {emp.name}
                    </span>
                    <span className={`role-badge role-${emp.role}`}>
                      {emp.role.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    📞 {emp.phone}
                  </div>
                </div>
                {!isOwner && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => onEdit(emp)}
                      className="staff-action-btn edit"
                      title="Edit Staff Details"
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Pencil size={14} color="var(--primary)" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(emp.id)}
                      className="staff-action-btn delete"
                      title="Remove Staff Member"
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        border: '1px solid #fee2e2',
                        background: '#fef2f2',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={14} color="var(--error)" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '8px 0' }} />

      {/* 2. Onboard / Edit Staff Member Form */}
      <form
        id="staff-manage-form"
        onSubmit={onSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 className="form-title" style={{ margin: 0 }}>
            {editingStaff ? 'Modify Staff Details' : 'Onboard Staff Member'}
          </h4>
          {editingStaff && (
            <button
              type="button"
              onClick={onCancelEdit}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              + Add new member instead
            </button>
          )}
        </div>

        <div className="modal-input-group">
          <label className="modal-label">Full Name</label>
          <input
            type="text"
            placeholder="e.g. Ruwan Silva"
            value={newStaffName}
            onChange={(e) => setNewStaffName(e.target.value)}
            required
            className="modal-input"
          />
        </div>

        <div className="modal-input-group">
          <label className="modal-label">Phone number</label>
          <input
            type="tel"
            placeholder="e.g. +94 77 123 4567"
            value={newStaffPhone}
            onChange={(e) => setNewStaffPhone(e.target.value)}
            required
            className="modal-input"
          />
        </div>

        <div className="modal-input-group">
          <label className="modal-label">Role Rank</label>
          <select
            value={newStaffRole}
            onChange={(e: any) => {
              const val = e.target.value;
              const isOwner = editingStaff?.name.toLowerCase() === 'owner / admin';
              if (isOwner && val !== 'admin') {
                alert('Owner / Admin role cannot be demoted.');
                return;
              }
              setNewStaffRole(val);
            }}
            className="modal-select"
          >
            <option value="cashier">Cashier (Billing ONLY)</option>
            <option value="manager">Manager (Stock adjustment)</option>
            <option value="admin">Administrator (Full Access)</option>
          </select>
        </div>
      </form>
    </SideDrawer>
  );
};
