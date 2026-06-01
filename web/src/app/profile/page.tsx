'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import database from '../../db/database';
import { Q } from '@nozbe/watermelondb';
import { useSettingsStore } from '../../stores/settingsStore';
import { syncDatabase } from '../../services/sync';
import { 
  User, Store, Users, Cloud, RefreshCw, LogOut, 
  HelpCircle, CheckCircle, ChevronRight, MapPin, Phone, Database
} from 'lucide-react';
import './profile.css';

import { StoreDetailsModal } from '../../components/profile/StoreDetailsModal';
import { StaffModal } from '../../components/profile/StaffModal';
import { BranchModal } from '../../components/profile/BranchModal';
import { FaqModal } from '../../components/profile/FaqModal';

interface DBEmployee {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier';
  phone: string;
  email?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const employeeName = useAuthStore((s) => s.employeeName);
  const userRole = useAuthStore((s) => s.userRole);
  const logout = useAuthStore((s) => s.logout);
  const userPhone = useAuthStore((s) => s.userPhone);
  
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const businesses = useBusinessStore((s) => s.businesses);
  const setActiveBusiness = useBusinessStore((s) => s.setActiveBusiness);
  const loadBusinesses = useBusinessStore((s) => s.loadBusinessesFromDb);
  const registerBusiness = useBusinessStore((s) => s.registerBusiness);
  const updateActiveBusinessDetails = useBusinessStore((s) => s.updateActiveBusinessDetails);

  const isBackupEnabled = useSettingsStore((s) => s.isBackupEnabled);
  const toggleBackup = useSettingsStore((s) => s.toggleBackup);

  // States
  const [employees, setEmployees] = useState<DBEmployee[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState<'details' | 'staff' | 'branches' | 'faq' | null>(null);

  // Form states - Store details
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Form states - Staff add
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'admin' | 'manager' | 'cashier'>('cashier');
  const [newStaffPhone, setNewStaffPhone] = useState('');

  // Form states - Branch add
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCategory, setNewBranchCategory] = useState('General Retail');
  const [newBranchAddress, setNewBranchAddress] = useState('');

  // Load Employees list from IndexedDB
  const loadEmployees = async () => {
    if (typeof window === 'undefined') return;
    try {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      if (!activeBiz || activeBiz.id === '0') return;
      const emps = await database.get('employees').query(Q.where('business_id', activeBiz.id)).fetch() as any[];
      setEmployees(emps.map(e => ({
        id: e.id,
        name: e.name,
        role: e.role,
        phone: e.phone,
        email: e.email
      })));
    } catch (err) {
      console.error("Failed to load staff list:", err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadBusinesses().then(() => {
        loadEmployees();
      });
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && activeBusiness) {
      setEditName(activeBusiness.name || '');
      setEditCategory(activeBusiness.category || '');
      setEditAddress(activeBusiness.address || '');
      setEditPhone(activeBusiness.phone || '');
    }
  }, [isLoggedIn, activeBusiness]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

  const handleStoreDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateActiveBusinessDetails({
        name: editName,
        category: editCategory,
        address: editAddress,
        phone: editPhone
      });
      await loadBusinesses();
      triggerToast('Store details updated! 🏬');
      setActiveModal(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffPhone) return;

    try {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      await database.write(async () => {
        const biz = await database.get('businesses').find(activeBiz.id);
        await database.get('employees').create((emp: any) => {
          emp.business.set(biz);
          emp.name = newStaffName;
          emp.role = newStaffRole;
          emp.phone = newStaffPhone;
        });
      });

      triggerToast(`Staff ${newStaffName} registered successfully! 👥`);
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffRole('cashier');
      loadEmployees();
    } catch (err) {
      console.error("Failed to register staff:", err);
    }
  };

