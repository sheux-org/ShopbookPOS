'use client';

import React, { useReducer, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
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
} from 'lucide-react';
import './profile.css';
import { TerminalDiagnostics } from '../../components/TerminalDiagnostics';

import { StoreDetailsModal } from '../../components/profile/StoreDetailsModal';
import { StaffModal } from '../../components/profile/StaffModal';
import { BranchModal } from '../../components/profile/BranchModal';
import { FaqModal } from '../../components/profile/FaqModal';
import { HelpSupportModal } from '../../components/profile/HelpSupportModal';
import { ActiveDevicesModal } from '../../components/profile/ActiveDevicesModal';
import { useStaff, useCreateStaff, useUpdateStaff, useDeleteStaff } from '../../hooks/useStaff';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { deleteCurrentDeviceSession } from '../../hooks/useActiveDeviceTracker';

interface DBEmployee {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier';
  phone: string;
  email?: string;
}

type ProfileModal = 'details' | 'staff' | 'branches' | 'faq' | 'devices' | null;

interface ProfileState {
  toastMsg: string | null;
  syncing: boolean;
  activeModal: ProfileModal;
  isHelpModalOpen: boolean;
  editName: string;
  editCategory: string;
  editAddress: string;
  editPhone: string;
  editLogoUri: string;
  newBranchLogo: File | null;
  newStaffName: string;
  newStaffRole: 'admin' | 'manager' | 'cashier';
  newStaffPhone: string;
  editingStaff: DBEmployee | null;
  newBranchName: string;
  newBranchCategory: string;
  newBranchAddress: string;
}

type ProfileAction =
  | { type: 'showToast'; message: string }
  | { type: 'clearToast' }
  | { type: 'setSyncing'; syncing: boolean }
  | { type: 'setActiveModal'; modal: ProfileModal }
  | { type: 'setHelpModalOpen'; open: boolean }
  | {
      type: 'loadStoreDetails';
      details: {
        name: string;
        category: string;
        address: string;
        phone: string;
        logoUri: string;
      };
    }
  | { type: 'setField'; field: keyof ProfileState; value: ProfileState[keyof ProfileState] }
  | { type: 'startEditStaff'; employee: DBEmployee }
  | { type: 'resetStaffForm' }
  | { type: 'resetBranchForm' };

const initialProfileState: ProfileState = {
  toastMsg: null,
  syncing: false,
  activeModal: null,
  isHelpModalOpen: false,
  editName: '',
  editCategory: '',
  editAddress: '',
  editPhone: '',
  editLogoUri: '',
  newBranchLogo: null,
  newStaffName: '',
  newStaffRole: 'cashier',
  newStaffPhone: '',
  editingStaff: null,
  newBranchName: '',
  newBranchCategory: 'Cafe',
  newBranchAddress: '',
};

