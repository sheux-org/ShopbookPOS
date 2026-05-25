'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore, Business } from '../../stores/businessStore';
import database from '../../db/database';
import { Q } from '@nozbe/watermelondb';
import { useSettingsStore } from '../../stores/settingsStore';
import { syncDatabase } from '../../services/sync';
import { 
  User, Store, Users, Cloud, RefreshCw, LogOut, 
  HelpCircle, CheckCircle, ChevronRight, X, UserPlus, MapPin, Save,
  PlusCircle
} from 'lucide-react';

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
      const bizRecords = await database.get('businesses').query(Q.where('name', activeBiz.name)).fetch();
      if (bizRecords.length > 0) {
        const emps = await database.get('employees').query(Q.where('business_id', bizRecords[0].id)).fetch() as any[];
        setEmployees(emps.map(e => ({
          id: e.id,
          name: e.name,
          role: e.role,
          phone: e.phone,
          email: e.email
        })));
      }
    } catch (err) {
      console.error("Failed to load staff list:", err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadEmployees();
      // Initialize edit forms
      setEditName(activeBusiness?.name || '');
      setEditCategory(activeBusiness?.category || '');
      setEditAddress(activeBusiness?.address || '');
      setEditPhone(activeBusiness?.phone || '');
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
        const bizs = await database.get('businesses').query(Q.where('name', activeBiz.name)).fetch();
        if (bizs.length > 0) {
          await database.get('employees').create((emp: any) => {
            emp.business.set(bizs[0]);
            emp.name = newStaffName;
            emp.role = newStaffRole;
            emp.phone = newStaffPhone;
          });
        }
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
    <div style={styles.container} className="fade-in">
      {/* Toast popup */}
      {toastMsg && (
        <div style={styles.toast}>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.headerTitle}>Profile Settings Dashboard</h2>
          <p style={styles.headerSubtitle}>Configure branches, staff logs, backups and terminal details</p>
        </div>
      </div>

      {/* Workspace Settings Content */}
      <div style={styles.body}>
        {/* Profile Card Summary */}
        <div style={styles.profileSummary}>
          <div style={styles.avatar}>
            {activeBusiness?.name?.substring(0, 2).toUpperCase() || 'SP'}
          </div>
          <h3 style={styles.bizName}>{activeBusiness?.name || 'Partner Store'}</h3>
          <span style={styles.tagline}>🛡️ {userRole.toUpperCase()} · TERMINAL POS ACTIVE</span>
        </div>

        {/* Option rows list */}
        <div style={styles.optionsList}>
          {/* Option: Store details */}
          <div style={styles.optionRow} onClick={() => setActiveModal('details')}>
            <div style={{ ...styles.iconBox, backgroundColor: '#EFF6FF', color: 'var(--primary)' }}>
              <Store size={18} />
            </div>
            <div style={styles.optionDetails}>
              <h4 style={styles.optionTitle}>Store Details</h4>
              <p style={styles.optionSub}>Manage receipt addresses, branch phone details, categories</p>
            </div>
            <ChevronRight size={16} color="var(--muted)" />
          </div>

          {/* Option: Switch branches */}
          <div style={styles.optionRow} onClick={() => setActiveModal('branches')}>
            <div style={{ ...styles.iconBox, backgroundColor: '#FEF7E0', color: '#B06000' }}>
              <MapPin size={18} />
            </div>
            <div style={styles.optionDetails}>
              <h4 style={styles.optionTitle}>Branches Management</h4>
              <p style={styles.optionSub}>Registered locations: {businesses.length} · Create & switch branches</p>
            </div>
            <ChevronRight size={16} color="var(--muted)" />
          </div>

          {/* Option: Staff Management */}
          {userRole === 'admin' && (
            <div style={styles.optionRow} onClick={() => setActiveModal('staff')}>
              <div style={{ ...styles.iconBox, backgroundColor: '#E6F4EA', color: '#137333' }}>
                <Users size={18} />
              </div>
              <div style={styles.optionDetails}>
                <h4 style={styles.optionTitle}>Staff Accounts Management</h4>
                <p style={styles.optionSub}>Onboard cashier terminals, manage admins and managers</p>
              </div>
              <ChevronRight size={16} color="var(--muted)" />
            </div>
          )}

          {/* Option: Auto cloud backup toggle */}
          <div style={styles.optionRow}>
            <div style={{ ...styles.iconBox, backgroundColor: '#EFF6FF', color: 'var(--primary)' }}>
              <Cloud size={18} />
            </div>
            <div style={styles.optionDetails}>
              <h4 style={styles.optionTitle}>Auto Backup to Cloud</h4>
              <p style={styles.optionSub}>{isBackupEnabled ? 'Real-time IndexedDB sync to Supabase is active' : 'Enable backup parameters'}</p>
            </div>
            <button 
              onClick={toggleBackup}
              style={{
                ...styles.switchBtn,
                backgroundColor: isBackupEnabled ? 'var(--primary)' : '#d1d5db',
              }}
            >
              <div style={{
                ...styles.switchThumb,
                transform: isBackupEnabled ? 'translateX(20px)' : 'translateX(0)',
              }} />
            </button>
          </div>

          {/* Option: Manual Sync */}
          {isBackupEnabled && (
            <div style={styles.optionRow} onClick={handleManualSync}>
              <div style={{ ...styles.iconBox, backgroundColor: '#E6F4EA', color: '#137333' }}>
                <RefreshCw size={18} />
              </div>
              <div style={styles.optionDetails}>
                <h4 style={styles.optionTitle}>Sync Database Now</h4>
                <p style={styles.optionSub}>Manually synchronize offline sales ledger to Supabase database</p>
              </div>
              <ChevronRight size={16} color="var(--muted)" />
            </div>
          )}

          {/* Option: Support FAQs */}
          <div style={styles.optionRow} onClick={() => setActiveModal('faq')}>
            <div style={{ ...styles.iconBox, backgroundColor: '#f3f4f6', color: 'var(--dark)' }}>
              <HelpCircle size={18} />
            </div>
            <div style={styles.optionDetails}>
              <h4 style={styles.optionTitle}>Help FAQ & Support Details</h4>
              <p style={styles.optionSub}>Terminals onboarding queries, printer connectivity guidelines</p>
            </div>
            <ChevronRight size={16} color="var(--muted)" />
          </div>

          {/* Option: Log out */}
          <div 
            style={{ ...styles.optionRow, borderBottom: 'none' }}
            onClick={() => {
              if (confirm('Disconnect POS terminal?')) {
                logout();
                router.push('/auth');
              }
            }}
          >
            <div style={{ ...styles.iconBox, backgroundColor: '#FFF1F2', color: 'var(--error)' }}>
              <LogOut size={18} />
            </div>
            <div style={styles.optionDetails}>
              <h4 style={{ ...styles.optionTitle, color: 'var(--error)' }}>Sign Out Session</h4>
              <p style={styles.optionSub}>Saves and disconnects terminal session profile</p>
            </div>
            <ChevronRight size={16} color="var(--muted)" />
          </div>
        </div>
      </div>

      {/* Modal overlays */}
      
      {/* 1. Store details modal */}
      {activeModal === 'details' && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>Update Store Details</h3>
              <button onClick={() => setActiveModal(null)} style={styles.modalCloseBtn}><X size={16} /></button>
            </div>
            <form onSubmit={handleStoreDetailsSubmit} style={styles.modalBody}>
              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Business / Brand Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  style={styles.modalInput}
                />
              </div>

              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Store Category</label>
                <input 
                  type="text" 
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  required
                  style={styles.modalInput}
                />
              </div>

              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Billing Address</label>
                <input 
                  type="text" 
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  required
                  style={styles.modalInput}
                />
              </div>

              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Receipt Phone Number</label>
                <input 
                  type="text" 
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  required
                  style={styles.modalInput}
                />
              </div>

              <button type="submit" style={styles.modalSubmitBtn}>
                <Save size={16} />
                <span>Save receipt details</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Staff Management modal */}
      {activeModal === 'staff' && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '680px' }}>
            <div style={styles.modalHeader}>
              <h3>Staff Management Portal</h3>
              <button onClick={() => setActiveModal(null)} style={styles.modalCloseBtn}><X size={16} /></button>
            </div>
            <div style={{ ...styles.modalBody, flexDirection: 'row', gap: '24px' }}>
              {/* Form Add Staff */}
              <form onSubmit={handleAddStaffSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={styles.formTitle}>Onboard Staff Member</h4>
                
                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Full Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Ruwan Silva" 
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    required
                    style={styles.modalInput}
                  />
                </div>

                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Phone number</label>
                  <input 
                    type="tel" 
                    placeholder="e.g. +94 77 123 4567" 
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    required
                    style={styles.modalInput}
                  />
                </div>

                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Role Rank</label>
                  <select 
                    value={newStaffRole}
                    onChange={(e: any) => setNewStaffRole(e.target.value)}
                    style={styles.select}
                  >
                    <option value="cashier">Cashier (Billing ONLY)</option>
                    <option value="manager">Manager (Stock adjustment)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>

                <button type="submit" style={styles.modalSubmitBtn}>
                  <UserPlus size={16} />
                  <span>Onboard member</span>
                </button>
              </form>

              {/* Staff logs list */}
              <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={styles.formTitle}>Active Store Personnel ({employees.length})</h4>
                <div style={styles.staffScroller}>
                  {employees.map(emp => (
                    <div key={emp.id} style={styles.staffCard}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{emp.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{emp.phone}</div>
                      </div>
                      <span style={{
                        ...styles.roleBadge,
                        backgroundColor: emp.role === 'admin' ? '#FEE2E2' : emp.role === 'manager' ? '#FFEDD5' : '#E6F4EA',
                        color: emp.role === 'admin' ? '#DC2626' : emp.role === 'manager' ? '#D97706' : '#137333',
                      }}>
                        {emp.role.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Branch Management modal */}
      {activeModal === 'branches' && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '680px' }}>
            <div style={styles.modalHeader}>
              <h3>Multi-Branch & Locations Portal</h3>
              <button onClick={() => setActiveModal(null)} style={styles.modalCloseBtn}><X size={16} /></button>
            </div>
            <div style={{ ...styles.modalBody, flexDirection: 'row', gap: '24px' }}>
              {/* Form Add Branch */}
              <form onSubmit={handleAddBranchSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={styles.formTitle}>Initialize New Branch Location</h4>
                
                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Branch Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Shopbook POS - Kandy Branch" 
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    required
                    style={styles.modalInput}
                  />
                </div>

                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Business Type</label>
                  <select 
                    value={newBranchCategory}
                    onChange={(e) => setNewBranchCategory(e.target.value)}
                    style={styles.select}
                  >
                    <option value="Restaurant / Cafe">Restaurant / Cafe</option>
                    <option value="General Retail">General Retail</option>
                    <option value="Grocery Store">Grocery Store</option>
                  </select>
                </div>

                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Physical Address</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 50 Temple Road, Kandy" 
                    value={newBranchAddress}
                    onChange={(e) => setNewBranchAddress(e.target.value)}
                    required
                    style={styles.modalInput}
                  />
                </div>

                <button type="submit" style={styles.modalSubmitBtn}>
                  <PlusCircle size={16} />
                  <span>Onboard location</span>
                </button>
              </form>

              {/* Branch switcher list */}
              <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={styles.formTitle}>Registered branches ({businesses.length})</h4>
                <div style={styles.branchScroller}>
                  {businesses.map(biz => {
                    const isActive = biz.id === activeBusiness.id;
                    return (
                      <div 
                        key={biz.id} 
                        onClick={() => {
                          if (biz.id === '0') return;
                          setActiveBusiness(biz.id);
                          triggerToast(`Switched active branch to ${biz.name}! 🏬`);
                          setActiveModal(null);
                        }}
                        style={{
                          ...styles.branchCard,
                          borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                          backgroundColor: isActive ? 'var(--light-blue)' : '#ffffff',
                          cursor: biz.id === '0' ? 'default' : 'pointer',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', color: isActive ? 'var(--primary)' : 'var(--dark)' }}>{biz.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{biz.address}</div>
                        </div>
                        {isActive && <span style={styles.activeLabel}>ACTIVE</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Support FAQ modal */}
      {activeModal === 'faq' && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '520px' }}>
            <div style={styles.modalHeader}>
              <h3>Help & Support FAQs</h3>
              <button onClick={() => setActiveModal(null)} style={styles.modalCloseBtn}><X size={16} /></button>
            </div>
            <div style={{ ...styles.modalBody, maxHeight: '420px', overflowY: 'auto' }}>
              <div style={styles.faqBlock}>
                <h4>🔌 How do I connect to thermal printers?</h4>
                <p>On the web terminal, printer support is handled via the native browser Print dialog. You can print invoices directly to standard thermal roll printers (58mm/80mm) connected via USB or Wifi. Make sure to adjust margins to 'None' inside the browser print settings.</p>
              </div>
              <div style={styles.faqBlock}>
                <h4>📦 How do I manage low stock alert triggers?</h4>
                <p>Inside the Stocks Management workspace page, edit any product details to configure the low stock unit alerts. Alerts trigger visual highlights inside both stock lists and billing catalog cards.</p>
              </div>
              <div style={styles.faqBlock}>
                <h4>☁️ How does database backup sync operate?</h4>
                <p>The Pro web client saves all catalog adjustments, staff settings, and billing logs inside IndexedDB locally. Enabling backup sync syncs offline operations automatically to Supabase. Manual backups can be triggered in Profile settings or the sidebar panel.</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  toast: {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--success)',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '30px',
    fontWeight: 'bold',
    fontSize: '13px',
    zIndex: 99999,
    boxShadow: '0 10px 20px rgba(22, 163, 74, 0.25)',
  },
  header: {
    padding: '24px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: 'var(--dark)',
  },
  headerSubtitle: {
    fontSize: '12px',
    color: 'var(--muted)',
    marginTop: '2px',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  profileSummary: {
    width: '100%',
    maxWidth: '560px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    boxShadow: 'var(--shadow)',
  },
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: '32px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '20px',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
  },
  bizName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  tagline: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#137333',
    backgroundColor: '#e6f4ea',
    padding: '3px 8px',
    borderRadius: '12px',
  },
  optionsList: {
    width: '100%',
    maxWidth: '560px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  iconBox: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionDetails: {
    flex: 1,
  },
  optionTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  optionSub: {
    fontSize: '11px',
    color: 'var(--muted)',
    marginTop: '3px',
  },
  switchBtn: {
    width: '42px',
    height: '22px',
    borderRadius: '11px',
    padding: '2px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'background-color 0.2s ease',
  },
  switchThumb: {
    width: '18px',
    height: '18px',
    borderRadius: '9px',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s ease',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(3px)',
  },
  modalContent: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
  },
  modalBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  modalLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--dark)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--background)',
  },
  modalSubmitBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '6px',
  },
  formTitle: {
    fontSize: '13px',
    fontWeight: '800',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '6px',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--background)',
    cursor: 'pointer',
  },
  staffScroller: {
    maxHeight: '260px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  staffCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--background)',
  },
  roleBadge: {
    fontSize: '9px',
    fontWeight: '800',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  branchScroller: {
    maxHeight: '260px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  branchCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    transition: 'all 0.2s ease',
  },
  activeLabel: {
    fontSize: '8px',
    fontWeight: '800',
    backgroundColor: 'var(--success)',
    color: '#ffffff',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  faqBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingBottom: '12px',
    borderBottom: '1px dashed var(--border)',
  },
  PlusCircle: {
    cursor: 'pointer',
  },
};
