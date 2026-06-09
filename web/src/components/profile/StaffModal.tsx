'use client';

import React from 'react';
import { X, UserPlus, Pencil, Trash2 } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h3>Staff Management Portal</h3>
          <button onClick={onClose} className="modal-close-btn">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ flexDirection: 'row', gap: '24px' }}>
          <form
            onSubmit={onSubmit}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <h4 className="form-title">
              {editingStaff ? 'Modify Staff Details' : 'Onboard Staff Member'}
            </h4>

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
                  const isOwner =
                    editingStaff?.role === 'admin' ||
                    editingStaff?.name.toLowerCase() === 'owner / admin';
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

            {editingStaff ? (
              <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '10px' }}>
                <button
                  type="submit"
                  className="modal-submit-btn"
                  style={{ marginTop: 0, flex: 1 }}
                >
                  <Pencil size={14} />
                  <span>Update details</span>
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="modal-cancel-btn"
                  style={{ marginTop: 0, flex: 1 }}
                >
                  <span>Cancel</span>
                </button>
              </div>
            ) : (
              <button type="submit" className="modal-submit-btn">
                <UserPlus size={16} />
                <span>Onboard member</span>
              </button>
            )}
          </form>

          <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 className="form-title">Active Store Personnel ({employees.length})</h4>
            <div className="staff-scroller">
              {employees.map((emp) => {
                const isOwner = emp.role === 'admin' || emp.name.toLowerCase() === 'owner / admin';
                return (
                  <div key={emp.id} className="staff-card">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{emp.name}</span>
                        <span className={`role-badge role-${emp.role}`}>
                          {emp.role.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                        📞 {emp.phone}
                      </div>
                    </div>
                    {!isOwner && (
                      <div className="staff-card-actions">
                        <button
                          type="button"
                          onClick={() => onEdit(emp)}
                          className="staff-action-btn edit"
                          title="Edit Staff Details"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(emp.id)}
                          className="staff-action-btn delete"
                          title="Remove Staff Member"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
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
