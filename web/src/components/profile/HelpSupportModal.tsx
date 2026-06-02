'use client';

import React from 'react';
import { X, Phone, MessageCircle, Users, Globe, ExternalLink, Sparkles } from 'lucide-react';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const contactOptions = [
    {
      name: 'WhatsApp Customer Support',
      description: 'Chat immediately & send screenshots for debug help',
      value: '+94 78 247 0168',
      link: 'https://wa.me/94782470168',
      icon: MessageCircle,
      bg: '#E8FDF0',
      color: '#10B981',
      border: '#a7f3d0'
    },
    {
      name: '24/7 Telephone Helpline',
      description: 'Call our direct line for instant voice support',
      value: '+94 78 247 0168',
      link: 'tel:+94782470168',
      icon: Phone,
      bg: '#EFF6FF',
      color: '#2563EB',
      border: '#bfdbfe'
    },
    {
      name: 'WhatsApp Merchant Community',
      description: 'Join Shopbook retailers, share tips, and get updates',
      value: 'Join Group Chat',
      link: 'https://chat.whatsapp.com/K1L9uB8c2470168',
      icon: Users,
      bg: '#FAF5FF',
      color: '#8B5CF6',
      border: '#e9d5ff'
    }
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="var(--yellow)" />
            <h3>Shopbook Support Portal</h3>
          </div>
          <button onClick={onClose} className="modal-close-btn"><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <p style={{ 
            fontSize: '13px', 
            color: 'var(--muted)', 
            lineHeight: '1.6', 
            margin: '0 0 20px 0', 
            textAlign: 'center' 
          }}>
            Need assistance with your Shopbook POS terminal? Get priority 24/7 support from our customer success engineers.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {contactOptions.map((opt, idx) => {
              const Icon = opt.icon;
              return (
                <a
                  key={idx}
                  href={opt.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="support-contact-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: `1.5px solid ${opt.border}`,
                    backgroundColor: '#ffffff',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: opt.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '14px',
                    flexShrink: 0
                  }}>
                    <Icon size={18} color={opt.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ 
                      fontSize: '13.5px', 
                      fontWeight: '800', 
                      color: 'var(--dark)', 
                      margin: 0 
                    }}>{opt.name}</h4>
                    <p style={{ 
                      fontSize: '11px', 
                      color: 'var(--muted)', 
                      margin: '2px 0 0 0',
                      lineHeight: '1.3'
                    }}>{opt.description}</p>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: opt.color,
                      marginTop: '4px'
                    }}>{opt.value}</span>
                  </div>
                  <ExternalLink size={14} color="var(--muted)" style={{ flexShrink: 0, marginLeft: '8px' }} />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