function profileReducer(state: ProfileState, action: ProfileAction): ProfileState {
  switch (action.type) {
    case 'showToast':
      return { ...state, toastMsg: action.message };
    case 'clearToast':
      return { ...state, toastMsg: null };
    case 'setSyncing':
      return { ...state, syncing: action.syncing };
    case 'setActiveModal':
      return { ...state, activeModal: action.modal };
    case 'setHelpModalOpen':
      return { ...state, isHelpModalOpen: action.open };
    case 'loadStoreDetails':
      return {
        ...state,
        editName: action.details.name,
        editCategory: action.details.category,
        editAddress: action.details.address,
        editPhone: action.details.phone,
        editLogoUri: action.details.logoUri,
      };
    case 'setField':
      return { ...state, [action.field]: action.value };
    case 'startEditStaff':
      return {
        ...state,
        editingStaff: action.employee,
        newStaffName: action.employee.name,
        newStaffPhone: action.employee.phone,
        newStaffRole: action.employee.role,
      };
    case 'resetStaffForm':
      return {
        ...state,
        editingStaff: null,
        newStaffName: '',
        newStaffPhone: '',
        newStaffRole: 'cashier',
      };
    case 'resetBranchForm':
      return {
        ...state,
        newBranchName: '',
        newBranchAddress: '',
        newBranchCategory: 'Cafe',
        newBranchLogo: null,
        activeModal: null,
      };
    default:
      return state;
  }
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

  const [state, dispatch] = useReducer(profileReducer, initialProfileState);
  const {
    toastMsg,
    syncing,
    activeModal,
    isHelpModalOpen,
    editName,
    editCategory,
    editAddress,
    editPhone,
    editLogoUri,
    newBranchLogo,
    newStaffName,
    newStaffRole,
    newStaffPhone,
    editingStaff,
    newBranchName,
    newBranchCategory,
    newBranchAddress,
  } = state;

  const setProfileField = <K extends keyof ProfileState>(field: K, value: ProfileState[K]) =>
    dispatch({ type: 'setField', field, value });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
      dispatch({
        type: 'loadStoreDetails',
        details: {
          name: activeBusiness.name || '',
          category: activeBusiness.category || '',
          address: activeBusiness.address || '',
          phone: activeBusiness.phone || '',
          logoUri: activeBusiness.logoUri || '',
        },
      });
    }
  }, [isLoggedIn, activeBusiness]);

  useEffect(() => {
    const handleOpenHelp = () => {
      dispatch({ type: 'setHelpModalOpen', open: true });
    };
    window.addEventListener('open-help-modal', handleOpenHelp);
    return () => {
      window.removeEventListener('open-help-modal', handleOpenHelp);
    };
  }, []);

  const triggerToast = (msg: string) => {
    dispatch({ type: 'showToast', message: msg });
    setTimeout(() => dispatch({ type: 'clearToast' }), 1500);
  };

  const handleMainAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeBusiness) return;
    try {
      dispatch({ type: 'setSyncing', syncing: true });
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
      dispatch({ type: 'setSyncing', syncing: false });
    }
  };

  const handleDetailsLogoUpload = async (file: File) => {
    if (!activeBusiness) return;
    try {
      dispatch({ type: 'setSyncing', syncing: true });
      triggerToast('Uploading logo... ⏳');
      const publicUrl = await uploadBusinessLogo(file, activeBusiness.id);
      setProfileField('editLogoUri', publicUrl);
      triggerToast('Logo uploaded! Click save to update details.');
    } catch (err: any) {
      console.error(err);
      alert('Upload failed: ' + err.message);
    } finally {
      dispatch({ type: 'setSyncing', syncing: false });
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
      dispatch({ type: 'setActiveModal', modal: null });
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditStaff = (emp: DBEmployee) => {
    dispatch({ type: 'startEditStaff', employee: emp });
  };

  const handleCancelEditStaff = () => {
    dispatch({ type: 'resetStaffForm' });
  };

  const handleDeleteStaff = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    if (!emp) return;
    if (
      confirm(
        `Are you sure you want to permanently remove "${emp.name}"? This action cannot be undone.`
      )
    ) {
      deleteStaffMutation.mutate(id, {
        onSuccess: () => {
          triggerToast('Staff member removed successfully! 🗑️');
        },
        onError: (err: any) => {
          console.error(err);
          triggerToast(err.message || 'Failed to remove staff member.');
        },
      });
    }
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
            dispatch({ type: 'resetStaffForm' });
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
            dispatch({ type: 'resetStaffForm' });
          },
          onError: (err) => {
            console.error('Failed to register staff:', err);
            triggerToast('Failed to onboard staff member.');
          },
        }
      );
    }
  };

  const handleAddBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName || !newBranchAddress) return;

    try {
      dispatch({ type: 'setSyncing', syncing: true });
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
      dispatch({ type: 'resetBranchForm' });
    } catch (err) {
      console.error(err);
      alert('Failed to register branch: ' + err);
    } finally {
      dispatch({ type: 'setSyncing', syncing: false });
    }
  };

  const handleManualSync = async () => {
    dispatch({ type: 'setSyncing', syncing: true });
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
      dispatch({ type: 'setSyncing', syncing: false });
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
                      <>
                        <Shield size={10} style={{ marginRight: '4px' }} /> Admin
                      </>
                    ) : userRole === 'manager' ? (
                      <>
                        <Settings size={10} style={{ marginRight: '4px' }} /> Manager
                      </>
                    ) : (
                      <>
                        <User size={10} style={{ marginRight: '4px' }} /> Cashier
                      </>
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
                <h4 className="profile-card-title">Terminal Diagnostics</h4>
              </div>

              <TerminalDiagnostics />
            </div>
          </div>

          {/* Right Column: SaaS Profile Options list */}
          <div className="profile-right-column">
            <div className="profile-section-title-wrap">
              <h3 className="profile-section-header">Terminal Operations Settings</h3>
              <p className="profile-section-subtitle">
                Configure receipt layout templates, onboard cashier employees, switch locations, and
                force replication logs.
              </p>
            </div>

            <div className="profile-options-grid">
              {/* Option: Store details */}
              {canPerform('read', 'settings') && (
                <div
                  className="profile-option-card"
                  onClick={() => dispatch({ type: 'setActiveModal', modal: 'details' })}
                >
                  <div className="profile-icon-box card-store-info">
                    <Store size={20} />
                  </div>
                  <div className="profile-option-details">
                    <h4 className="profile-option-title">Store Profile Details</h4>
                    <p className="profile-option-sub">
                      Manage receipt layouts, active address, business contact credentials, and
                      categories.
                    </p>
                  </div>
                  <ChevronRight size={18} className="profile-chevron-arrow" />
                </div>
              )}

              {/* Option: Switch branches */}
              <div
                className="profile-option-card"
                onClick={() => dispatch({ type: 'setActiveModal', modal: 'branches' })}
              >
                <div className="profile-icon-box card-locations">
                  <MapPin size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">Multi-Business & Branches</h4>
                  <p className="profile-option-sub">
                    Manage and swap active contexts between different registered businesses, branch
                    locations, and checkout terminals.
                  </p>
                </div>
                <ChevronRight size={18} className="profile-chevron-arrow" />
              </div>

              {/* Option: Staff Management */}
              {canPerform('create', 'staff') && (
                <div
                  className="profile-option-card"
                  onClick={() => dispatch({ type: 'setActiveModal', modal: 'staff' })}
                >
                  <div className="profile-icon-box card-staff">
                    <Users size={20} />
                  </div>
                  <div className="profile-option-details">
                    <h4 className="profile-option-title">Staff Accounts Management</h4>
                    <p className="profile-option-sub">
                      Onboard and manage cashmere cashiers, store managers, and administration
                      access ranks.
                    </p>
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
                    <h4 className="profile-option-title">Sync to Cloud</h4>
                    <p className="profile-option-sub">
                      Manually push latest offline transaction queues and adjust stock registers
                      with cloud tables.
                    </p>
                  </div>
                  <ChevronRight size={18} className="profile-chevron-arrow" />
                </div>
              )}

              {/* Option: Active Devices & Sessions */}
              <div
                className="profile-option-card devices-card"
                onClick={() => dispatch({ type: 'setActiveModal', modal: 'devices' })}
              >
                <div className="profile-icon-box card-devices">
                  <Smartphone size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">Active Devices & Sessions</h4>
                  <p className="profile-option-sub">
                    Monitor, inspect, and remotely log out active terminal sessions on Android, iOS,
                    or web client instances.
                  </p>
                </div>
                <ChevronRight size={18} className="profile-chevron-arrow" />
              </div>

              {/* Option: Support FAQs */}
              <div
                className="profile-option-card"
                onClick={() => dispatch({ type: 'setActiveModal', modal: 'faq' })}
              >
                <div className="profile-icon-box card-faq">
                  <HelpCircle size={20} />
                </div>
                <div className="profile-option-details">
                  <h4 className="profile-option-title">Help FAQ & Printing Manual</h4>
                  <p className="profile-option-sub">
                    Tax audit guidelines, hardware print configurations, and local offline database
                    setup.
                  </p>
                </div>
                <ChevronRight size={18} className="profile-chevron-arrow" />
              </div>

              {/* Option: Log out */}
              <div
                className="profile-option-card logout-card"
                onClick={() => {
                  if (confirm('Disconnect POS terminal session?')) {
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
                  <h4 className="profile-option-title">Sign Out Session</h4>
                  <p className="profile-option-sub">
                    Safely commit offline cache states and disconnect this POS device terminal
                    authorization.
                  </p>
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
        onClose={() => dispatch({ type: 'setActiveModal', modal: null })}
        editName={editName}
        setEditName={(value) => setProfileField('editName', value)}
        editCategory={editCategory}
        setEditCategory={(value) => setProfileField('editCategory', value)}
        editAddress={editAddress}
        setEditAddress={(value) => setProfileField('editAddress', value)}
        editPhone={editPhone}
        setEditPhone={(value) => setProfileField('editPhone', value)}
        editLogoUri={editLogoUri}
        setEditLogoUri={(value) => setProfileField('editLogoUri', value)}
        onLogoUpload={handleDetailsLogoUpload}
        onSubmit={handleStoreDetailsSubmit}
      />

      <StaffModal
        isOpen={activeModal === 'staff'}
        onClose={() => {
          dispatch({ type: 'setActiveModal', modal: null });
          handleCancelEditStaff();
        }}
        employees={employees}
        newStaffName={newStaffName}
        setNewStaffName={(value) => setProfileField('newStaffName', value)}
        newStaffPhone={newStaffPhone}
        setNewStaffPhone={(value) => setProfileField('newStaffPhone', value)}
        newStaffRole={newStaffRole}
        setNewStaffRole={(value) => setProfileField('newStaffRole', value)}
        onSubmit={handleAddStaffSubmit}
        editingStaff={editingStaff}
        onEdit={handleEditStaff}
        onDelete={handleDeleteStaff}
        onCancelEdit={handleCancelEditStaff}
      />

      <BranchModal
        isOpen={activeModal === 'branches'}
        onClose={() => dispatch({ type: 'setActiveModal', modal: null })}
        businesses={businesses}
        activeBusiness={activeBusiness}
        setActiveBusiness={setActiveBusiness}
        newBranchName={newBranchName}
        setNewBranchName={(value) => setProfileField('newBranchName', value)}
        newBranchCategory={newBranchCategory}
        setNewBranchCategory={(value) => setProfileField('newBranchCategory', value)}
        newBranchAddress={newBranchAddress}
        setNewBranchAddress={(value) => setProfileField('newBranchAddress', value)}
        onSubmit={handleAddBranchSubmit}
        triggerToast={triggerToast}
      />

      <FaqModal
        isOpen={activeModal === 'faq'}
        onClose={() => dispatch({ type: 'setActiveModal', modal: null })}
      />

      <ActiveDevicesModal
        isOpen={activeModal === 'devices'}
        onClose={() => dispatch({ type: 'setActiveModal', modal: null })}
        activeBusinessId={activeBusiness?.id || '0'}
      />

      <HelpSupportModal
        isOpen={isHelpModalOpen}
        onClose={() => dispatch({ type: 'setHelpModalOpen', open: false })}
      />
    </div>
  );
}
