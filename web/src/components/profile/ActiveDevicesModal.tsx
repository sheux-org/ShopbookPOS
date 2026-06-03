'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, Smartphone, Laptop, Monitor, Trash2, Clock, Battery, MapPin, Bell, Copy, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../services/sync';
import { DEVICE_ID_KEY } from '../../hooks/useActiveDeviceTracker';

interface ActiveDevice {
  id: string;
  business_id: string;
  employee_id: string | null;
  employee_name: string;
  role: string;
  device_id: string;
  device_model: string;
  battery_level: number | null;
  is_online: boolean;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  push_token: string | null;
  last_active_at: string;
}

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
  const [devices, setDevices] = useState<ActiveDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const fetchDevices = useCallback(async () => {
    if (!activeBusinessId || activeBusinessId === '0') return;
    try {
      const { data, error } = await supabase
        .from('active_devices')
        .select('*')
        .eq('business_id', activeBusinessId)
        .order('last_active_at', { ascending: false });

      if (error) {
        console.error('Error fetching active devices:', error);
      } else if (data) {
        setDevices(data);
      }
    } catch (err) {
      console.error('Failed to fetch active devices:', err);
    } finally {
      setLoading(false);
    }
  }, [activeBusinessId]);

  useEffect(() => {
    if (!isOpen) return;

    // Get current device ID from storage
    if (typeof window !== 'undefined') {
      setCurrentDeviceId(localStorage.getItem(DEVICE_ID_KEY));
    }

    setLoading(true);
    fetchDevices();

    if (!activeBusinessId || activeBusinessId === '0') return;

    // Set up Realtime listener for active devices of this business
    const channelId = `active-devices-web-${activeBusinessId}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_devices',
          filter: `business_id=eq.${activeBusinessId}`,
        },
        () => {
          fetchDevices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, activeBusinessId, fetchDevices]);

  const handleTerminateSession = async (targetDeviceId: string, name: string) => {
    if (!confirm(`Are you sure you want to remotely sign out "${name}" from this device session?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('active_devices')
        .delete()
        .eq('device_id', targetDeviceId)
        .eq('business_id', activeBusinessId);

      if (error) {
        triggerToast('Failed to terminate session.');
      } else {
        triggerToast('Session terminated successfully! 🗑️');
        fetchDevices();
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
    if (lower.includes('mac') || lower.includes('pc') || lower.includes('window') || lower.includes('linux')) {
      return <Monitor size={18} />;
    }
    if (lower.includes('ipad') || lower.includes('tablet')) {
      return <Laptop size={18} />;
    }
    return <Smartphone size={18} />;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3>Active Devices & Sessions</h3>
            <button 
              onClick={() => {
                setLoading(true);
                fetchDevices();
              }}
              className="refresh-btn-devices"
              title="Refresh list"
            >
              <RefreshCw size={12} className={loading ? 'spin-anim' : ''} />
            </button>
          </div>
          <button onClick={onClose} className="modal-close-btn"><X size={16} /></button>
        </div>

        {toastMsg && (
          <div className="profile-toast" style={{ position: 'absolute', top: '70px', zIndex: 10000 }}>
            <CheckCircle size={16} color="#FFFFFF" />
            <span>{toastMsg}</span>
          </div>
        )}

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="devices-info-banner">
            Monitor all active terminals logged into your business. You can remotely revoke access to force logout a device.
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #e5e7eb',
                borderTopColor: '#2563eb',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>Loading active terminals...</span>
            </div>
          ) : devices.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', color: 'var(--muted)' }}>
              <Smartphone size={40} style={{ marginBottom: '10px' }} />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>No Active Sessions Found</span>
            </div>
          ) : (
            <div className="devices-list-wrapper">
              {devices.map((device) => {
                const isCurrent = device.device_id === currentDeviceId;
                return (
                  <div key={device.id} className={`device-item-card ${isCurrent ? 'current' : ''}`}>
                    <div className="device-item-icon-box">
                      {getDeviceIcon(device.device_model)}
                    </div>
                    <div className="device-item-details">
                      <div className="device-item-header">
                        <span className="device-employee-name">{device.employee_name}</span>
                        <span className={`role-badge ${getRoleBadgeClass(device.role)}`}>
                          {device.role.toUpperCase()}
                        </span>
                        {isCurrent && (
                          <span className="current-device-badge">This Device</span>
                        )}
                      </div>
                      
                      <div className="device-model-name">{device.device_model}</div>

                      <div className="device-meta-row">
                        <span className="device-meta-item">
                          <span className={`device-status-indicator ${device.is_online ? 'online' : 'offline'}`} />
                          {device.is_online ? 'Online' : 'Offline'}
                        </span>

                        {device.battery_level !== null && (
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
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.location_name}</span>
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
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
