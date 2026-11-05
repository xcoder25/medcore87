/**
 * Batch A: PatientsManager, ClinicalTasksManager, ReferralsManager, ConsultationsManager
 * Uses InteractiveSearchBar component with dark-panel theming tokens.
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'src', 'components');

function patch(filePath, transforms) {
  let src = fs.readFileSync(filePath, 'utf8');
  const original = src;
  for (const [from, to] of transforms) {
    if (src.includes(from)) {
      src = src.split(from).join(to);
    } else {
      console.warn(`  [WARN] Target not found in ${path.basename(filePath)}:\n    ${from.slice(0, 80)}`);
    }
  }
  if (src !== original) {
    fs.writeFileSync(filePath, src, 'utf8');
    console.log(`  [OK] Patched ${path.basename(filePath)}`);
  } else {
    console.log(`  [SKIP] No changes in ${path.basename(filePath)}`);
  }
}

// ───────────────────────────────────────────────
// 1. PatientsManager.tsx
// ───────────────────────────────────────────────
{
  const f = path.join(BASE, 'gateway-modules', 'PatientsManager.tsx');
  patch(f, [
    // Add useMemo import
    [
      "import React, { useState } from 'react';",
      "import React, { useState, useMemo } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
    ],
    // Remove Search from lucide imports (InteractiveSearchBar has its own)
    [
      "  Users, Search, Plus, Stethoscope, FileText, Pill,\n  BedDouble, AlertTriangle, CheckCircle2, ChevronRight, X, HeartPulse, UserPlus",
      "  Users, Plus, Stethoscope, FileText, Pill,\n  BedDouble, AlertTriangle, CheckCircle2, ChevronRight, X, HeartPulse, UserPlus"
    ],
    // Add suggestions memo after filteredPatients
    [
      "  const filteredPatients = patients.filter(p => {",
      `  const patientSuggestions = useMemo<SearchSuggestion[]>(() => [
    ...patients.map(p => ({
      id: p.id,
      label: p.name,
      sub: \`\${p.mrn} · \${p.ward} · \${p.status}\`,
      category: p.type === 'inpatient' ? 'Inpatient' : 'Outpatient',
      badge: p.status === 'critical' ? 'Critical' : undefined,
      onClick: () => setSearchQuery(p.name),
    })),
  ], [patients]);

  const filteredPatients = patients.filter(p => {`
    ],
    // Replace the dark search input div
    [
      `        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260, background: '#0A1929', padding: '8px 14px', borderRadius: 8, border: '1px solid #1E446B' }}>
          <Search size={16} color="#94A8BE" />
          <input
            type="text"
            placeholder="Search by patient name, MRN, ward, or diagnosis..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#0A2540', outline: 'none', width: '100%', fontSize: '0.85rem' }}
          />
        </div>`,
      `        <div style={{ flex: 1, minWidth: 260 }}>
          <InteractiveSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by patient name, MRN, ward, or diagnosis..."
            suggestions={patientSuggestions}
            size="sm"
            themeColor="#1A6EB5"
          />
        </div>`
    ],
  ]);
}

// ───────────────────────────────────────────────
// 2. ClinicalTasksManager.tsx
// ───────────────────────────────────────────────
{
  const f = path.join(BASE, 'gateway-modules', 'ClinicalTasksManager.tsx');
  patch(f, [
    [
      "import React, { useState } from 'react';",
      "import React, { useState, useMemo } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
    ],
    [
      "  ClipboardList, CheckCircle2, Clock, Plus, Search,\n  AlertTriangle, Check, X, Filter",
      "  ClipboardList, CheckCircle2, Clock, Plus,\n  AlertTriangle, Check, X, Filter"
    ],
    // Add suggestions before filteredTasks
    [
      "  const filteredTasks = tasks.filter(t => {",
      `  const taskSuggestions = useMemo<SearchSuggestion[]>(() => [
    ...tasks.map(t => ({
      id: t.id,
      label: t.task,
      sub: t.patient ? \`Patient: \${t.patient} · \${t.priority}\` : t.priority,
      category: t.role,
      badge: t.done ? 'Done' : t.priority === 'urgent' ? 'Urgent' : undefined,
      onClick: () => setSearchQuery(t.patient || t.task),
    })),
  ], [tasks]);

  const filteredTasks = tasks.filter(t => {`
    ],
    // Replace search input wrapper
    [
      `        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240, background: '#0A1929', padding: '8px 14px', borderRadius: 8, border: '1px solid #1E446B' }}>
          <Search size={16} color="#94A8BE" />
          <input
            type="text"
            placeholder="Search tasks or patient..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#0A2540', outline: 'none', width: '100%', fontSize: '0.85rem' }}
          />
        </div>`,
      `        <div style={{ flex: 1, minWidth: 240 }}>
          <InteractiveSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search tasks or patient..."
            suggestions={taskSuggestions}
            size="sm"
            themeColor="#1A6EB5"
          />
        </div>`
    ],
  ]);
}

// ───────────────────────────────────────────────
// 3. ReferralsManager.tsx
// ───────────────────────────────────────────────
{
  const f = path.join(BASE, 'gateway-modules', 'ReferralsManager.tsx');
  patch(f, [
    [
      "import React, { useState } from 'react';",
      "import React, { useState, useMemo } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
    ],
    [
      "  Send, Plus, Search, Building2, AlertTriangle, CheckCircle2,\n  Clock, X, ArrowUpRight, ArrowDownLeft, ShieldAlert",
      "  Send, Plus, Building2, AlertTriangle, CheckCircle2,\n  Clock, X, ArrowUpRight, ArrowDownLeft, ShieldAlert"
    ],
    [
      "  const filteredReferrals = referrals.filter(r => {",
      `  const referralSuggestions = useMemo<SearchSuggestion[]>(() => [
    ...referrals.map(r => ({
      id: r.id,
      label: r.patientName,
      sub: \`\${r.mrn} · \${r.specialty} · \${r.direction}\`,
      category: r.direction === 'inbound' ? 'Inbound' : 'Outbound',
      badge: r.priority === 'emergency' ? 'Emergency' : r.priority === 'urgent' ? 'Urgent' : undefined,
      onClick: () => setSearchQuery(r.patientName),
    })),
  ], [referrals]);

  const filteredReferrals = referrals.filter(r => {`
    ],
    [
      `        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260, background: '#0A1929', padding: '8px 14px', borderRadius: 8, border: '1px solid #1E446B' }}>
          <Search size={16} color="#94A8BE" />
          <input
            type="text"
            placeholder="Search by patient name, MRN, or specialty..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#0A2540', outline: 'none', width: '100%', fontSize: '0.85rem' }}
          />
        </div>`,
      `        <div style={{ flex: 1, minWidth: 260 }}>
          <InteractiveSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by patient name, MRN, or specialty..."
            suggestions={referralSuggestions}
            size="sm"
            themeColor="#00B4A6"
          />
        </div>`
    ],
  ]);
}

// ───────────────────────────────────────────────
// 4. ConsultationsManager.tsx — patient search (line ~153)
//    The drug search is already a custom dropdown, leave it.
// ───────────────────────────────────────────────
{
  const f = path.join(BASE, 'gateway-modules', 'ConsultationsManager.tsx');
  patch(f, [
    [
      "import React, { useState } from 'react';",
      "import React, { useState, useMemo } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
    ],
    [
      "  Stethoscope, Search, User, FileText, Pill, CheckCircle2,\n  AlertTriangle, Save, Trash2, Check, ShieldCheck, Clock, Plus, X",
      "  Stethoscope, User, FileText, Pill, CheckCircle2,\n  AlertTriangle, Save, Trash2, Check, ShieldCheck, Clock, Plus, X, Search"
    ],
    // Add patient suggestions memo after filteredPatientList
    [
      "  const filteredPatientList = patients.filter(p =>",
      `  const consultPatientSuggestions = useMemo<SearchSuggestion[]>(() => [
    ...patients.map(p => ({
      id: p.id,
      label: p.name,
      sub: \`\${p.mrn} · \${p.ward}\`,
      category: 'Patient',
      onClick: () => { setSelectedPatientId(p.id); setPatientSearch(''); },
    })),
  ], [patients]);

  const filteredPatientList = patients.filter(p =>`
    ],
    // Replace patient search input
    [
      `            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0A1929', padding: '6px 10px', borderRadius: 6, border: '1px solid #1E446B', marginBottom: 10 }}>
              <Search size={14} color="#94A8BE" />
              <input
                type="text"
                placeholder="Search patient..."
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#0A2540', outline: 'none', width: '100%', fontSize: '0.8rem' }}
              />
            </div>`,
      `            <div style={{ marginBottom: 10 }}>
              <InteractiveSearchBar
                value={patientSearch}
                onChange={setPatientSearch}
                placeholder="Search patient..."
                suggestions={consultPatientSuggestions}
                size="sm"
                themeColor="#1A6EB5"
              />
            </div>`
    ],
  ]);
}

console.log('\nBatch A done.');

