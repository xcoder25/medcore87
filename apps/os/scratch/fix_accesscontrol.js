/**
 * Fix AccessControl.tsx TypeScript errors:
 * - line 587: photoUrl: photoSnap  → photoUrl: photoSnap || undefined
 * - line 596: resolveStaffPhotoForEnrol returns string|null, not string|undefined
 * - line 633: photoUrl: finalPhoto → photoUrl: finalPhoto || undefined
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  'c:\\Users\\Dell\\OneDrive\\Desktop\\medcore\\apps\\os\\src\\components\\rbac\\AccessControl.tsx'
);

let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// Fix 1 — line ~587: photoUrl: photoSnap, (in prepareStaffEnrolment args)
// The prepareStaffEnrolment call sets photoUrl. photoSnap is string|null
// Need to cast null→undefined
const fix1Old = '        photoUrl: photoSnap,\n        email: mail || undefined,\n      });';
const fix1New = '        photoUrl: photoSnap || undefined,\n        email: mail || undefined,\n      });';
if (content.includes(fix1Old)) {
  content = content.replace(fix1Old, fix1New);
  console.log('✅ Fix 1 applied: photoSnap → photoSnap || undefined');
  changes++;
} else {
  console.log('⚠️  Fix 1 pattern not found — checking alternate');
  // Try simpler targeted replace
  const fix1OldAlt = '        photoUrl: photoSnap,\r\n        email: mail || undefined,\r\n      });';
  const fix1NewAlt = '        photoUrl: photoSnap || undefined,\r\n        email: mail || undefined,\r\n      });';
  if (content.includes(fix1OldAlt)) {
    content = content.replace(fix1OldAlt, fix1NewAlt);
    console.log('✅ Fix 1 (CRLF) applied');
    changes++;
  } else {
    console.log('❌ Fix 1 not applied');
  }
}

// Fix 2 — line ~596: resolveStaffPhotoForEnrol returns string|null
// cast the result to string|undefined
const fix2Old = '        finalPhoto = (await resolveStaffPhotoForEnrol(facilityId, badgeId, photoSnap)) || photoSnap;';
const fix2New = '        finalPhoto = (await resolveStaffPhotoForEnrol(facilityId, badgeId, photoSnap) as string | null) || photoSnap || null;';
// Actually the real fix is to handle the return type — check what finalPhoto is declared as
// Better: just cast at usage. The error is line 596:76 — argument type 
// resolveStaffPhotoForEnrol(facilityId, badgeId, photoSnap) — photoSnap is string|null but it expects string|undefined
const fix2AltOld = 'finalPhoto = (await resolveStaffPhotoForEnrol(facilityId, badgeId, photoSnap)) || photoSnap;';
const fix2AltNew = 'finalPhoto = (await resolveStaffPhotoForEnrol(facilityId, badgeId, photoSnap || undefined)) || photoSnap;';
if (content.includes(fix2AltOld)) {
  content = content.replace(fix2AltOld, fix2AltNew);
  console.log('✅ Fix 2 applied: photoSnap → photoSnap || undefined in function arg');
  changes++;
} else {
  console.log('❌ Fix 2 not applied');
}

// Fix 3 — line ~633: photoUrl: finalPhoto inside commitStaffEnrolment call
// finalPhoto is string|null, expects string|undefined
const fix3Old = '          photoUrl: finalPhoto,\n          email: mail || undefined,\n        },\n        card,\n        { ...prepared.entry, pin: pinNorm, email: mail || undefined, photoUrl: finalPhoto }';
const fix3New = '          photoUrl: finalPhoto || undefined,\n          email: mail || undefined,\n        },\n        card,\n        { ...prepared.entry, pin: pinNorm, email: mail || undefined, photoUrl: finalPhoto || undefined }';
if (content.includes(fix3Old)) {
  content = content.replace(fix3Old, fix3New);
  console.log('✅ Fix 3 applied: finalPhoto → finalPhoto || undefined in commitStaffEnrolment');
  changes++;
} else {
  // CRLF version
  const fix3OldCRLF = '          photoUrl: finalPhoto,\r\n          email: mail || undefined,\r\n        },\r\n        card,\r\n        { ...prepared.entry, pin: pinNorm, email: mail || undefined, photoUrl: finalPhoto }';
  const fix3NewCRLF = '          photoUrl: finalPhoto || undefined,\r\n          email: mail || undefined,\r\n        },\r\n        card,\r\n        { ...prepared.entry, pin: pinNorm, email: mail || undefined, photoUrl: finalPhoto || undefined }';
  if (content.includes(fix3OldCRLF)) {
    content = content.replace(fix3OldCRLF, fix3NewCRLF);
    console.log('✅ Fix 3 (CRLF) applied');
    changes++;
  } else {
    console.log('❌ Fix 3 pattern not found');
    // Try individual replacements
    // Just replace all occurrences of: photoUrl: finalPhoto, → photoUrl: finalPhoto || undefined,
    // Only where finalPhoto is not already || something
    const countBefore = (content.match(/photoUrl: finalPhoto,/g) || []).length;
    content = content.replace(/photoUrl: finalPhoto,/g, 'photoUrl: finalPhoto || undefined,');
    const countAfter = (content.match(/photoUrl: finalPhoto \|\| undefined,/g) || []).length;
    console.log(`✅ Fix 3 fallback: replaced ${countBefore} occurrences of "photoUrl: finalPhoto,"`);
    changes++;
    
    // Also fix photoUrl: finalPhoto in object spread at end
    content = content.replace(/photoUrl: finalPhoto\s*}/g, 'photoUrl: finalPhoto || undefined }');
    console.log('✅ Fix 3b fallback applied for object spread');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ Done — ${changes} fix(es) applied to AccessControl.tsx`);

