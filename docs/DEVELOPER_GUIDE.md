# MedCore OS — Developer Guide
**Version 2.0 · October 2026**

> Onboarding guide for engineers contributing to MedCore OS. Covers local setup, adding modules, extending the role system, writing stores, and contributing new features.

---

## 1. Getting Started

### Clone & Install
```bash
git clone https://github.com/your-org/medcore.git
cd medcore
npm install                     # installs all workspace dependencies
```

### Run in Development
```bash
# Terminal 1 — API/WebSocket backend
cd services/api-server && npm run dev

# Terminal 2 — MedCore OS
cd apps/os && npm run dev
# → http://localhost:3003
```

### TypeScript Check
```bash
cd apps/os && npx tsc --noEmit   # must be 0 errors before any PR
```

---

## 2. Project Conventions

| Convention | Standard |
|-----------|---------|
| Language | TypeScript (strict) — no `any` except in component prop adapters |
| Framework | Next.js 15, App Router |
| Styling | Inline `style={}` + CSS variables from `globals.css` |
| Icons | `lucide-react` only |
| State | Zustand stores in `src/lib/` |
| Components | Named exports only (no default exports except `page.tsx`) |
| File naming | PascalCase for components; camelCase for lib/store files |

---

## 3. Adding a New Module

**Step 1 — Create the component**
```bash
# Create the component file
touch apps/os/src/components/<pillar>/<ModuleName>.tsx
```

Component shell:
```tsx
'use client';

import React from 'react';
import type { UserSession } from '../auth/AuthScreen';

interface Props {
  session?: UserSession;
  onNavigate?: (module: string) => void;
  onClose?: () => void;
}

export const MyNewModule: React.FC<Props> = ({ session, onNavigate, onClose }) => {
  return (
    <div style={{ padding: '2rem', color: '#e2e8f0' }}>
      <h1>My New Module</h1>
    </div>
  );
};
```

**Step 2 — Register in `moduleRegistry.tsx`**
```typescript
// 1. Add dynamic import export
export const MyNewModule = dynamic(
  () => import('../components/<pillar>/MyNewModule').then(m => m.MyNewModule),
  { loading: () => <ModulePageLoader label="Opening My Module…" /> }
);

// 2. Add key to ModuleKey union (line ~92)
| 'my-module'

// 3. Add to MODULE_COMPONENTS record
'my-module': MyNewModule,

// 4. Add to MODULE_CLEARANCE record
'my-module': { level: 2, label: 'L2 Clinical', roleDesc: 'Description of who uses this' },
```

**Step 3 — Add to `roleNav.tsx`**
```typescript
// In the appropriate role case or MASTER_PILLARS section:
{ key: 'my-module', icon: SomeIcon, label: 'My Module Label', badge: 'Optional' },
```

**Step 4 — Verify**
```bash
cd apps/os && npx tsc --noEmit   # must remain 0 errors
```

---

## 4. Writing a Zustand Store

```typescript
// apps/os/src/lib/myFeatureStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MyRecord {
  id: string;
  facilityId: string;
  data: string;
  createdAt: string;
}

interface MyFeatureStore {
  records: MyRecord[];
  addRecord: (facilityId: string, data: string) => MyRecord;
  getByFacility: (facilityId: string) => MyRecord[];
  clear: () => void;
}

export const useMyFeatureStore = create<MyFeatureStore>()(
  persist(
    (set, get) => ({
      records: [],

      addRecord: (facilityId, data) => {
        const record: MyRecord = {
          id: `rec-${Date.now()}`,
          facilityId,
          data,
          createdAt: new Date().toISOString(),
        };
        set(state => ({ records: [...state.records, record] }));
        return record;
      },

      getByFacility: (facilityId) =>
        get().records.filter(r => r.facilityId === facilityId),

      clear: () => set({ records: [] }),
    }),
    { name: 'medcore-my-feature' }   // localStorage key
  )
);
```

### Pure (non-persisted) store for real-time data
```typescript
export const useMyFeatureStore = create<MyFeatureStore>()((set, get) => ({
  // … same body, no persist wrapper
}));
```

---

## 5. Role System

### inferRoleKey()
The `inferRoleKey(roleTitle, badgeId?)` function in `staffCardStore.ts` maps human-readable role titles to canonical role keys:

```typescript
inferRoleKey('Medical Officer')        // → 'doctor'
inferRoleKey('Senior Nursing Officer') // → 'nurse'
inferRoleKey('Pharmacist')            // → 'pharmacist'
inferRoleKey('Medical Laboratory Scientist') // → 'lab'
```

### Adding a new role
1. Add a case to the `switch` in `inferRoleKey()` in `staffCardStore.ts`
2. Add a `case 'new-role':` branch in `getRoleNavSections()` in `roleNav.tsx`
3. Return the appropriate `NavSection[]` array for that role's sidebar

---

## 6. Event Bus — LIVE Notifications

The `clinicalEventBus.ts` module implements an in-process pub/sub bus that bridges WebSocket events from the API to UI state:

```typescript
import { clinicalEventBus } from '../lib/clinicalEventBus';

// Subscribe to lab critical events
clinicalEventBus.on('LAB_CRITICAL', (event) => {
  useNotificationEngine.getState().addNotification({
    type: 'CRITICAL',
    title: `CRITICAL ${event.testName}`,
    body: `${event.value} ${event.unit} — ${event.patientName}`,
    patientId: event.patientId,
  });
});

// Emit an event
clinicalEventBus.emit('TRIAGE_SUBMITTED', { patientId, urgency: 'CRITICAL' });
```

