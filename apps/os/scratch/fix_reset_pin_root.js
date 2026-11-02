const fs = require('fs');
const filePath = 'apps/os/src/app/api/auth/reset-pin/route.ts';
let code = fs.readFileSync(filePath, 'utf8');

// 1. In lookup action: add root staff collection check
const lookupAnchor = `        if (!matchedStaff) {
          const facSnap = await adminDb.collection('facilities').doc(fidNorm).get();`;

const newLookupBlock = `        // Check root staff collection (written atomically during create)
        if (!matchedStaff && matchedBadge) {
          try {
            const rootSnap = await adminDb.collection('staff').doc(matchedBadge).get();
            if (rootSnap.exists) {
              matchedStaff = { badgeId: rootSnap.id, ...rootSnap.data() };
            }
          } catch { /* ignore */ }
        }

        if (!matchedStaff) {
          const facSnap = await adminDb.collection('facilities').doc(fidNorm).get();`;

if (code.includes(lookupAnchor)) {
  code = code.replace(lookupAnchor, newLookupBlock);
  console.log('✅ Added root staff collection lookup to reset-pin route');
} else {
  console.error('lookupAnchor not found');
}

// 2. In reset_pin action: update root staff doc and backfill metadata into facility doc if needed
const resetAnchor = `        // Update staff subcollection document
        const staffDocRef = adminDb.collection('facilities').doc(fidNorm).collection('staff').doc(badgeId);
        await staffDocRef.set(
          {
            pin: pinNorm,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );`;

const newResetBlock = `        // Update staff subcollection document
        const staffDocRef = adminDb.collection('facilities').doc(fidNorm).collection('staff').doc(badgeId);
        await staffDocRef.set(
          {
            pin: pinNorm,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Also update root staff collection and backfill profile metadata
        try {
          const rootRef = adminDb.collection('staff').doc(badgeId);
          const rSnap = await rootRef.get();
          if (rSnap.exists) {
            await rootRef.set({ pin: pinNorm, updatedAt: new Date().toISOString() }, { merge: true });
            const rData = rSnap.data() || {};
            await staffDocRef.set({
              fullName: rData.fullName || rData.name,
              name: rData.name || rData.fullName,
              role: rData.role || (badgeId.startsWith('AMC-') ? 'Hospital Administrator' : 'Staff'),
              roleKey: rData.roleKey || (badgeId.startsWith('AMC-') ? 'hospital_admin' : 'doctor'),
              clearanceLevel: rData.clearanceLevel || (badgeId.startsWith('AMC-') ? 5 : 3),
              clearanceLabel: rData.clearanceLabel || (badgeId.startsWith('AMC-') ? 'Administrator' : 'L3'),
              department: rData.department || 'Hospital Management',
              facilityId: rData.facilityId || facilityId,
              facilityName: rData.facilityName,
            }, { merge: true });
          } else if (badgeId.startsWith('AMC-')) {
            // Auto-heal admin profile metadata so it never defaults to HIM / records
            await staffDocRef.set({
              role: 'Hospital Administrator',
              roleKey: 'hospital_admin',
              clearanceLevel: 5,
              clearanceLabel: 'Administrator',
              department: 'Hospital Management',
            }, { merge: true });
          }
        } catch (rErr) {
          console.warn('[reset-pin] root staff backfill note:', rErr);
        }`;

if (code.includes(resetAnchor)) {
  code = code.replace(resetAnchor, newResetBlock);
  console.log('✅ Added root staff backfill to reset_pin action');
} else {
  console.error('resetAnchor not found');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated reset-pin/route.ts!');

