const fs = require('fs');
const path = require('path');

const file = 'c:/Users/Dell/OneDrive/Desktop/medcore/apps/os/src/components/auth/AuthScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove Claimed facility badge UI
content = content.replace(
  /\{isFacilityClaimed\(selectedHospital\.id\)\s*&&[\s\S]*?Claimed Hospital Station[\s\S]*?<\/div>\s*\)\}/g,
  ''
);

// 2. Remove isFacilityClaimed & setClaimedFacility imports
content = content.replace(
  "import { getClaimedFacilityId, setClaimedFacility, isFacilityClaimed } from '../../lib/onboardingStore';",
  "import { getClaimedFacilityId } from '../../lib/onboardingStore';"
);

// 3. Clean up badge auth error message
content = content.replace(
  ": 'This Staff ID is not enrolled at this hospital. Ask your hospital administrator to enrol you, or use work email for first-time facility setup.'",
  ": 'Incorrect Staff ID or PIN. Account not found at this facility.'"
);
content = content.replace(
  "'This Staff ID is not enrolled at this hospital. Ask your hospital administrator to enrol you, or use work email for first-time facility setup.'",
  "'Incorrect Staff ID or PIN. Account not found at this facility.'"
);

// 4. Clean up email sign-in logic:
// Find from "const facilityEmpty = !hasFacilityAdmin(effectiveHospital.id);" to "if (!matchedStaff) {"
const startMarker = 'const facilityEmpty = !hasFacilityAdmin(effectiveHospital.id);';
const endMarker = 'const sessionPin = String(matchedStaff.pin || pass || \'\');';

const sIdx = content.indexOf(startMarker);
const eIdx = content.indexOf(endMarker);

if (sIdx !== -1 && eIdx !== -1) {
  const replacement = `// 1) Firebase Auth required — sign in only (facility claim removed, use /reg for enrollment)
        let fbUser: import('firebase/auth').User | null = null;
        try {
          fbUser = await withTimeout(firebaseSignIn(email, pass), 10000);
        } catch (signInErr: unknown) {
          const _msg = classifyAuthError(signInErr, { accountKnown: false, mode: 'email' });
          authLog('sign_in_fail', {
            mode: 'email',
            facilityId: effectiveHospital.id,
            emailDomain: emailDomainOnly(email),
            code: String((signInErr as { code?: string })?.code || ''),
            reason: _msg
          });
          setError(_msg || 'Incorrect email or password. Please try again.');
          setLoading(false);
          return;
        }

        if (!fbUser) {
          setError('Incorrect email or password. Please try again.');
          setLoading(false);
          return;
        }

        // 2) Resolve enrolled staff by work email (cloud then local)
        let matchedStaff: PresetStaff | undefined;

        // Check local staff registry / cards first across facilities to detect correct facility
        try {
          let hit = findStaffByEmail(email, effectiveHospital.id);
          if (!hit) {
            const crossHit = findStaffByEmail(email);
            if (crossHit) {
              hit = crossHit;
              const hitFid = String(crossHit.hospitalId || crossHit.facilityId || '');
              const hospObj = HOSPITALS.find((h) => h.id.toUpperCase() === hitFid.toUpperCase());
              if (hospObj) {
                effectiveHospital = hospObj;
                setSelectedHospital(hospObj);
              }
            }
          }
          if (hit) {
            const bid = String(hit.badgeId || hit.id || '');
            const rk = inferRoleKey(String(hit.roleKey || hit.role || hit.title || ''), bid);
            matchedStaff = {
              badgeId: bid,
              name: String(hit.name || hit.fullName || email.split('@')[0]),
              role: String(hit.role || 'Staff'),
              shortRole: String(hit.shortRole || hit.role || 'Staff'),
              title: String(hit.title || hit.role || 'Staff'),
              roleKey: rk,
              clearanceLevel: Number(hit.clearanceLevel ?? 2),
              clearanceLabel: String(hit.clearanceLabel || 'L2'),
              department: String(hit.department || ''),
              initials: String(hit.initials || 'ST'),
              permissions: Array.isArray(hit.permissions) && hit.permissions.length > 0 ? hit.permissions : defaultPermissionsForRole(rk),
              pin: String(hit.pin || pass),
              hospitalId: hit.hospitalId || hit.facilityId || effectiveHospital.id,
              hospitalName: hit.hospitalName || hit.facilityName || effectiveHospital.name,
              color: '#0052D4',
            };
          }
        } catch { /* */ }

        // Cloud query (Firestore)
        if (!matchedStaff) {
          try {
            const { firestoreGetStaffByEmail } = await import('../../lib/firebase');
            const remote = await withTimeout(
              firestoreGetStaffByEmail(effectiveHospital.id, email),
              6000
            ).catch(() => null);
            if (remote && (remote.badgeId || remote.id)) {
              const bid = String(remote.badgeId || remote.id);
              const rk = inferRoleKey(String(remote.roleKey || remote.role || remote.title || ''), bid);
              matchedStaff = {
                badgeId: bid,
                name: String(remote.name || remote.fullName || email.split('@')[0]),
                role: String(remote.role || 'Staff'),
                shortRole: String(remote.shortRole || remote.role || 'Staff'),
                title: String(remote.title || remote.role || 'Staff'),
                roleKey: rk,
                clearanceLevel: Number(remote.clearanceLevel ?? 2),
                clearanceLabel: String(remote.clearanceLabel || 'L2'),
                department: String(remote.department || ''),
                initials: String(remote.initials || 'ST'),
                permissions: Array.isArray(remote.permissions) && remote.permissions.length > 0 ? remote.permissions : defaultPermissionsForRole(rk),
                pin: String(remote.pin || pass),
                hospitalId: effectiveHospital.id,
                hospitalName: effectiveHospital.name,
                color: '#0052D4',
              };
            }
          } catch { /* offline */ }
        }

        // Enforce revocation on matched staff
        if (matchedStaff) {
          if (isStaffRevokedLocal(matchedStaff.badgeId, matchedStaff.hospitalId || effectiveHospital.id)) {
            setError('This staff account has been deleted or revoked by an administrator. Sign-in is disabled.');
            setLoading(false);
            return;
          }
        }

        if (!matchedStaff) {
          setError('This account does not have a staff record registered for this facility. Please contact your administrator.');
          setLoading(false);
          return;
        }

        `;

  // Find the start of the block containing facilityOnboarded
  const blockStart = content.lastIndexOf('let facilityOnboarded = false;', sIdx);
  const actualStart = blockStart !== -1 ? blockStart : sIdx;

  content = content.slice(0, actualStart) + replacement + content.slice(eIdx);
  console.log('Replaced email sign-in logic successfully');
} else {
  console.error('Markers not found', { sIdx, eIdx });
}

fs.writeFileSync(file, content, 'utf8');
console.log('AuthScreen.tsx successfully updated');

