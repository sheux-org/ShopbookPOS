'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { useProductCount } from '../../hooks/useProducts';
import { syncDatabase, uploadBusinessLogo } from '../../services/sync';
import {
  User,
  Store,
  Users,
  RefreshCw,
  LogOut,
  HelpCircle,
  CheckCircle,
  ChevronRight,
  MapPin,
  Phone,
  Database,
  Shield,
  Activity,
  HardDrive,
  Settings,
  Info,
  Building,
  Camera,
  Smartphone,
  Printer,
  Globe,
} from 'lucide-react';
import './profile.css';
import { TerminalDiagnostics } from '../../components/TerminalDiagnostics';

import { StoreDetailsModal } from '../../components/profile/StoreDetailsModal';
import { StaffModal } from '../../components/profile/StaffModal';
import { BranchModal } from '../../components/profile/BranchModal';
import { FaqModal } from '../../components/profile/FaqModal';
import { HelpSupportModal } from '../../components/profile/HelpSupportModal';
import { ActiveDevicesModal } from '../../components/profile/ActiveDevicesModal';
import { ThermalPrinterModal } from '../../components/profile/ThermalPrinterModal';
import { LanguageModal } from '../../components/profile/LanguageModal';
import { useStaff, useCreateStaff, useUpdateStaff, useDeleteStaff } from '../../hooks/useStaff';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { deleteCurrentDeviceSession } from '../../hooks/useActiveDeviceTracker';
import { useTranslation } from '../../hooks/useTranslation';

interface DBEmployee {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier';
  phone: string;
  email?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useTranslation();
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
  const [activeModal, setActiveModal] = useState<
    'details' | 'staff' | 'branches' | 'faq' | 'devices' | 'printer' | 'language' | null
  >(null);

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
  const [editingStaff, setEditingStaff] = useState<DBEmployee | null>(null);

