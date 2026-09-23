'use client';

import React, { useState } from 'react';
import { HospitalMessage, INITIAL_MESSAGES } from '../../data/hospitalData';
import {
  MessageSquare, Send, Users, ShieldAlert, CheckCheck,
  Search, PhoneCall, AlertTriangle
} from 'lucide-react';

interface MessagesHubProps {
  onNavigate?: (module: string, param?: any) => void;
}

export const MessagesHub: React.FC<MessagesHubProps> = ({ onNavigate }) => {
  const [messages, setMessages] = useState<HospitalMessage[]>(INITIAL_MESSAGES);
  const [activeChannel, setActiveChannel] = useState<string>('Emergency Team');
  const [newMsgText, setNewMsgText] = useState('');

  const channels = [
    { name: 'Emergency Team', icon: AlertTriangle, unread: 1, desc: 'A&E Resuscitation & Trauma triage team' },
    { name: 'Inpatient Wards Handover', icon: Users, unread: 1, desc: 'Ward nursing & medical handover coordination' },
    { name: 'Pharmacy Direct', icon: MessageSquare, unread: 1, desc: 'Medication verification & pneumatic dispatch' },
    { name: 'Lab Critical Alerts', icon: ShieldAlert, unread: 0, desc: 'Urgent critical lab values escalation' },
  ];

  const channelMessages = messages.filter(m => m.channel === activeChannel);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsgText.trim()) return;

    const newMsg: HospitalMessage = {
      id: `MSG-${Date.now().toString().slice(-4)}`,
      sender: 'Dr. Adewale Bello',
      senderRole: 'Consultant Physician',
      avatarInitials: 'AB',
      channel: activeChannel,
      text: newMsgText.trim(),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      unread: false,
    };

    setMessages([...messages, newMsg]);
    setNewMsgText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, color: '#0A2540' }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0D223A 0%, #163A60 100%)',
        borderRadius: 14, padding: '18px 22px', border: '1px solid #1E446B',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={24} color="#1A6EB5" />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Clinical Team Communications</h1>
          </div>
          <p style={{ margin: '3px 0 0', color: '#94A8BE', fontSize: '0.85rem' }}>
            Encrypted clinician-to-clinician messaging, emergency trauma alerts & inter-departmental broadcasts
          </p>
        </div>
      </div>

      {/* Main Messaging Interface */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, height: 600 }}>
        {/* Left: Channel List */}
        <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94A8BE', textTransform: 'uppercase', marginBottom: 6 }}>
            Clinical Communication Channels
          </div>

          {channels.map(ch => {
            const isSelected = ch.name === activeChannel;
            return (
              <div
                key={ch.name}
                onClick={() => setActiveChannel(ch.name)}
                style={{
                  padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  background: isSelected ? 'rgba(26,110,181,0.25)' : 'transparent',
                  border: isSelected ? '1px solid #1A6EB5' : '1px solid transparent',
                  display: 'flex', flexDirection: 'column', gap: 4, transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ch.icon size={15} color={isSelected ? '#38BDF8' : '#94A8BE'} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? '#FFFFFF' : '#CBD5E1' }}>
                      {ch.name}
                    </span>
                  </div>
                  {ch.unread > 0 && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
                      background: '#1A6EB5', color: '#0A2540'
                    }}>
                      {ch.unread}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A8BE', paddingLeft: 23 }}>{ch.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Right: Message Stream & Composer */}
        <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Channel Header */}
          <div style={{
            background: '#0D223A', padding: '14px 20px', borderBottom: '1px solid #1E446B',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0A2540' }}>#{activeChannel}</h3>
              <div style={{ fontSize: '0.75rem', color: '#94A8BE', marginTop: 2 }}>
                Active team members on duty: 8 doctors • 14 nurses • 2 clinical pharmacists
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} /> Live Channel
            </div>
          </div>

          {/* Message Thread */}
          <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {channelMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94A8BE', fontSize: '0.85rem' }}>
                No messages yet in this channel. Send the first message below.
              </div>
            ) : (
              channelMessages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: '#1A6EB5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0
                  }}>
                    {msg.avatarInitials}
                  </div>
                  <div style={{ background: '#0D223A', border: '1px solid #1E446B', borderRadius: 10, padding: '10px 14px', maxWidth: '75%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0052D4' }}>{msg.sender}</span>
                      <span style={{ fontSize: '0.7rem', color: '#94A8BE' }}>({msg.senderRole})</span>
                      <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{msg.time}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Composer Form */}
          <form onSubmit={handleSend} style={{
            background: '#0D223A', padding: '12px 18px', borderTop: '1px solid #1E446B',
            display: 'flex', gap: 10, alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder={`Send message to #${activeChannel}...`}
              value={newMsgText}
              onChange={e => setNewMsgText(e.target.value)}
              style={{
                flex: 1, padding: '10px 14px', background: '#0A1929', border: '1px solid #1E446B',
                borderRadius: 8, color: '#0A2540', fontSize: '0.85rem', outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #1A6EB5, #00B4A6)', border: 'none',
                color: '#0A2540', padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <Send size={15} /> Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