**Standard event types:**
- `LAB_CRITICAL` · `LAB_RESULT_READY`
- `PRESCRIPTION_READY` · `DRUG_DISPENSED`
- `TRIAGE_SUBMITTED` · `PATIENT_ADMITTED` · `PATIENT_DISCHARGED`
- `BED_STATUS_CHANGED` · `STAFF_SHIFT_CHANGE`
- `DTN_PACKET_RECEIVED` · `SATELLITE_SYNC_COMPLETE`

---

## 7. Offline-First Development

When writing new features that must work offline:

```typescript
import { useConnectivityCircuitBreaker } from '../lib/connectivityCircuitBreaker';
import { durableOutbox } from '../lib/durableOutbox';

// Check connectivity before making API calls
const { isOnline, profile } = useConnectivityCircuitBreaker.getState();

if (isOnline) {
  await apiClient.post('/endpoint', data);
} else {
  // Queue for later delivery
  await durableOutbox.enqueue({
    endpoint: '/endpoint',
    method: 'POST',
    body: data,
    priority: 'HIGH',
  });
}
```

---

## 8. Clinical Google Search — Extending Patient Dossiers

**File:** `apps/os/src/lib/clinicalGoogleSearch.ts`

To add a new patient to the demo dossier, add an entry to `CLINICAL_DOSSIERS`:

```typescript
export const CLINICAL_DOSSIERS: PatientDossier[] = [
  // … existing patients
  {
    patientId: 'PAT-AKS-9999',
    fullName: 'John Doe',
    age: 45,
    bloodGroup: 'O+',
    allergies: ['Penicillin'],
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    labHistory: [
      {
        recordId: 'LAB-2024-001',
        date: '15-Mar-2024',
        testName: 'HbA1c',
        value: '8.2%',
        referenceRange: '< 6.5%',
        flag: 'HIGH',
        interpretation: 'Poor glycaemic control',
        reportedBy: 'Dr. E. Nwosu',
        facility: 'Ibom Specialist Hospital',
      }
    ],
    medicationHistory: [...],
    clinicalNotes: [...],
    procedures: [],
  }
];
```

To add a new query intent, extend the `queryClassifier()` function and add a corresponding synthesis branch.

---

## 9. Telehealth Mesh — Adding a Node

**File:** `apps/os/src/lib/telehealthMeshSync.ts`

```typescript
// Add to INITIAL_MESH_NODES array:
{
  nodeId: 'NODE-NEW-LGA-07',
  lga: 'New LGA Name',
  facilityName: 'New Facility Name',
  facilityType: 'Cottage Hospital',
  coordinates: { lat: 4.9876, lng: 7.4321 },
  status: 'ONLINE',
  rssiDb: -65,
  queuedDtnBundles: 0,
  vectorClock: 0,
  lastSyncAt: new Date().toISOString(),
  connectivityProfile: 'LAN_ONLY',
}
```

---

## 10. Testing

### TypeScript type-check
```bash
cd apps/os && npx tsc --noEmit
cd apps/care && npx tsc --noEmit
```

### Feature verification scripts
```bash
# Clinical Google Search + Telehealth Mesh tests
cd apps/os && npx tsx scratch/verify_features.ts

# AI Clinical Automations verification
cd apps/os && npx tsx scratch/verify_ai.ts
```

### Writing a new verification script
```typescript
// apps/os/scratch/verify_my_feature.ts

// 1. Mock browser APIs for Node
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: k => store.get(k)||null, setItem: (k,v) => store.set(k,v) };

// 2. Import your lib
import { myFunction } from '../src/lib/myFeatureStore';

// 3. Assert
const result = myFunction('arg');
if (!result.includes('expected')) throw new Error('Test failed: missing expected value');
console.log('✅ PASS: My feature works correctly');
```

---

## 11. Code Style Guidelines

```typescript
// ✅ Good: Named export, typed props
export const MyComponent: React.FC<Props> = ({ session, onClose }) => { … };

// ❌ Bad: Default export (confuses module registry)
export default function MyComponent() { … }

// ✅ Good: Explicit return type on lib functions
export function calculateNews2(vitals: VitalsRecord): number { … }

// ✅ Good: Const assertions for enums
const URGENCY = ['routine', 'urgent', 'critical'] as const;
type Urgency = typeof URGENCY[number];

// ✅ Good: Guard against undefined session
const facilityId = session?.facilityId ?? 'AKS-IBOM-SPECIALIST';
```

---

## 12. PR Checklist

Before opening a pull request:
- [ ] `npx tsc --noEmit` exits 0 in `apps/os`
- [ ] `npx tsc --noEmit` exits 0 in `apps/care` (if care was modified)
- [ ] New module added to all 4 registry locations (dynamic import, ModuleKey, MODULE_COMPONENTS, MODULE_CLEARANCE)
- [ ] New store uses `persist()` if data should survive refresh
- [ ] Event bus events documented in comment at top of file
- [ ] No hardcoded facility IDs in production code paths
- [ ] Console.log removed from production components
- [ ] Offline fallback written for any API calls

---

*MedCore OS Developer Guide v2.0 · October 2026 · Powered by M87*
