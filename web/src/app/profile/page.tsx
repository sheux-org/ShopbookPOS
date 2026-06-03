'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { syncDatabase, uploadBusinessLogo } from '../../services/sync';
import { 
  User, Store, Users, RefreshCw, LogOut, 
  HelpCircle, CheckCircle, ChevronRight, MapPin, Phone, Database,
  Shield, Activity, HardDrive, Settings, Info, Building, Camera
} from 'lucide-react';
import './profile.css';
import { TerminalDiagnostics } from '../../components/TerminalDiagnostics';

import { StoreDetailsModal } from '../../components/profile/StoreDetailsModal';
import { StaffModal } from '../../components/profile/StaffModal';
import { BranchModal } from '../../components/profile/BranchModal';
import { FaqModal } from '../../components/profile/FaqModal';
import { HelpSupportModal } from '../../components/profile/HelpSupportModal';
import { useStaff, useCreateStaff } from '../../hooks/useStaff';
import { useUserPermissions } from '../../hooks/useUserPermissions';

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
  const { canPerform } = useUserPermissions();
  
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const businesses = useBusinessStore((s) => s.businesses);
  const setActiveBusiness = useBusinessStore((s) => s.setActiveBusiness);
  const loadBusinesses = useBusinessStore((s) => s.loadBusinessesFromDb);
  const registerBusiness = useBusinessStore((s) => s.registerBusiness);
  const updateActiveBusinessDetails = useBusinessStore((s) => s.updateActiveBusinessDetails);
  const updateBusinessDetails = useBusinessStore((s) => s.updateBusinessDetails);



  // States
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState<'details' | 'staff' | 'branches' | 'faq' | null>(null);

  // Form states - Store details
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLogoUri, setEditLogoUri] = useState('');
  const [newBranchLogo, setNewBranchLogo] = useState<File | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form states - Staff add
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'admin' | 'manager' | 'cashier'>('cashier');
  const [newStaffPhone, setNewStaffPhone] = useState('');

  // Form states - Branch add
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCategory, setNewBranchCategory] = useState('General Retail');
  const [newBranchAddress, setNewBranchAddress] = useState('');

  // React Query Hooks
  const { data: staffList = [] } = useStaff(activeBusiness?.id || '0');
  const createStaffMutation = useCreateStaff(activeBusiness?.id || '0');

  const employees: DBEmployee[] = staffList.map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role.toLowerCase() as 'admin' | 'manager' | 'cashier',
    phone: e.phone,
    email: e.email,
  }));

  useEffect(() => {
    if (isLoggedIn) {
      loadBusinesses();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && activeBusiness) {
      setEditName(activeBusiness.name || '');
      setEditCategory(activeBusiness.category || '');
      setEditAddress(activeBusiness.address || '');
      setEditPhone(activeBusiness.phone || '');
      setEditLogoUri(activeBusiness.logoUri || '');
    }
  }, [isLoggedIn, activeBusiness]);

  useEffect(() => {
    const handleOpenHelp = () => {
      setIsHelpModalOpen(true);
    };
    window.addEventListener('open-help-modal', handleOpenHelp);
    return () => {
      window.removeEventListener('open-help-modal', handleOpenHelp);
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

  const handleMainAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeBusiness) return;
    try {
      setSyncing(true);
      triggerToast('Uploading logo... ⏳');
      const publicUrl = await uploadBusinessLogo(file, activeBusiness.id);
      await updateActiveBusinessDetails({
        name: activeBusiness.name,
        category: activeBusiness.category,
        address: activeBusiness.address,
        phone: activeBusiness.phone,
        logoUri: publicUrl
      });
      await loadBusinesses();
      triggerToast('Logo updated successfully! 🚀');
    } catch (err: any) {
      console.error(err);
      alert('Upload failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDetailsLogoUpload = async (file: File) => {
    if (!activeBusiness) return;
    try {
      setSyncing(true);
      triggerToast('Uploading logo... ⏳');
      const publicUrl = await uploadBusinessLogo(file, activeBusiness.id);
      setEditLogoUri(publicUrl);
      triggerToast('Logo uploaded! Click save to update details.');
    } catch (err: any) {
      console.error(err);
      alert('Upload failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleStoreDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateActiveBusinessDetails({
        name: editName,
        category: editCategory,
        address: editAddress,
        phone: editPhone,
        logoUri: editLogoUri
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

    const displayRole =
      newStaffRole === 'admin' ? 'Admin' : newStaffRole === 'manager' ? 'Manager' : 'Cashier';

    createStaffMutation.mutate(
      {
        name: newStaffName,
        role: displayRole as 'Admin' | 'Manager' | 'Cashier',
        phone: newStaffPhone,
      },
      {
        onSuccess: () => {
          triggerToast(`Staff ${newStaffName} registered successfully! 👥`);
          setNewStaffName('');
          setNewStaffPhone('');
          setNewStaffRole('cashier');
        },
        onError: (err) => {
          console.error('Failed to register staff:', err);
        },
      }
    );
  };

  const handleAddBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName || !newBranchAddress) return;

    try {
      setSyncing(true);
      triggerToast('Initializing branch... 🏢');
      const businessId = await registerBusiness(
        newBranchName, 
        newBranchAddress, 
        userPhone || activeBusiness.phone, 
        newBranchCategory
      );
      
      if (businessId && newBranchLogo) {
        triggerToast('Uploading branch logo... ⏳');
        const publicUrl = await uploadBusinessLogo(newBranchLogo, businessId);
        await updateBusinessDetails(businessId, {
          name: newBranchName,
          category: newBranchCategory,
          address: newBranchAddress,
          phone: userPhone || activeBusiness.phone,
          logoUri: publicUrl
        });
      }
      
      await loadBusinesses();
      triggerToast(`Branch ${newBranchName} initialized! 🏢`);
      setNewBranchName('');
      setNewBranchAddress('');
      setNewBranchLogo(null);
      setActiveModal(null);
    } catch (err) {
      console.error(err);
      alert('Failed to register branch: ' + err);
    } finally {
      setSyncing(false);
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

      <div className="profile-scrollable-content">
        {/* Hero Banner Card */}
        <div className="profile-hero-banner">
          <div className="profile-hero-overlay" />
          <div className="profile-hero-content">
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleMainAvatarUpload} 
            />
            <div 
              className={`profile-hero-avatar-wrap ${canPerform('update', 'settings') ? 'clickable' : ''}`}
              onClick={() => canPerform('update', 'settings') && fileInputRef.current?.click()}
              title={canPerform('update', 'settings') ? 'Click to change store logo' : undefined}
            >
              <div className="profile-hero-avatar">
                {activeBusiness?.logoUri ? (
                  <img src={activeBusiness.logoUri} alt="Logo" className="profile-hero-logo" />
                ) : (
                  activeBusiness?.name?.substring(0, 2).toUpperCase() || 'SB'
                )}
              </div>
              {canPerform('update', 'settings') && (
                <div className="profile-hero-avatar-camera">
                  <Camera size={14} />
                </div>
              )}
              <div className="profile-status-ring">
                <span className="profile-status-ping" />
                <span className="profile-status-dot" />
              </div>
            </div>
            <div className="profile-hero-meta">
              <span className="profile-hero-badge">Active Terminal</span>
              <h2 className="profile-hero-title">{activeBusiness?.name || 'Partner Store'}</h2>
              <div className="profile-hero-tags">
                <span className="profile-hero-tag">
                  <Building size={12} style={{ marginRight: '4px' }} /> {activeBusiness?.category || 'General POS Retail'}
                </span>
                <span className="profile-hero-tag">
                  <MapPin size={12} style={{ marginRight: '4px' }} /> {activeBusiness?.address || 'Sri Lanka'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column SaaS Dashboard Layout */}
        <div className="profile-dashboard-grid">
          
          {/* Left Column: Premium Summary & Status Card */}
          <div className="profile-left-column">
            {/* Operator Card */}
            <div className="profile-card session-card">
              <div className="profile-card-header">
                <Activity size={16} className="profile-card-icon" />
                <h4 className="profile-card-title">Active Operator Session</h4>
              </div>
              
              <div className="profile-session-user">
                <div className="profile-session-avatar">
                  <User size={22} />
                </div>
                <div className="profile-session-meta">
                  <span className="profile-session-name">{employeeName}</span>
                  <span className={`profile-role-badge role-${userRole}`}>
                    {userRole === 'admin' ? (
                      <><Shield size={10} style={{ marginRight: '4px' }} /> Admin</>
                    ) : userRole === 'manager' ? (
                      <><Settings size={10} style={{ marginRight: '4px' }} /> Manager</>
                    ) : (
                      <><User size={10} style={{ marginRight: '4px' }} /> Cashier</>
                    )}
                  </span>
                </div>
              </div>

              <div className="profile-session-details">
                <div className="session-detail-row">
                  <span className="detail-label">Phone Creds</span>
                  <span className="detail-val">{userPhone || 'Not Configured'}</span>
                </div>
                <div className="session-detail-row">
                  <span className="detail-label">Terminal ID</span>
                  <span className="detail-val font-mono">{activeBusiness?.id?.substring(0, 8) || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* System status metadata */}
            <div className="profile-card status-card">
              <div className="profile-card-header">
                <HardDrive size={16} className="profile-card-icon" />
                <h4 className="profile-card-title">Terminal Diagnostics</h4>
              </div>
              
              <TerminalDiagnostics />
            </div>
          </div>

          {/* Right Column: SaaS Profile Options list */}
          <div className="profile-right-column">
            <div className="profile-section-title-wrap">
              <h3 className="profile-section-header">Terminal Operations Settings</h3>
              <p className="profile-section-subtitle">Configure receipt layout templates, onboard cashier employees, switch locations, and force replication logs.</p>
            </div>

            <div className="profile-options-grid">
              {/* Option: Store details */}
              {canPerform('read', 'settings') && (
                <div className="profile-option-card" onClick={() => setActiveModal('details')}>
                  <div className="profile-icon-box card-store-info">
                    <Store size={20} />
                  </div>
                  <div className="profile-option-details">
                    <h4 className="profile-option-title">Store Profile Details</h4>
                    <p className="profile-option-sub">Manage receipt layouts, active address, business contact credentials, and categories.</p>
                  </div>
                  <ChevronRight size={18} className="profile-chevron-arrow" />
                </div>
              )}

              {/* Option: Switch branches */}
              <div className="profile-option-card" onClick={() => setActiveModal('branches')}>
                <div className="profile-icon-box card-locations">
                  <MapPin size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">Locations & Branches</h4>
                  <p className="profile-option-sub">Registered branches: {businesses.length} · Initialize and swap active terminal contexts.</p>
                </div>
                <ChevronRight size={18} className="profile-chevron-arrow" />
              </div>

              {/* Option: Staff Management */}
              {canPerform('create', 'staff') && (
                <div className="profile-option-card" onClick={() => setActiveModal('staff')}>
                  <div className="profile-icon-box card-staff">
                    <Users size={20} />
                  </div>
                  <div className="profile-option-details">
                    <h4 className="profile-option-title">Staff Accounts Management</h4>
                    <p className="profile-option-sub">Onboard and manage cashmere cashiers, store managers, and administration access ranks.</p>
                  </div>
                  <ChevronRight size={18} className="profile-chevron-arrow" />
                </div>
              )}

              {/* Option: Manual Sync */}
              {canPerform('read', 'sync') && (
                <div className="profile-option-card sync-card" onClick={handleManualSync}>
                  <div className="profile-icon-box card-sync">
                    <RefreshCw size={20} className={syncing ? 'spin-anim' : ''} />
                  </div>
                  <div className="profile-option-details">
                    <h4 className="profile-option-title">Force Database Sync</h4>
                    <p className="profile-option-sub">Manually push latest offline transaction queues and adjust stock registers with cloud tables.</p>
                  </div>
                  <ChevronRight size={18} className="profile-chevron-arrow" />
                </div>
              )}

              {/* Option: Support FAQs */}
              <div className="profile-option-card" onClick={() => setActiveModal('faq')}>
                <div className="profile-icon-box card-faq">
                  <HelpCircle size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">Help FAQ & Printing Manual</h4>
                  <p className="profile-option-sub">Tax audit guidelines, hardware print configurations, and local offline database setup.</p>
                </div>
                <ChevronRight size={18} className="profile-chevron-arrow" />
              </div>

              {/* Option: Log out */}
              <div 
                className="profile-option-card logout-card"
                onClick={() => {
                  if (confirm('Disconnect POS terminal session?')) {
                    logout();
                    router.push('/auth');
                  }
                }}
              >
                <div className="profile-icon-box card-logout">
                  <LogOut size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">Sign Out Session</h4>
                  <p className="profile-option-sub">Safely commit offline cache states and disconnect this POS device terminal authorization.</p>
                </div>
                <ChevronRight size={18} className="profile-chevron-arrow" />
              </div>
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
        editLogoUri={editLogoUri}
        setEditLogoUri={setEditLogoUri}
        onLogoUpload={handleDetailsLogoUpload}
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
        onLogoFileChange={setNewBranchLogo}
        onSubmit={handleAddBranchSubmit}
        triggerToast={triggerToast}
      />

      <FaqModal
        isOpen={activeModal === 'faq'}
        onClose={() => setActiveModal(null)}
      />

      <HelpSupportModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
}
