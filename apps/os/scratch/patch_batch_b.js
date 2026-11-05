/**
 * Batch B Search Bar Interactive Upgrades
 * Files:
 * 1. EMRManager.tsx
 * 2. LabDeskHome.tsx
 * 3. PatientFlowVisibility.tsx
 * 4. FrontDeskWorkqueues.tsx
 * 5. StaffingOverview.tsx
 * 6. HospitalStaffTransfer.tsx
 * 7. NursingTriageStation.tsx
 * 8. PharmacyFormularyWorkspace.tsx
 * 9. AksEmlFormularyPanel.tsx
 * 10. LamisNdrSuite.tsx
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'src', 'components');

function replaceRegex(filePath, regex, replacement, desc) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!regex.test(content)) {
    console.warn(`  [WARN] ${desc || 'Pattern'} not found in ${path.basename(filePath)}`);
    return false;
  }
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  [OK] ${desc || 'Patched'} in ${path.basename(filePath)}`);
  return true;
}

// ─────────────────────────────────────────────────────────────
// 1. EMRManager.tsx
// ─────────────────────────────────────────────────────────────
{
  const f = path.join(BASE, 'gateway-modules', 'EMRManager.tsx');
  // Add import
  replaceRegex(
    f,
    /import React, { useState, useEffect, useMemo } from 'react';/,
    `import React, { useState, useEffect, useMemo } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';`,
    'Import InteractiveSearchBar'
  );

  // Add suggestions memo
  replaceRegex(
    f,
    /\/\/ Filtered Patients List\s*const filteredPatients = useMemo/,
    `const emrPatientSuggestions = useMemo<SearchSuggestion[]>(() => {
    return patients.map(p => ({
      id: p.id,
      label: p.name,
      sub: \`\${p.mrn} · \${p.ward} · \${p.blood || ''}\`,
      category: p.type === 'inpatient' ? 'Inpatient' : 'Outpatient',
      badge: p.status === 'critical' ? 'Critical' : undefined,
      onClick: () => {
        setSelectedPatientId(p.id);
        setPatientSearch('');
      },
    }));
  }, [patients]);

  // Filtered Patients List
  const filteredPatients = useMemo`,
    'Add emrPatientSuggestions'
  );

  // Replace input div
  replaceRegex(
    f,
    /<div style=\{\{\s*position:\s*'relative'\s*\}\}>\s*<Search[\s\S]*?placeholder="Search name, MRN, ward…"[\s\S]*?<\/div>/,
    `<InteractiveSearchBar
            value={patientSearch}
            onChange={setPatientSearch}
            placeholder="Search name, MRN, ward…"
            suggestions={emrPatientSuggestions}
            size="sm"
            themeColor="#0066FF"
          />`,
    'Replace patient search bar'
  );
}

// ─────────────────────────────────────────────────────────────
// 2. LabDeskHome.tsx
// ─────────────────────────────────────────────────────────────
{
  const f = path.join(BASE, 'dashboards', 'LabDeskHome.tsx');
  // Add import
  replaceRegex(
    f,
    /import React, { useState, useEffect, useMemo, useCallback } from 'react';/,
    `import React, { useState, useEffect, useMemo, useCallback } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';`,
    'Import InteractiveSearchBar'
  );

  // Add suggestions memo near filteredOrders
  replaceRegex(
    f,
    /const filteredOrders = useMemo\(\(\) => {/,
    `const labSearchSuggestions = useMemo<SearchSuggestion[]>(() => {
    return labOrders.slice(0, 30).map((o) => ({
      id: o.id,
      label: o.patientName,
      sub: \`\${o.orderName} · \${o.hospitalNumber || o.patientId} · \${o.status.toUpperCase()}\`,
      category: o.priority === 'stat' ? 'STAT' : o.priority === 'urgent' ? 'Urgent' : 'Routine',
      badge: o.status,
      onClick: () => setSearch(o.patientName),
    }));
  }, [labOrders]);

  const filteredOrders = useMemo(() => {`,
    'Add labSearchSuggestions'
  );

  // Replace search box
  replaceRegex(
    f,
    /\{\/\* Search Box \*\/\}\s*<div style=\{\{\s*display:\s*'flex',\s*alignItems:\s*'center'[\s\S]*?placeholder="Search patient, hospital no, test, barcode…"[\s\S]*?<\/div>/,
    `{/* Search Box */}
            <div style={{ minWidth: 280, flex: 1, maxWidth: 400 }}>
              <InteractiveSearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search patient, hospital no, test, barcode…"
                suggestions={labSearchSuggestions}
                size="sm"
                themeColor="#0891B2"
              />
            </div>`,
    'Replace lab search bar'
  );
}

// ─────────────────────────────────────────────────────────────
// 3. PatientFlowVisibility.tsx
// ─────────────────────────────────────────────────────────────
{
  const f = path.join(BASE, 'patient-flow', 'PatientFlowVisibility.tsx');
  replaceRegex(
    f,
    /import React, { useEffect, useMemo, useState } from 'react';/,
    `import React, { useEffect, useMemo, useState } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';`,
    'Import InteractiveSearchBar'
  );

  replaceRegex(
    f,
    /const filtered = useMemo\(\(\) => {/,
    `const flowSuggestions = useMemo<SearchSuggestion[]>(() => {
    return rows.slice(0, 30).map((r) => ({
      id: r.id,
      label: r.name,
      sub: \`\${r.hospitalNumber} · \${r.ward || 'General'} · \${r.stage}\`,
      category: r.stage.toUpperCase(),
      badge: r.priority === 'red' ? 'Urgent' : undefined,
      onClick: () => setSearch(r.name),
    }));
  }, [rows]);

  const filtered = useMemo(() => {`,
    'Add flowSuggestions'
  );

  replaceRegex(
    f,
    /<div className="os-search-wrap" style=\{\{\s*flex:\s*1\s*\}\}>[\s\S]*?placeholder="Search patient name or ID\.\.\."[\s\S]*?<\/div>/,
    `<div style={{ flex: 1 }}>
          <InteractiveSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search patient name or ID..."
            suggestions={flowSuggestions}
            size="sm"
            themeColor="#2563EB"
          />
        </div>`,
    'Replace flow search bar'
  );
}

// ─────────────────────────────────────────────────────────────
// 4. FrontDeskWorkqueues.tsx
// ─────────────────────────────────────────────────────────────
{
  const f = path.join(BASE, 'reception', 'FrontDeskWorkqueues.tsx');
  replaceRegex(
    f,
    /import React, { useCallback, useEffect, useMemo, useState } from 'react';/,
    `import React, { useCallback, useEffect, useMemo, useState } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';`,
    'Import InteractiveSearchBar'
  );

  replaceRegex(
    f,
    /const patientHits = useMemo\(\(\) => {/,
    `const frontDeskPatientSuggestions = useMemo<SearchSuggestion[]>(() => {
    return patientHits.map((p) => ({
      id: p.id,
      label: \`\${p.firstName} \${p.lastName}\`,
      sub: \`\${p.hospitalNumber} · \${p.phone || 'No phone'} · \${p.gender || ''}\`,
      category: 'Patient',
      onClick: () => {
        setSelectedPatient(p);
        setPatientQ('');
      },
    }));
  }, [patientHits]);

  const patientHits = useMemo(() => {`,
    'Add frontDeskPatientSuggestions'
  );

  replaceRegex(
    f,
    /<div style=\{\{\s*position:\s*'relative',\s*flex:\s*1,\s*minWidth:\s*200\s*\}\}>[\s\S]*?placeholder="Search name, hospital no, phone…"[\s\S]*?<\/div>/,
    `<div style={{ flex: 1, minWidth: 240 }}>
            <InteractiveSearchBar
              value={patientQ}
              onChange={setPatientQ}
              placeholder="Search name, hospital no, phone…"
              suggestions={frontDeskPatientSuggestions}
              size="sm"
              themeColor="#2563EB"
            />
          </div>`,
    'Replace FrontDesk patient search bar'
  );
}

// ─────────────────────────────────────────────────────────────
// 5. StaffingOverview.tsx
// ─────────────────────────────────────────────────────────────
{
  const f = path.join(BASE, 'staffing', 'StaffingOverview.tsx');
  replaceRegex(
    f,
    /import React, { useCallback, useEffect, useMemo, useState } from 'react';/,
    `import React, { useCallback, useEffect, useMemo, useState } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';`,
    'Import InteractiveSearchBar'
  );

  replaceRegex(
    f,
    /const filtered = useMemo\(\(\) => {/,
    `const staffingSuggestions = useMemo<SearchSuggestion[]>(() => {
    return staff.slice(0, 30).map((s) => ({
      id: s.id,
      label: s.name,
      sub: \`\${s.role.toUpperCase()} · Ward: \${s.ward} · Shift: \${s.shift}\`,
      category: s.status === 'on-duty' ? 'On Duty' : 'Off Duty',
      badge: s.status === 'on-duty' ? 'Online' : undefined,
      onClick: () => setSearch(s.name),
    }));
  }, [staff]);

  const filtered = useMemo(() => {`,
    'Add staffingSuggestions'
  );

  replaceRegex(
    f,
    /<div\s*style=\{\{\s*display:\s*'flex',\s*alignItems:\s*'center',\s*gap:\s*8,\s*padding:\s*'8px 12px',\s*borderRadius:\s*10,\s*border:\s*'1px solid #E2E8F0',[\s\S]*?placeholder="Search name, ID, ward…"[\s\S]*?<\/div>/,
    `<div style={{ flex: '1 1 240px' }}>
          <InteractiveSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search name, ID, ward…"
            suggestions={staffingSuggestions}
            size="sm"
            themeColor="#0052D4"
          />
        </div>`,
    'Replace Staffing search bar'
  );
}

// ─────────────────────────────────────────────────────────────
// 6. HospitalStaffTransfer.tsx
// ─────────────────────────────────────────────────────────────
{
  const f = path.join(BASE, 'staffing', 'HospitalStaffTransfer.tsx');
  replaceRegex(
    f,
    /import React, { useState, useEffect } from 'react';/,
    `import React, { useState, useEffect, useMemo } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';`,
    'Import InteractiveSearchBar'
  );

  replaceRegex(
    f,
    /const filteredStaff = staff\.filter/,
    `const transferSuggestions = useMemo<SearchSuggestion[]>(() => {
    return staff.slice(0, 30).map((s) => ({
      id: s.id,
      label: s.name,
      sub: \`\${s.role} · \${s.department} · \${s.hospitalName}\`,
      category: s.status,
      onClick: () => setSearch(s.name),
    }));
  }, [staff]);

  const filteredStaff = staff.filter`,
    'Add transferSuggestions'
  );

  replaceRegex(
    f,
    /<div style=\{\{\s*position:\s*'relative',\s*flex:\s*1,\s*minWidth:\s*220\s*\}\}>[\s\S]*?placeholder="Search staff by name, role, department…"[\s\S]*?<\/div>/,
    `<div style={{ flex: 1, minWidth: 260 }}>
              <InteractiveSearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search staff by name, role, department…"
                suggestions={transferSuggestions}
                size="sm"
                themeColor="#0052D4"
              />
            </div>`,
    'Replace Staff Transfer search bar'
  );
}

// ─────────────────────────────────────────────────────────────
// 7. NursingTriageStation.tsx
// ─────────────────────────────────────────────────────────────
{
  const f = path.join(BASE, 'clinical-core', 'NursingTriageStation.tsx');
  replaceRegex(
    f,
    /import React, { useState, useEffect, useMemo, useCallback } from 'react';/,
    `import React, { useState, useEffect, useMemo, useCallback } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';`,
    'Import InteractiveSearchBar'
  );

  replaceRegex(
    f,
    /const filteredQueue = useMemo\(\(\) => {/,
    `const triageSuggestions = useMemo<SearchSuggestion[]>(() => {
    return queue.slice(0, 30).map((v) => ({
      id: v.id,
      label: v.patientName,
      sub: \`\${v.hospitalNumber} · \${v.department || 'OPD'}\`,
      category: v.priority ? String(v.priority).toUpperCase() : 'WAITING',
      onClick: () => {
        setSearch(v.patientName);
        setSelectedId(v.id);
      },
    }));
  }, [queue]);

  const filteredQueue = useMemo(() => {`,
    'Add triageSuggestions'
  );

  replaceRegex(
    f,
    /\{\/\* Search Bar \*\/\}\s*<div style=\{\{\s*position:\s*'relative'\s*\}\}>[\s\S]*?placeholder="Search patient, hospital no\.\.\."[\s\S]*?<\/div>/,
    `{/* Search Bar */}
                <InteractiveSearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search patient, hospital no..."
                  suggestions={triageSuggestions}
                  size="sm"
                  themeColor="#059669"
                />`,
    'Replace Nursing Triage search bar'
  );
}

// ─────────────────────────────────────────────────────────────
// 8. PharmacyFormularyWorkspace.tsx
// ─────────────────────────────────────────────────────────────
{
  const f = path.join(BASE, 'pharmacy', 'PharmacyFormularyWorkspace.tsx');
  replaceRegex(
    f,
    /import React, { useMemo, useState } from 'react';/,
    `import React, { useMemo, useState } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';`,
    'Import InteractiveSearchBar'
  );

  replaceRegex(
    f,
    /const filtered = useMemo\(\(\) => {/,
    `const formularySuggestions = useMemo<SearchSuggestion[]>(() => {
    return drugs.slice(0, 35).map((d) => ({
      id: d.id,
      label: d.name,
      sub: \`\${d.strength} · \${d.form} · \${d.category}\`,
      category: d.category,
      badge: d.controlled ? 'Controlled' : undefined,
      onClick: () => setQ(d.name),
    }));
  }, [drugs]);

  const filtered = useMemo(() => {`,
    'Add formularySuggestions'
  );

  replaceRegex(
    f,
    /<div style=\{\{\s*flex:\s*1,\s*minWidth:\s*180,\s*position:\s*'relative'\s*\}\}>[\s\S]*?placeholder="Search medicine, generic, ATC category…"[\s\S]*?<\/div>/,
    `<div style={{ flex: 1, minWidth: 240 }}>
                  <InteractiveSearchBar
                    value={q}
                    onChange={setQ}
                    placeholder="Search medicine, generic, ATC category…"
                    suggestions={formularySuggestions}
                    size="sm"
                    themeColor="#0D9488"
                  />
                </div>`,
    'Replace Pharmacy Formulary search bar'
  );
}

// ─────────────────────────────────────────────────────────────
// 9. AksEmlFormularyPanel.tsx
// ─────────────────────────────────────────────────────────────
{
  const f = path.join(BASE, 'pharmacy', 'AksEmlFormularyPanel.tsx');
  replaceRegex(
    f,
    /import React, { useMemo, useState } from 'react';/,
    `import React, { useMemo, useState } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';`,
    'Import InteractiveSearchBar'
  );

  replaceRegex(
    f,
    /const rows = useMemo\(\(\) => searchEml\(audience, q, category\), \[audience, q, category\]\);/,
    `const emlMedicineSuggestions = useMemo<SearchSuggestion[]>(() => {
    return listEml(audience).slice(0, 35).map((m) => ({
      id: m.id || m.medicine,
      label: m.medicine,
      sub: \`\${m.form} · \${m.category}\`,
      category: m.category,
      badge: m.awareGroup ? m.awareGroup.toUpperCase() : undefined,
      onClick: () => setQ(m.medicine),
    }));
  }, [audience]);

  const rows = useMemo(() => searchEml(audience, q, category), [audience, q, category]);`,
    'Add emlMedicineSuggestions'
  );

  replaceRegex(
    f,
    /<div style=\{\{\s*flex:\s*1,\s*minWidth:\s*200,\s*display:\s*'flex'[\s\S]*?placeholder="Search medicine, form, category…"[\s\S]*?<\/div>/,
    `<div style={{ flex: 1, minWidth: 240 }}>
          <InteractiveSearchBar
            value={q}
            onChange={setQ}
            placeholder="Search medicine, form, category…"
            suggestions={emlMedicineSuggestions}
            size="sm"
            themeColor="#0284C7"
          />
        </div>`,
    'Replace AksEml search bar'
  );
}

// ─────────────────────────────────────────────────────────────
// 10. LamisNdrSuite.tsx
// ─────────────────────────────────────────────────────────────
{
  const f = path.join(BASE, 'interop', 'LamisNdrSuite.tsx');
  replaceRegex(
    f,
    /import React, { useState, useMemo } from 'react';/,
    `import React, { useState, useMemo } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';`,
    'Import InteractiveSearchBar'
  );

  replaceRegex(
    f,
    /const filteredCohort = useMemo\(\(\) => {/,
    `const cohortSuggestions = useMemo<SearchSuggestion[]>(() => {
    return cohort.slice(0, 30).map((p) => ({
      id: p.id,
      label: p.fullName,
      sub: \`\${p.artNumber} · \${p.hospitalNumber} · \${p.currentRegimen}\`,
      category: p.artStatus.toUpperCase(),
      onClick: () => setSearch(p.fullName),
    }));
  }, [cohort]);

  const filteredCohort = useMemo(() => {`,
    'Add cohortSuggestions'
  );

  replaceRegex(
    f,
    /<div style=\{\{\s*position:\s*'relative',\s*width:\s*'100%'\s*\}\}>[\s\S]*?placeholder="Search by Patient Name, ART Unique ID, Hospital Number or NIN\.\.\."[\s\S]*?<\/div>/,
    `<div style={{ width: '100%' }}>
                <InteractiveSearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by Patient Name, ART Unique ID, Hospital Number or NIN..."
                  suggestions={cohortSuggestions}
                  size="sm"
                  themeColor="#0284C7"
                />
              </div>`,
    'Replace Lamis cohort search bar'
  );
}

console.log('\nBatch B execution finished.');

