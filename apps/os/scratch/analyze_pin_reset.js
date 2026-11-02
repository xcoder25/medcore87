/**
 * Fix 1: PIN Reset Bug
 * 
 * Problem A: When admin types their Badge ID in forgot-PIN lookup, 
 * the API lookup tries Firestore with the badge ID.
 * If the admin was created via /reg page, the staff doc key in Firestore is the badgeId 
 * (e.g., "AMC-2026-xxxx") but the query from reset-pin does normalizeBadgeId which 
 * uppercases and strips spaces. We need to also check the facilities collection 
 * for the admin's facilityId.
 * 
 * Problem B: After PIN reset, the session starts with HIM role because: 
 * - reset sets pin in local store  
 * - the forgot modal calls setUsername(badgeId) + setPassword(pin)
 * - but doesn't call handleSignIn, just auto-fills form
 * - When user then signs in, they get matched in the staffRegistry where the 
 *   local copy might have incorrect roleKey
 *
 * Root cause: The "Facility Admin" is stored with roleKey='hospital_admin' 
 * but when the forgot-password flow merges into local store, the role info 
 * might be lost or the inferRoleKey falls through to 'records' ('HIM').
 * 
 * Fix: In handleResetPinSubmit, after saving PIN, ensure the staffRegistry 
 * local copy retains the correct roleKey from the lookup result.
 * Also fix: the forgot lookup should fall back to checking admin-specific 
 * localStorage keys used during enrollment.
 */

const fs = require('fs');
const path = 'apps/os/src/components/auth/AuthScreen.tsx';
let code = fs.readFileFile(path, 'utf8');

