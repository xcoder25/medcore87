const fs = require('fs');
const path = require('path');

// ─── 1. PosPaymentDesk: add markVisitsPaidForPatient import + call it after cash ───
const posPath = path.join(__dirname, '../src/components/cashier/PosPaymentDesk.tsx');
let pos = fs.readFileSync(posPath, 'utf8');

// Add markVisitsPaidForPatient to the receptionOpsStore import
pos = pos.replace(
  /import \{([^}]+markPatientOutstandingPaid[^}]+)\} from '\.\.\/\.\.\/lib\/receptionOpsStore';/,
  (match, inner) => {
    if (inner.includes('markVisitsPaidForPatient')) return match;
    return match.replace('markPatientOutstandingPaid', 'markPatientOutstandingPaid,\n  markVisitsPaidForPatient');
  }
);

// After releaseOrdersForPatient call, also mark visits paid
pos = pos.replace(
  /releaseOrdersForPatient\(facilityId, patient\.id\);/,
  `releaseOrdersForPatient(facilityId, patient.id);
      // Auto-mark all visits for this patient as paid — no manual step needed
      try { markVisitsPaidForPatient(facilityId, patient.id); } catch { /* ignore */ }`
);

// In the ceremony phase transition (3s timer), also mark visits paid for cash
// Already handled above. But also at the ceremony 'receipt' text make it clear
pos = pos.replace(
  /Bill marked paid · returning to desk…/,
  'Bill auto-marked paid · returning to desk…'
);

fs.writeFileSync(posPath, pos, 'utf8');
console.log('✅ PosPaymentDesk fixed: auto markVisitsPaidForPatient on cash');

// ─── 2. AuthScreen: remove tab switcher, default to badge-only ───
const authPath = path.join(__dirname, '../src/components/auth/AuthScreen.tsx');
let auth = fs.readFileSync(authPath, 'utf8');

// Change default authMode to 'badge'
auth = auth.replace(
  `useState<'email' | 'badge'>('email')`,
  `useState<'email' | 'badge'>('badge')`
);

// Replace the whole tab-switcher block (grid with Admin/Staff buttons) with nothing
// The block starts with the role="tablist" div and ends before the error message block
// We'll identify it by its aria-label and replace with a simple "Staff Sign-In" subtitle
const tablistStart = `          {/* Admin vs Staff mode — clear for every user */}`;
const tablistEnd   = `          {/* Error Message */}`;

const tablistStartIdx = auth.indexOf(tablistStart);
const tablistEndIdx   = auth.indexOf(tablistEnd);

if (tablistStartIdx !== -1 && tablistEndIdx !== -1) {
  const before = auth.slice(0, tablistStartIdx);
  const after  = auth.slice(tablistEndIdx);
  auth = before +
    `          {/* Badge-only sign-in — no tab switcher */}\n\n          ` +
    after;
  console.log('✅ AuthScreen: tab switcher removed');
} else {
  console.warn('⚠️  Tab switcher block not found — check markers');
}

// Update subtitle to always show badge message (not conditional)
auth = auth.replace(
  `{authMode === 'badge'\r\n              ? 'Staff sign-in — Staff ID / badge and PIN'\r\n              : 'Admin sign-in — work email and password'}`,
  `'Sign in with your Staff Badge ID and PIN'`
);
auth = auth.replace(
  `{authMode === 'badge'\n              ? 'Staff sign-in — Staff ID / badge and PIN'\n              : 'Admin sign-in — work email and password'}`,
  `'Sign in with your Staff Badge ID and PIN'`
);

// Also update placeholder to always badge placeholder
auth = auth.replace(
  `placeholder={authMode === 'badge' ? 'Staff ID / badge number' : 'Admin work email'}`,
  `placeholder="Staff ID / Badge number (e.g. AKS-2025-1234)"`
);
auth = auth.replace(
  `placeholder={authMode === 'badge' ? 'Staff PIN' : 'Admin password'}`,
  `placeholder="Staff PIN (4–6 digits)"`
);

fs.writeFileSync(authPath, auth, 'utf8');
console.log('✅ AuthScreen: badge-only login done');

console.log('\nAll fixes applied. Run: npx tsc --noEmit');

