/**
 * Fix remaining finalPhoto || undefined in AccessControl.tsx (lines 687, 705, 726)
 */
const fs = require('fs');

const filePath = 'c:\\Users\\Dell\\OneDrive\\Desktop\\medcore\\apps\\os\\src\\components\\rbac\\AccessControl.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Count remaining bare finalPhoto: finalPhoto, usages (not already || undefined)
const beforeCount = (content.match(/photoUrl: finalPhoto(?! \|\|)/g) || []).length;
console.log(`Found ${beforeCount} remaining bare "photoUrl: finalPhoto" patterns`);

// Replace all remaining bare finalPhoto references (not followed by || or ;)
content = content.replace(/photoUrl: finalPhoto(?! \|\|)([,\r\n}])/g, 'photoUrl: finalPhoto || undefined$1');

const afterCount = (content.match(/photoUrl: finalPhoto \|\| undefined/g) || []).length;
console.log(`After fix: ${afterCount} "photoUrl: finalPhoto || undefined" patterns`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Done');