  // Form states - Branch add
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCategory, setNewBranchCategory] = useState('Cafe');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const { data: productCount = 0 } = useProductCount();

  // React Query Hooks
  const { data: staffList = [] } = useStaff(activeBusiness?.id || '0');
  const createStaffMutation = useCreateStaff(activeBusiness?.id || '0');
  const updateStaffMutation = useUpdateStaff(activeBusiness?.id || '0');
  const deleteStaffMutation = useDeleteStaff(activeBusiness?.id || '0');

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
        logoUri: publicUrl,
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
        logoUri: editLogoUri,
      });
      await loadBusinesses();
      triggerToast('Store details updated! 🏬');
      setActiveModal(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditStaff = (emp: DBEmployee) => {
    setEditingStaff(emp);
    setNewStaffName(emp.name);
    setNewStaffPhone(emp.phone);
    setNewStaffRole(emp.role);
  };

  const handleCancelEditStaff = () => {
    setEditingStaff(null);
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffRole('cashier');
  };

  const handleDeleteStaff = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    if (!emp) return;

    const userInput = prompt(
      `⚠️ Permanently Remove Staff Member\n\nThis will permanently delete "${emp.name}" and revoke their access.\n\nTo confirm, please type "${emp.name}" below:`
    );

    if (userInput === null) return; // Cancelled

    if (userInput.trim().toLowerCase() !== emp.name.trim().toLowerCase()) {
      alert(`The entered name did not match "${emp.name}". Deletion cancelled.`);
      return;
    }

    deleteStaffMutation.mutate(id, {
      onSuccess: () => {
        triggerToast('Staff member removed successfully! 🗑️');
      },
      onError: (err: any) => {
        console.error(err);
        triggerToast(err.message || 'Failed to remove staff member.');
      },
    });
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffPhone) return;

    const displayRole =
      newStaffRole === 'admin' ? 'Admin' : newStaffRole === 'manager' ? 'Manager' : 'Cashier';

    if (editingStaff) {
      updateStaffMutation.mutate(
        {
          id: editingStaff.id,
          name: newStaffName,
          role: displayRole as 'Admin' | 'Manager' | 'Cashier',
          phone: newStaffPhone,
        },
        {
          onSuccess: () => {
            triggerToast(`Staff ${newStaffName} details updated! 👥`);
            setNewStaffName('');
            setNewStaffPhone('');
            setNewStaffRole('cashier');
            setEditingStaff(null);
          },
          onError: (err: any) => {
            console.error('Failed to update staff:', err);
            triggerToast(err.message || 'Failed to update staff.');
          },
        }
      );
    } else {
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
          onError: (err: any) => {
            console.error('Failed to register staff:', err);
            triggerToast(err.message || 'Failed to onboard staff member.');
          },
        }
      );
    }
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
          logoUri: publicUrl,
        });
      }

      await loadBusinesses();
      triggerToast(`Branch ${newBranchName} initialized! 🏢`);
      setNewBranchName('');
      setNewBranchAddress('');
      setNewBranchCategory('Cafe');
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
        alert(
          'Sync failed. Please ensure the Supabase configuration parameters inside web/.env.local are correct.'
        );
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
              <span className="profile-hero-badge">{t('profile.activeTerminal')}</span>
              <h2 className="profile-hero-title">{activeBusiness?.name || 'Partner Store'}</h2>
              <div className="profile-hero-tags">
                <span className="profile-hero-tag">
                  <Building size={12} style={{ marginRight: '4px' }} />{' '}
                  {activeBusiness?.category || 'General POS Retail'}
                </span>
                <span className="profile-hero-tag">
                  <MapPin size={12} style={{ marginRight: '4px' }} />{' '}
                  {activeBusiness?.address || 'Sri Lanka'}
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
                <h4 className="profile-card-title">{t('profile.operatorSession')}</h4>
              </div>

              <div className="profile-session-user">
                <div className="profile-session-avatar">
                  <User size={22} />
                </div>
                <div className="profile-session-meta">
                  <span className="profile-session-name">{employeeName}</span>
                  <span className={`profile-role-badge role-${userRole}`}>
                    {userRole === 'admin' ? (
                      <>
                        <Shield size={10} style={{ marginRight: '4px' }} /> {t('staff.roleAdmin')}
                      </>
                    ) : userRole === 'manager' ? (
                      <>
                        <Settings size={10} style={{ marginRight: '4px' }} />{' '}
                        {t('staff.roleManager')}
                      </>
                    ) : (
                      <>
                        <User size={10} style={{ marginRight: '4px' }} /> {t('staff.roleCashier')}
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div className="profile-session-details">
                <div className="session-detail-row">
                  <span className="detail-label">{t('staff.phoneLabel')}</span>
                  <span className="detail-val">{userPhone || 'Not Configured'}</span>
                </div>
                <div className="session-detail-row">
                  <span className="detail-label">Terminal ID</span>
                  <span className="detail-val font-mono">
                    {activeBusiness?.id?.substring(0, 8) || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* System status metadata */}
            <div className="profile-card status-card">
              <div className="profile-card-header">
                <HardDrive size={16} className="profile-card-icon" />
                <h4 className="profile-card-title">{t('profile.terminalDiagnostics')}</h4>
              </div>

              <TerminalDiagnostics />
            </div>
          </div>

          {/* Right Column: SaaS Profile Options list */}
          <div className="profile-right-column">
            <div className="profile-section-title-wrap">
              <h3 className="profile-section-header">{t('profile.settingsTitle')}</h3>
              <p className="profile-section-subtitle">{t('profile.settingsSub')}</p>
            </div>

            <div className="profile-options-grid">
              {/* Option: Store details */}
              {canPerform('read', 'settings') && (
                <div className="profile-option-card" onClick={() => setActiveModal('details')}>
                  <div className="profile-icon-box card-store-info">
                    <Store size={20} />
                  </div>
                  <div className="profile-option-details">
                    <h4 className="profile-option-title">{t('profile.storeDetailsTitle')}</h4>
                    <p className="profile-option-sub">{t('profile.storeDetailsSub')}</p>
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
                  <h4 className="profile-option-title">{t('profile.branchTitle')}</h4>
                  <p className="profile-option-sub">{t('profile.branchSub')}</p>
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
                    <h4 className="profile-option-title">{t('profile.staffTitle')}</h4>
                    <p className="profile-option-sub">{t('profile.staffSub')}</p>
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
                    <h4 className="profile-option-title">{t('profile.syncTitle')}</h4>
                    <p className="profile-option-sub">{t('profile.syncSub')}</p>
                  </div>
                  <ChevronRight size={18} className="profile-chevron-arrow" />
                </div>
              )}

              {/* Option: Active Devices & Sessions */}
              <div
                className="profile-option-card devices-card"
                onClick={() => setActiveModal('devices')}
              >
                <div className="profile-icon-box card-devices">
                  <Smartphone size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">{t('profile.devicesTitle')}</h4>
                  <p className="profile-option-sub">{t('profile.devicesSub')}</p>
                </div>
                <ChevronRight size={18} className="profile-chevron-arrow" />
              </div>

              {/* Option: Thermal Printer */}
              <div className="profile-option-card" onClick={() => setActiveModal('printer')}>
                <div className="profile-icon-box card-store-info">
                  <Printer size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">{t('profile.printerTitle')}</h4>
                  <p className="profile-option-sub">{t('profile.printerSubScan')}</p>
                </div>
                <ChevronRight size={18} className="profile-chevron-arrow" />
              </div>

              {/* Option: Language Selection */}
              <div className="profile-option-card" onClick={() => setActiveModal('language')}>
                <div
                  className="profile-icon-box"
                  style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                >
                  <Globe size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">{t('profile.languageTitle')}</h4>
                  <p className="profile-option-sub">{t('profile.languageSub')}</p>
                </div>
                <ChevronRight size={18} className="profile-chevron-arrow" />
              </div>

              {/* Option: Support FAQs */}
              <div className="profile-option-card" onClick={() => setActiveModal('faq')}>
                <div className="profile-icon-box card-faq">
                  <HelpCircle size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">{t('profile.faqTitle')}</h4>
                  <p className="profile-option-sub">{t('profile.faqSub')}</p>
                </div>
                <ChevronRight size={18} className="profile-chevron-arrow" />
              </div>

              {/* Option: Log out */}
              <div
                className="profile-option-card logout-card"
                onClick={() => {
                  if (confirm(t('profile.logoutPrompt') || 'Disconnect POS terminal session?')) {
                    deleteCurrentDeviceSession().then(() => {
                      logout();
                      router.push('/auth');
                    });
                  }
                }}
              >
                <div className="profile-icon-box card-logout">
                  <LogOut size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">{t('profile.logoutTitle')}</h4>
                  <p className="profile-option-sub">{t('profile.logoutSub')}</p>
                </div>
                <ChevronRight size={18} className="profile-chevron-arrow" />
              </div>
            </div>
          </div>
        </div>

        {/* Powered by Shopbook */}
        <div className="powered-by-container" style={{ marginTop: '36px', marginBottom: '24px' }}>
          <span className="powered-by-text">powered by</span>
          <a
            href="https://shopbook.lk"
            target="_blank"
            rel="noopener noreferrer"
            className="powered-by-brand"
          >
            Shopbook
          </a>
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
        hasItems={productCount > 0}
      />

      <StaffModal
        isOpen={activeModal === 'staff'}
        onClose={() => {
          setActiveModal(null);
          handleCancelEditStaff();
        }}
        employees={employees}
        newStaffName={newStaffName}
        setNewStaffName={setNewStaffName}
        newStaffPhone={newStaffPhone}
        setNewStaffPhone={setNewStaffPhone}
        newStaffRole={newStaffRole}
        setNewStaffRole={setNewStaffRole}
        onSubmit={handleAddStaffSubmit}
        editingStaff={editingStaff}
        onEdit={handleEditStaff}
        onDelete={handleDeleteStaff}
        onCancelEdit={handleCancelEditStaff}
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

      <FaqModal isOpen={activeModal === 'faq'} onClose={() => setActiveModal(null)} />

      <ActiveDevicesModal
        isOpen={activeModal === 'devices'}
        onClose={() => setActiveModal(null)}
        activeBusinessId={activeBusiness?.id || '0'}
      />

      <ThermalPrinterModal
        isOpen={activeModal === 'printer'}
        onClose={() => setActiveModal(null)}
        activeBusiness={activeBusiness}
      />

      <LanguageModal isOpen={activeModal === 'language'} onClose={() => setActiveModal(null)} />

      <HelpSupportModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
    </div>
  );
}
