'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, Plus, Check, X, Trash2, Search, Sliders,
  Sparkles, Layers, RotateCcw, AlertCircle, CheckCircle2,
  Lock, Building2, UserCheck
} from 'lucide-react';
import {
  MODULE_CATALOG,
  listConfigurableRoles,
  getRolePermissionsMap,
  setRoleModule,
  createCustomRole,
  deleteCustomRole,
  applyRoleModules,
  type CustomRoleDefinition,
} from '../../lib/rolePermissionsStore';

interface Props {
  facilityId: string;
  facilityName?: string;
  onRoleCreated?: (roleKey: string) => void;
}

const TEMPLATES: Record<string, { label: string; modules: string[] }> = {
  empty: { label: 'Start with Blank Permissions', modules: ['dashboard', 'my-card'] },
  doctor: {
    label: 'Clone from Doctor (Full Clinical & EMR)',
    modules: [
      'dashboard', 'doctor-portal', 'emr', 'triage', 'emergency', 'nursing', 'maternity',
      'paediatrics', 'icu', 'theatre', 'pharmacy', 'laboratory', 'radiology', 'ophthalmology',
      'fluid-balance', 'consent-legal', 'patient.identity', 'patient.vitals', 'patient.allergies',
      'patient.problems', 'patient.notes', 'patient.meds', 'patient.labs', 'patient.imaging',
      'patient.procedures', 'patient.full_chart', 'patient.consents', 'patient.eye_records',
      'patient.fluid_charts', 'appointments', 'patient-flow', 'ai', 'my-card',
    ],
  },
  nurse: {
    label: 'Clone from Nurse (Ward, Vitals & Fluid Balance)',
    modules: [
      'dashboard', 'triage', 'nursing', 'beds', 'icu', 'emergency', 'maternity',
      'fluid-balance', 'consent-legal', 'patient.identity', 'patient.vitals', 'patient.allergies',
      'patient.notes', 'patient.meds', 'patient.fluid_charts', 'patient.consents',
      'patient-flow', 'appointments', 'my-card',
    ],
  },
  allied: {
    label: 'Clone from Allied Health & Diagnostics',
    modules: [
      'dashboard', 'emr', 'laboratory', 'radiology', 'blood-bank', 'ophthalmology',
      'patient.identity', 'patient.vitals', 'patient.labs', 'patient.imaging',
      'patient.eye_records', 'patient-flow', 'my-card',
    ],
  },
  finance: {
    label: 'Clone from Finance & Revenue Desk',
    modules: [
      'dashboard', 'cashier', 'billing', 'akwaremit', 'claims', 'revenue-cycle',
      'patient.identity', 'patient.demographics', 'patient.billing', 'patient.insurance',
      'patient-flow', 'my-card',
    ],
  },
};

