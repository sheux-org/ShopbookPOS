'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  Smartphone,
  Laptop,
  Monitor,
  Trash2,
  Clock,
  Battery,
  MapPin,
  Bell,
  Copy,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { DEVICE_ID_KEY } from '../../hooks/useActiveDeviceTracker';
import {
  fetchRecentlyOfflineDevices,
  getPresenceDevices,
  revokeDeviceSession,
  subscribePresenceObserver,
  type ActiveDeviceView,
} from '../../services/devicePresence';

interface ActiveDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBusinessId: string;
}

export const ActiveDevicesModal: React.FC<ActiveDevicesModalProps> = ({
  isOpen,
  onClose,
  activeBusinessId,
}) => {
  const [onlineDevices, setOnlineDevices] = useState<ActiveDeviceView[]>([]);
  const [offlineDevices, setOfflineDevices] = useState<ActiveDeviceView[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const refreshOnlineDevices = useCallback(() => {
    setOnlineDevices(getPresenceDevices());
    setLoading(false);
  }, []);

  const loadOfflineDevices = useCallback(async () => {
    if (!activeBusinessId || activeBusinessId === '0') return;
    const offline = await fetchRecentlyOfflineDevices(activeBusinessId);
    const onlineIds = new Set(getPresenceDevices().map((d) => d.device_id));
    setOfflineDevices(offline.filter((d) => !onlineIds.has(d.device_id)));
  }, [activeBusinessId]);

  useEffect(() => {
    if (!isOpen || !activeBusinessId || activeBusinessId === '0') return;

    if (typeof window !== 'undefined') {
      setCurrentDeviceId(localStorage.getItem(DEVICE_ID_KEY));
    }

    setLoading(true);
    refreshOnlineDevices();
    void loadOfflineDevices();

    const unsubscribe = subscribePresenceObserver({
      businessId: activeBusinessId,
      onPresenceChange: () => {
        refreshOnlineDevices();
        void loadOfflineDevices();
      },
    });

    return unsubscribe;
  }, [isOpen, activeBusinessId, refreshOnlineDevices, loadOfflineDevices]);

  const handleTerminateSession = async (targetDeviceId: string, name: string) => {
    if (
      !confirm(`Are you sure you want to remotely sign out "${name}" from this device session?`)
    ) {
      return;
    }

    try {
      const revokedBy = currentDeviceId || 'admin';
      const { error } = await revokeDeviceSession({
        businessId: activeBusinessId,
        targetDeviceId,
        revokedByDeviceId: revokedBy,
      });

      if (error) {
        triggerToast('Failed to terminate session.');
      } else {
        triggerToast('Session terminated successfully! 🗑️');
        refreshOnlineDevices();
        void loadOfflineDevices();
      }
    } catch (err) {
      console.error(err);
      triggerToast('An error occurred.');
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'role-admin';
      case 'manager':
        return 'role-manager';
      default:
        return 'role-cashier';
    }
  };

  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getDeviceIcon = (model: string) => {
    const lower = model.toLowerCase();
    if (
      lower.includes('mac') ||
      lower.includes('pc') ||
      lower.includes('window') ||
      lower.includes('linux') ||
      lower.includes('web')
    ) {
      return <Monitor size={18} />;
    }
    if (lower.includes('ipad') || lower.includes('tablet')) {
      return <Laptop size={18} />;
    }
    return <Smartphone size={18} />;
  };

  const renderDeviceCard = (device: ActiveDeviceView, isOnline: boolean) => {
    const isCurrent = device.device_id === currentDeviceId;

    return (
      <div key={device.id} className={`device-item-card ${isCurrent ? 'current' : ''}`}>
        <div className="device-item-icon-box">{getDeviceIcon(device.device_model)}</div>
        <div className="device-item-details">
          <div className="device-item-header">
            <span className="device-employee-name">{device.employee_name}</span>
            <span className={`role-badge ${getRoleBadgeClass(device.role)}`}>
              {device.role.toUpperCase()}
            </span>
            {isCurrent && <span className="current-device-badge">This Device</span>}
          </div>

          <div className="device-model-name">{device.device_model}</div>

          <div className="device-meta-row">
            <span className="device-meta-item">
              <span className={`device-status-indicator ${isOnline ? 'online' : 'offline'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </span>

            {isOnline && device.battery_level !== null && device.battery_level >= 0 && (
              <span className="device-meta-item">
                <Battery size={12} style={{ marginRight: '2px' }} />
                {device.battery_level}%
              </span>
            )}

            <span className="device-meta-item">
              <Clock size={12} style={{ marginRight: '2px' }} />
              {formatLastActive(device.last_active_at)}
            </span>
          </div>

          {device.location_name && (
            <div className="device-location-row">
              <MapPin size={12} style={{ marginRight: '2px', flexShrink: 0 }} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {device.location_name}
              </span>
            </div>
          )}

          {device.push_token && (
            <div className="device-token-row">
              <Bell size={11} style={{ marginRight: '2px', flexShrink: 0 }} />
              <span className="device-token-text">{device.push_token}</span>
              <button
                className="device-copy-token-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(device.push_token || '');
                    triggerToast('Push token copied! 📋');
                  } catch {
                    // fallback
                  }
                }}
                title="Copy Push Token"
              >
                <Copy size={10} />
              </button>
            </div>
          )}
        </div>

        {!isCurrent && (
          <button
            className="device-terminate-btn"
            onClick={() => handleTerminateSession(device.device_id, device.employee_name)}
            title="Revoke session"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const hasDevices = onlineDevices.length > 0 || offlineDevices.length > 0;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3>Active Devices & Sessions</h3>
            <button
              onClick={() => {
                setLoading(true);
                refreshOnlineDevices();
                void loadOfflineDevices();
              }}
              className="refresh-btn-devices"
              title="Refresh list"
            >
              <RefreshCw size={12} className={loading ? 'spin-anim' : ''} />
            </button>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X size={16} />
          </button>
        </div>

        {toastMsg && (
          <div
            className="profile-toast"
            style={{ position: 'absolute', top: '70px', zIndex: 10000 }}
          >
            <CheckCircle size={16} color="#FFFFFF" />
            <span>{toastMsg}</span>
          </div>
        )}

        <div className="modal-body" style={{ padding: '24px' }}>
          <div className="devices-info-banner" style={{ margin: 0 }}>
            Monitor all active terminals logged into your business. You can remotely revoke access
            to force logout a device instantly.
          </div>

          <div className="devices-scroller">
            {loading ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '200px',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid #ede9fe',
                    borderTopColor: '#7c3aed',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                  Loading active terminals...
                </span>
              </div>
            ) : !hasDevices ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '240px',
                  color: 'var(--muted)',
                  textAlign: 'center',
                  padding: '24px',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#f5f3ff',
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.08)',
                  }}
                >
                  <Smartphone size={28} />
                </div>
                <h4
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--dark)',
                  }}
                >
                  No Active Sessions
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: '12.5px',
                    color: 'var(--muted)',
                    maxWidth: '280px',
                    lineHeight: '1.5',
                  }}
                >
                  There are no active devices or browser terminals logged into this business
                  account.
                </p>
              </div>
            ) : (
              <div className="devices-list-wrapper">
                {onlineDevices.length > 0 && (
                  <>
                    <p className="devices-section-label">Online Now</p>
                    {onlineDevices.map((device) => renderDeviceCard(device, true))}
                  </>
                )}
                {offlineDevices.length > 0 && (
                  <>
                    <p className="devices-section-label">Recently Offline (24h)</p>
                    {offlineDevices.map((device) => renderDeviceCard(device, false))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