  const handleAddBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName || !newBranchAddress) return;

    try {
      await registerBusiness(newBranchName, newBranchAddress, userPhone || activeBusiness.phone, newBranchCategory);
      await loadBusinesses();
      triggerToast(`Branch ${newBranchName} initialized! 🏢`);
      setNewBranchName('');
      setNewBranchAddress('');
      setActiveModal(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      triggerToast('Syncing database... 🔄');
      const success = await syncDatabase();
      if (success) {
        triggerToast('IndexedDB database synced successfully! ✅');
      } else {
        alert('Sync failed. Please ensure the Supabase configuration parameters inside web/.env.local are correct.');
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="profile-container fade-in">
      {/* Toast popup */}
      {toastMsg && (
        <div className="profile-toast">
          <CheckCircle size={16} color="#FFFFFF" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Two-Column SaaS Dashboard Layout */}
      <div className="profile-dashboard-grid">
        
        {/* Left Column: Premium Summary & Status Card */}
        <div className="profile-left-column">
          <div className="profile-card">
            <div className="profile-avatar">
              {activeBusiness?.name?.substring(0, 2).toUpperCase() || 'SP'}
            </div>
            <h3 className="profile-biz-name">{activeBusiness?.name || 'Partner Store'}</h3>
            <span className={`profile-role-badge role-${userRole}`}>
              {userRole.toUpperCase()}
            </span>
            <p className="profile-category-pill">{activeBusiness?.category || 'General POS Retail'}</p>
          </div>

          {/* System status metadata */}
          <div className="profile-meta-card">
            <h4 className="profile-meta-card-title">Terminal System Details</h4>
            
            <div className="profile-meta-item">
              <User size={14} color="var(--muted)" />
              <div className="profile-meta-info">
                <span className="profile-meta-label">Operator Name</span>
                <span className="profile-meta-val">{employeeName}</span>
              </div>
            </div>

            <div className="profile-meta-item">
              <Phone size={14} color="var(--muted)" />
              <div className="profile-meta-info">
                <span className="profile-meta-label">Phone Credentials</span>
                <span className="profile-meta-val">{userPhone || 'Not Configured'}</span>
              </div>
            </div>

            <div className="profile-meta-item">
              <Database size={14} color="var(--muted)" />
              <div className="profile-meta-info">
                <span className="profile-meta-label">Local Database</span>
                <span className="profile-meta-val">WatermelonDB (Active)</span>
              </div>
            </div>

            <div className="profile-meta-item">
              <Cloud size={14} color="var(--muted)" />
              <div className="profile-meta-info">
                <span className="profile-meta-label">Supabase Sync</span>
                <span className="profile-meta-val" style={{ color: isBackupEnabled ? 'var(--success)' : 'var(--muted)' }}>
                  {isBackupEnabled ? 'Enabled (Online)' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: SaaS Profile Options list */}
        <div className="profile-right-column">
          <h3 className="profile-section-header">Terminal Operations Settings</h3>

          <div className="profile-options-grid">
            {/* Option: Store details */}
            <div className="profile-option-card" onClick={() => setActiveModal('details')}>
              <div className="profile-icon-box" style={{ backgroundColor: '#eff6ff', color: 'var(--primary)' }}>
                <Store size={20} />
              </div>
              <div className="profile-option-details">
                <h4 className="profile-option-title">Store Profile Details</h4>
                <p className="profile-option-sub">Manage receipt layouts, address, phone details and categories.</p>
              </div>
              <ChevronRight size={18} color="var(--muted)" />
            </div>

            {/* Option: Switch branches */}
            <div className="profile-option-card" onClick={() => setActiveModal('branches')}>
              <div className="profile-icon-box" style={{ backgroundColor: '#fef7e0', color: '#b06000' }}>
                <MapPin size={20} />
              </div>
              <div className="profile-option-details">
                <h4 className="profile-option-title">Locations & Branches</h4>
                <p className="profile-option-sub">Registered locations: {businesses.length} · Initialize and swap active terminals.</p>
              </div>
              <ChevronRight size={18} color="var(--muted)" />
            </div>

            {/* Option: Staff Management */}
            {userRole === 'admin' && (
              <div className="profile-option-card" onClick={() => setActiveModal('staff')}>
                <div className="profile-icon-box" style={{ backgroundColor: '#e6f4ea', color: '#137333' }}>
                  <Users size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">Staff Accounts Management</h4>
                  <p className="profile-option-sub">Onboard cashmere cashiers, managers, and administrative access ranks.</p>
                </div>
                <ChevronRight size={18} color="var(--muted)" />
              </div>
            )}

            {/* Option: Auto cloud backup toggle */}
            <div className="profile-option-card">
              <div className="profile-icon-box" style={{ backgroundColor: '#eff6ff', color: 'var(--primary)' }}>
                <Cloud size={20} />
              </div>
              <div className="profile-option-details">
                <h4 className="profile-option-title">Real-time Cloud Backups</h4>
                <p className="profile-option-sub">Continuously replicate transaction logs and ledger data to cloud databases.</p>
              </div>
              <button 
                onClick={toggleBackup}
                className="profile-switch-btn"
                style={{
                  backgroundColor: isBackupEnabled ? 'var(--primary)' : '#d1d5db',
                }}
              >
                <div 
                  className="profile-switch-thumb"
                  style={{
                    transform: isBackupEnabled ? 'translateX(20px)' : 'translateX(0)',
                  }} 
                />
              </button>
            </div>

            {/* Option: Manual Sync */}
            {isBackupEnabled && (
              <div className="profile-option-card" onClick={handleManualSync}>
                <div className="profile-icon-box" style={{ backgroundColor: '#e6f4ea', color: '#137333' }}>
                  <RefreshCw size={20} className={syncing ? 'spin-anim' : ''} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">Force Database Sync</h4>
                  <p className="profile-option-sub">Manually push latest offline transaction queue to remote clusters.</p>
                </div>
                <ChevronRight size={18} color="var(--muted)" />
              </div>
            )}

            {/* Option: Support FAQs */}
            <div className="profile-option-card" onClick={() => setActiveModal('faq')}>
              <div className="profile-icon-box" style={{ backgroundColor: '#f3f4f6', color: 'var(--dark)' }}>
                <HelpCircle size={20} />
              </div>
              <div className="profile-option-details">
                <h4 className="profile-option-title">Help FAQ & Printing Manual</h4>
                <p className="profile-option-sub">Audit guidelines, print configuration, and offline-first database setup.</p>
              </div>
              <ChevronRight size={18} color="var(--muted)" />
            </div>

            {/* Option: Log out */}
            <div 
              className="profile-option-card"
              onClick={() => {
                if (confirm('Disconnect POS terminal session?')) {
                  logout();
                  router.push('/auth');
                }
              }}
            >
              <div className="profile-icon-box" style={{ backgroundColor: '#fff1f2', color: 'var(--error)' }}>
                <LogOut size={20} />
              </div>
              <div className="profile-option-details">
                <h4 className="profile-option-title" style={{ color: 'var(--error)' }}>Sign Out Session</h4>
                <p className="profile-option-sub">Safely commit local storage states and disconnect current terminal access.</p>
              </div>
              <ChevronRight size={18} color="var(--muted)" />
            </div>
          </div>
        </div>
      </div>

      {/* Modal overlays */}
      <StoreDetailsModal
        isOpen={activeModal === 'details'}
        onClose={() => setActiveModal(null)}
        editName={editName}
        setEditName={setEditName}
        editCategory={editCategory}
        setEditCategory={setEditCategory}
        editAddress={editAddress}
        setEditAddress={setEditAddress}
        editPhone={editPhone}
        setEditPhone={setEditPhone}
        onSubmit={handleStoreDetailsSubmit}
      />

      <StaffModal
        isOpen={activeModal === 'staff'}
        onClose={() => setActiveModal(null)}
        employees={employees}
        newStaffName={newStaffName}
        setNewStaffName={setNewStaffName}
        newStaffPhone={newStaffPhone}
        setNewStaffPhone={setNewStaffPhone}
        newStaffRole={newStaffRole}
        setNewStaffRole={setNewStaffRole}
        onSubmit={handleAddStaffSubmit}
      />

      <BranchModal
        isOpen={activeModal === 'branches'}
        onClose={() => setActiveModal(null)}
        businesses={businesses}
        activeBusiness={activeBusiness}
        setActiveBusiness={setActiveBusiness}
        newBranchName={newBranchName}
        setNewBranchName={setNewBranchName}
        newBranchCategory={newBranchCategory}
        setNewBranchCategory={setNewBranchCategory}
        newBranchAddress={newBranchAddress}
        setNewBranchAddress={setNewBranchAddress}
        onSubmit={handleAddBranchSubmit}
        triggerToast={triggerToast}
      />

      <FaqModal
        isOpen={activeModal === 'faq'}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
}
