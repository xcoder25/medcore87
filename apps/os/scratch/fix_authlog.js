const fs = require('fs');
const p = 'c:\\Users\\Dell\\OneDrive\\Desktop\\medcore\\apps\\os\\src\\components\\auth\\AuthScreen.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  'authLog(`Staff PIN reset for ${badgeId} (${forgotLookupResult.name})`);',
  "authLog('sign_in_ok', { mode: 'badge', badgeId, facilityId });"
);

fs.writeFileSync(p, c, 'utf8');
console.log('✅ Fixed authLog call in AuthScreen.tsx');