export const RoleMatrixManager: React.FC<Props> = ({
  facilityId,
  facilityName = 'Hospital Facility',
  onRoleCreated,
}) => {
  const [roles, setRoles] = useState(listConfigurableRoles());
  const [permissionsMap, setPermissionsMap] = useState(getRolePermissionsMap());
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');

  // Create Role Drawer / Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newDepartment, setNewDepartment] = useState('Clinical Services');
  const [newClearance, setNewClearance] = useState(3);
  const [selectedTemplate, setSelectedTemplate] = useState('doctor');
  const [selectedModules, setSelectedModules] = useState<string[]>(TEMPLATES.doctor.modules);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Sync state on external update
  const reload = () => {
    setRoles(listConfigurableRoles());
    setPermissionsMap(getRolePermissionsMap());
  };

  useEffect(() => {
    const onCustom = () => reload();
    const onPerms = () => reload();
    window.addEventListener('medcore-custom-roles-updated', onCustom);
    window.addEventListener('medcore-role-permissions', onPerms);
    return () => {
      window.removeEventListener('medcore-custom-roles-updated', onCustom);
      window.removeEventListener('medcore-role-permissions', onPerms);
    };
  }, []);

  // Auto-generate roleKey when title changes
  const handleTitleChange = (val: string) => {
    setNewTitle(val);
    const slug = val
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    setNewRoleKey(slug);
  };

  const handleApplyTemplate = (tplKey: string) => {
    setSelectedTemplate(tplKey);
    const tpl = TEMPLATES[tplKey];
    if (tpl) {
      setSelectedModules([...tpl.modules]);
    }
  };

  const handleToggleModuleInCreate = (modKey: string) => {
    if (selectedModules.includes(modKey)) {
      setSelectedModules(selectedModules.filter((m) => m !== modKey));
    } else {
      setSelectedModules([...selectedModules, modKey]);
    }
  };

  const handleCreateRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const title = newTitle.trim();
    const key = newRoleKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (!title) {
      setCreateError('Please enter a Role Display Name.');
      return;
    }
    if (!key) {
      setCreateError('Please enter a valid Role Identifier (slug).');
      return;
    }

    const newRoleDef: CustomRoleDefinition = {
      roleKey: key,
      label: title,
      shortRole: title.slice(0, 14),
      title: title,
      clearanceLevel: Number(newClearance) || 3,
      clearanceLabel: `Level ${newClearance} Clearance`,
      department: newDepartment,
      group: 'Custom',
      isCustom: true,
    };

    const ok = createCustomRole(newRoleDef, selectedModules);
    if (!ok) {
      setCreateError(`A role with identifier "${key}" already exists. Please choose another name.`);
      return;
    }

    setCreateSuccess(`Role "${title}" (${key}) created and provisioned successfully!`);
    reload();
    onRoleCreated?.(key);

    setTimeout(() => {
      setShowCreateModal(false);
      setCreateSuccess(null);
      setNewTitle('');
      setNewRoleKey('');
    }, 1200);
  };

  const handleDeleteRole = (roleKey: string, roleLabel: string) => {
    if (!window.confirm(`Are you sure you want to delete custom role "${roleLabel}"? Any enrolled staff with this role will revert to baseline permissions.`)) {
      return;
    }
    deleteCustomRole(roleKey);
    reload();
  };

  const handleToggleMatrixCell = (roleKey: string, moduleKey: string) => {
    const curMods = permissionsMap[roleKey] || [];
    const isEnabled = curMods.includes(moduleKey);
    setRoleModule(roleKey, moduleKey, !isEnabled);
    reload();
  };

  // Filter module catalog
  const filteredModules = useMemo(() => {
    return MODULE_CATALOG.filter((m) => {
      const matchSearch =
        m.label.toLowerCase().includes(search.toLowerCase()) ||
        m.key.toLowerCase().includes(search.toLowerCase()) ||
        m.group.toLowerCase().includes(search.toLowerCase());
      const matchGroup = selectedGroup === 'All' || m.group === selectedGroup;
      return matchSearch && matchGroup;
    });
  }, [search, selectedGroup]);

  // Filter roles displayed
  const displayedRoles = useMemo(() => {
    if (selectedRoleFilter === 'all') return roles;
    if (selectedRoleFilter === 'custom') return roles.filter((r) => r.isCustom);
    return roles.filter((r) => r.roleKey === selectedRoleFilter);
  }, [roles, selectedRoleFilter]);

  const groups = ['All', 'Clinical', 'Patient data', 'Operations', 'Finance', 'Facilities', 'Governance', 'Admin'];

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22, boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 16, marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Sliders size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
              Hospital Role Visibility & Permission Matrix
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span>{facilityName}</span>
              <span>•</span>
              <span>{roles.length} Roles Configured ({roles.filter((r) => r.isCustom).length} Custom)</span>
              <span>•</span>
              <span style={{ color: '#0052D4', fontWeight: 600 }}>Realtime Access Gate</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setCreateSuccess(null);
            setShowCreateModal(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(90deg, #0052D4 0%, #00BFA5 100%)',
            color: '#0A2540',
            fontSize: '0.86rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0, 82, 212, 0.25)',
          }}
        >
          <Plus size={18} />
          <span>Create New Hospital Role</span>
        </button>
      </div>

      {/* Filter Ribbon: Search + Category + Role Focus */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clinical tools, patient scopes, or modules (e.g. ophthalmology, vitals, cashier)…"
              style={{
                width: '100%',
                height: 40,
                padding: '0 14px 0 38px',
                borderRadius: 10,
                border: '1.5px solid #E2E8F0',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 12 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748B' }}>Focus Role:</span>
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            style={{ height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600, color: '#0F172A' }}
          >
            <option value="all">All Roles ({roles.length})</option>
            <option value="custom">Only Custom Roles ({roles.filter((r) => r.isCustom).length})</option>
            {roles.map((r) => (
              <option key={r.roleKey} value={r.roleKey}>
                {r.label} {r.isCustom ? '★ Custom' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Module Group Filter Pills */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, marginBottom: 14 }}>
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setSelectedGroup(g)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: selectedGroup === g ? '#0052D4' : '#F1F5F9',
              color: selectedGroup === g ? '#FFFFFF' : '#475569',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {g} {g === 'All' ? `(${MODULE_CATALOG.length})` : ''}
          </button>
        ))}
      </div>

      {/* Live Matrix Grid Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#0F172A', color: '#FFFFFF', textAlign: 'left' }}>
              <th style={{ padding: '12px 14px', minWidth: 260, borderRight: '1px solid #334155' }}>
                Tool / Module / Data Scope
              </th>
              <th style={{ padding: '12px 10px', minWidth: 90, borderRight: '1px solid #334155', textAlign: 'center' }}>
                Category
              </th>
              {displayedRoles.map((r) => (
                <th
                  key={r.roleKey}
                  style={{
                    padding: '12px 8px',
                    minWidth: 100,
                    maxWidth: 140,
                    textAlign: 'center',
                    borderRight: '1px solid #334155',
                    verticalAlign: 'top',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 }}>
                    {r.isCustom && (
                      <span style={{ fontSize: '0.62rem', background: '#00BFA5', color: '#0A2540', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                        CUSTOM
                      </span>
                    )}
                    <span style={{ fontSize: '0.64rem', opacity: 0.8 }}>
                      L{r.clearanceLevel || 3}
                    </span>
                    {r.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(r.roleKey, r.label)}
                        title="Delete custom role"
                        style={{ border: 'none', background: 'transparent', color: '#F87171', cursor: 'pointer', padding: 0 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredModules.map((m, i) => (
              <tr
                key={m.key}
                style={{
                  background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  transition: 'background 0.1s ease',
                }}
              >
                <td style={{ padding: '9px 14px', borderRight: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: 700, color: '#0F172A' }}>{m.label}</div>
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontFamily: 'var(--os-font-mono, monospace)' }}>
                    id: {m.key}
                  </div>
                </td>
                <td style={{ padding: '9px 10px', borderRight: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: m.group === 'Clinical' ? '#E0F2FE' : m.group === 'Patient data' ? '#FEF3C7' : m.group === 'Finance' ? '#DCFCE7' : '#F1F5F9',
                      color: m.group === 'Clinical' ? '#0369A1' : m.group === 'Patient data' ? '#92400E' : m.group === 'Finance' ? '#15803D' : '#475569',
                    }}
                  >
                    {m.group}
                  </span>
                </td>

                {displayedRoles.map((r) => {
                  const roleMods = permissionsMap[r.roleKey] || [];
                  const isEnabled = roleMods.includes(m.key) || (roleMods.includes('*') && r.roleKey === 'hospital_admin');

                  return (
                    <td
                      key={r.roleKey}
                      style={{
                        padding: '9px 8px',
                        borderRight: '1px solid #E2E8F0',
                        textAlign: 'center',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleMatrixCell(r.roleKey, m.key)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: isEnabled ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                          background: isEnabled ? '#F0FDF4' : '#FFFFFF',
                          color: isEnabled ? '#16A34A' : '#CBD5E1',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isEnabled ? '0 1px 4px rgba(22, 163, 74, 0.15)' : 'none',
                        }}
                        title={`${isEnabled ? 'Revoke' : 'Grant'} ${m.label} for ${r.label}`}
                      >
                        {isEnabled ? <Check size={16} strokeWidth={3} /> : <X size={14} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE NEW ROLE MODAL */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#FFFFFF',
              borderRadius: 18,
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 14, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#0052D4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                    Create New Healthcare Role
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                    Define an upcoming hospital role and select its permitted clinical tools & data scopes.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ border: 'none', background: '#F1F5F9', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div style={{ display: 'flex', gap: 8, padding: 10, borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: '0.82rem', marginBottom: 14 }}>
                <AlertCircle size={16} />
                <span>{createError}</span>
              </div>
            )}

            {createSuccess && (
              <div style={{ display: 'flex', gap: 8, padding: 10, borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', fontSize: '0.82rem', marginBottom: 14 }}>
                <CheckCircle2 size={16} color="#16A34A" />
                <span>{createSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateRoleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Role Title / Display Name *
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. Ophthalmic Surgeon / Dialysis Specialist"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: '0.88rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Role Key / Slug *
                  </label>
                  <input
                    type="text"
                    value={newRoleKey}
                    onChange={(e) => setNewRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    placeholder="e.g. ophthalmic_surgeon"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: '0.84rem', fontFamily: 'var(--os-font-mono, monospace)', background: '#F8FAFC' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Department Assignment
                  </label>
                  <select
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
                  >
                    <option value="Clinical Services">Clinical Services (Physicians / Surgeons)</option>
                    <option value="Nursing Services">Nursing & Inpatient Wards</option>
                    <option value="Surgical Specialties">Operating Theatres & Surgical Units</option>
                    <option value="Diagnostics & LIS">Laboratory & Pathology</option>
                    <option value="Radiology & Imaging">Radiology / PACS</option>
                    <option value="Pharmacy Services">Pharmacy & Medical Store</option>
                    <option value="Allied Health">Allied Health (Ophth, Rehab, Dental, Dialysis)</option>
                    <option value="Front Desk & HIM">Front Desk, HIM & Patient Records</option>
                    <option value="Finance & Revenue">Finance, Billing & AkwaRemit</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Clearance Level
                  </label>
                  <select
                    value={newClearance}
                    onChange={(e) => setNewClearance(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
                  >
                    <option value={1}>Level 1: Basic View / Auxiliary</option>
                    <option value={2}>Level 2: Front Desk / Administrative</option>
                    <option value={3}>Level 3: Clinical Care / Prescribing Practitioner</option>
                    <option value={4}>Level 4: Surgical Lead / Senior Consultant</option>
                    <option value={5}>Level 5: Facility Administrator / Medical Director</option>
                  </select>
                </div>
              </div>

              {/* Quick Template Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Quick Start: Clone From Template
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                  {Object.entries(TEMPLATES).map(([k, t]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleApplyTemplate(k)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: selectedTemplate === k ? '1.5px solid #0052D4' : '1px solid #E2E8F0',
                        background: selectedTemplate === k ? '#EFF6FF' : '#FFFFFF',
                        color: selectedTemplate === k ? '#0052D4' : '#475569',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular Tool Checklist */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                    Permitted Tools & Patient Scopes ({selectedModules.length} selected)
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setSelectedModules(MODULE_CATALOG.map((m) => m.key))}
                      style={{ border: 'none', background: 'transparent', color: '#0052D4', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedModules(['dashboard', 'my-card'])}
                      style={{ border: 'none', background: 'transparent', color: '#64748B', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    maxHeight: 220,
                    overflowY: 'auto',
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    padding: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                    background: '#F8FAFC',
                  }}
                >
                  {MODULE_CATALOG.map((m) => {
                    const checked = selectedModules.includes(m.key);
                    return (
                      <label
                        key={m.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: checked ? '#FFFFFF' : 'transparent',
                          border: checked ? '1px solid #BAE6FD' : '1px solid transparent',
                          fontSize: '0.76rem',
                          cursor: 'pointer',
                          color: checked ? '#0F172A' : '#64748B',
                          fontWeight: checked ? 700 : 500,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleModuleInCreate(m.key)}
                          style={{ accentColor: '#0052D4', cursor: 'pointer' }}
                        />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: 10,
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(90deg, #0052D4 0%, #00BFA5 100%)',
                    color: '#0A2540',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 82, 212, 0.28)',
                  }}
                >
                  Save & Provision Role to Matrix
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleMatrixManager;

