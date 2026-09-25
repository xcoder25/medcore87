'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  User, 
  Building2, 
  ArrowRightLeft, 
  ShieldCheck, 
  FileText, 
  LayoutDashboard, 
  Users, 
  Calendar,
  Lock,
  Bed,
  Activity,
  ArrowRight
} from 'lucide-react';

export interface SearchResultItem {
  id: string;
  category: 'Staff' | 'Departments' | 'Transfers' | 'Roles' | 'Facilities' | 'Compliance' | 'Pages';
  title: string;
  subtitle?: string;
  action: () => void;
}

interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onOpenTransferReview?: (transferId: string) => void;
  onOpenStaffDetail?: (staffName: string) => void;
}

export const AdminCommandPalette: React.FC<AdminCommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenTransferReview,
  onOpenStaffDetail,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Master index of searchable entities
  const allItems: SearchResultItem[] = [
    // Staff
    {
      id: 'staff-1',
      category: 'Staff',
      title: 'Dr. Fatima Al-Hassan',
      subtitle: 'Senior Consultant Obstetrician · LUTH',
      action: () => {
        onOpenStaffDetail?.('Dr. Fatima Al-Hassan');
        onClose();
      }
    },
    {
      id: 'staff-2',
      category: 'Staff',
      title: 'Dr. Amara Okafor',
      subtitle: 'Chief Pediatric Surgeon · AKTH',
      action: () => {
        onOpenStaffDetail?.('Dr. Amara Okafor');
        onClose();
      }
    },
    {
      id: 'staff-3',
      category: 'Staff',
      title: 'Dr. Ibrahim Musa',
      subtitle: 'Head of Anesthesiology & ICU · UCH',
      action: () => {
        onOpenStaffDetail?.('Dr. Ibrahim Musa');
        onClose();
      }
    },
    {
      id: 'staff-4',
      category: 'Staff',
      title: 'Sarah Johnson',
      subtitle: 'HR Operations Manager · Administration',
      action: () => {
        onOpenStaffDetail?.('Sarah Johnson');
        onClose();
      }
    },
    {
      id: 'staff-5',
      category: 'Staff',
      title: 'Michael Okafor',
      subtitle: 'Chief Information Security Officer · IT Support',
      action: () => {
        onOpenStaffDetail?.('Michael Okafor');
        onClose();
      }
    },
    // Departments
    {
      id: 'dept-1',
      category: 'Departments',
      title: 'Nursing Department',
      subtitle: '34 active staff · 92% coverage',
      action: () => {
        onNavigate('staffing');
        onClose();
      }
    },
    {
      id: 'dept-2',
      category: 'Departments',
      title: 'Internal Medicine',
      subtitle: '14 active staff · 78% coverage',
      action: () => {
        onNavigate('staffing');
        onClose();
      }
    },
    {
      id: 'dept-3',
      category: 'Departments',
      title: 'Radiology & Imaging',
      subtitle: '11 active staff · 76% coverage',
      action: () => {
        onNavigate('staffing');
        onClose();
      }
    },
    {
      id: 'dept-4',
      category: 'Departments',
      title: 'General Surgery & Trauma',
      subtitle: '9 active staff · 71% coverage',
      action: () => {
        onNavigate('staffing');
        onClose();
      }
    },
    {
      id: 'dept-5',
      category: 'Departments',
      title: 'Pharmacy & Therapeutics',
      subtitle: '6 active staff · 68% coverage',
      action: () => {
        onNavigate('staffing');
        onClose();
      }
    },
    // Transfers
    {
      id: 'transfer-1',
      category: 'Transfers',
      title: 'Transfer #1024 — Dr. Fatima Al-Hassan',
      subtitle: 'LUTH → UCH · Awaiting Administrator Approval',
      action: () => {
        onOpenTransferReview?.('TRF-1024');
        onClose();
      }
    },
    {
      id: 'transfer-2',
      category: 'Transfers',
      title: 'Transfer #1021 — Dr. Amara Okafor',
      subtitle: 'AKTH → Ligh · Completed on 2026-09-01',
      action: () => {
        onOpenTransferReview?.('TRF-1021');
        onClose();
      }
    },
    // Roles
    {
      id: 'role-1',
      category: 'Roles',
      title: 'Hospital Administrator (Role)',
      subtitle: 'Full administrative rights across facility & identity',
      action: () => {
        onNavigate('access-control');
        onClose();
      }
    },
    {
      id: 'role-2',
      category: 'Roles',
      title: 'HR Manager & Staff Coordinator',
      subtitle: 'Roster scheduling, shift rotation & transfer requests',
      action: () => {
        onNavigate('access-control');
        onClose();
      }
    },
    // Facilities
    {
      id: 'fac-1',
      category: 'Facilities',
      title: 'Immanuel General Hospital, Eket',
      subtitle: 'Primary active facility · 87 active staff · Online',
      action: () => {
        onNavigate('dashboard');
        onClose();
      }
    },
    {
      id: 'fac-2',
      category: 'Facilities',
      title: 'University College Hospital (UCH), Ibadan',
      subtitle: 'Referral facility network partner',
      action: () => {
        onNavigate('facilities');
        onClose();
      }
    },
    // Compliance
    {
      id: 'comp-1',
      category: 'Compliance',
      title: 'Pharmacy Cold-Chain & Vaccine Audit',
      subtitle: 'Score: 94% · Passed · Re-audit due in 7 days',
      action: () => {
        onNavigate('compliance');
        onClose();
      }
    },
    {
      id: 'comp-2',
      category: 'Compliance',
      title: 'Fire Safety & Radiation Protection Certificate',
      subtitle: 'Radiology Wing · Expires in 21 days',
      action: () => {
        onNavigate('compliance');
        onClose();
      }
    },
    // Pages
    {
      id: 'page-1',
      category: 'Pages',
      title: 'Hospital Dashboard',
      subtitle: 'Main Administrator Workspace & KPI overview',
      action: () => {
        onNavigate('dashboard');
        onClose();
      }
    },
    {
      id: 'page-2',
      category: 'Pages',
      title: 'Hospital Staff Transfer',
      subtitle: 'Manage inter-facility physician and nursing transfers',
      action: () => {
        onNavigate('transfers');
        onClose();
      }
    },
    {
      id: 'page-3',
      category: 'Pages',
      title: 'Staffing & Rosters',
      subtitle: 'Department shift coverage, rotas and leave tracking',
      action: () => {
        onNavigate('staffing');
        onClose();
      }
    },
    {
      id: 'page-4',
      category: 'Pages',
      title: 'Staff Access Control & Security',
      subtitle: 'Identity lifecycle, roles, permissions and audits',
      action: () => {
        onNavigate('access-control');
        onClose();
      }
    },
    {
      id: 'page-5',
      category: 'Pages',
      title: 'Compliance & Audit',
      subtitle: 'Accreditation records, inspection ledger & statutory filings',
      action: () => {
        onNavigate('compliance');
        onClose();
      }
    },
    {
      id: 'page-6',
      category: 'Pages',
      title: 'Hospital Command Centre',
      subtitle: 'Real-time telemetry, bed tracking and patient flows',
      action: () => {
        onNavigate('command-centre');
        onClose();
      }
    },
  ];

  const filteredItems = query.trim() === ''
    ? allItems.slice(0, 10)
    : allItems.filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase()) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase()))
      );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  const getCategoryIcon = (category: SearchResultItem['category']) => {
    switch (category) {
      case 'Staff': return <User size={15} color="#38BDF8" />;
      case 'Departments': return <Users size={15} color="#00D4A8" />;
      case 'Transfers': return <ArrowRightLeft size={15} color="#F59E0B" />;
      case 'Roles': return <Lock size={15} color="#C084FC" />;
      case 'Facilities': return <Building2 size={15} color="#38BDF8" />;
      case 'Compliance': return <ShieldCheck size={15} color="#10B981" />;
      case 'Pages': return <LayoutDashboard size={15} color="#0066FF" />;
      default: return <FileText size={15} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ha-modal-backdrop" onClick={onClose}>
      <div 
        className="ha-modal-window" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640 }}
      >
        <div className="ha-palette-input-wrap">
          <Search size={18} color="#94A3B8" />
          <input
            ref={inputRef}
            type="text"
            className="ha-palette-input"
            placeholder="Type a command, staff name, transfer ID, or page..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="ha-palette-results">
          {filteredItems.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94A3B8' }}>
              <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#F8FAFC' }}>No results found for &ldquo;{query}&rdquo;</p>
              <p style={{ margin: 0, fontSize: '0.8rem' }}>Try searching for a staff member, department, role, or transfer ID.</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`ha-palette-item ${isSelected ? 'active' : ''}`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {getCategoryIcon(item.category)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF' }}>
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span style={{ fontSize: '0.72rem', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 9999,
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: '#94A3B8',
                      textTransform: 'uppercase'
                    }}>
                      {item.category}
                    </span>
                    <ArrowRight size={14} color="#64748B" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: '#64748B',
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span><kbd className="ha-kbd-badge">↑</kbd> <kbd className="ha-kbd-badge">↓</kbd> Navigate</span>
            <span><kbd className="ha-kbd-badge">↵</kbd> Select</span>
            <span><kbd className="ha-kbd-badge">esc</kbd> Close</span>
          </div>
          <span>MedCore Admin Fast Index</span>
        </div>
      </div>
    </div>
  );
};
