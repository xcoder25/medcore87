const fs = require('fs');
const filePath = 'apps/os/src/lib/staffCardStore.ts';
let code = fs.readFileSync(filePath, 'utf8');

const target = "ADM: 'hospital_admin', HOS: 'hospital_admin', BIO: 'biomedical'";
const replacement = "ADM: 'hospital_admin', HOS: 'hospital_admin', AMC: 'hospital_admin', BIO: 'biomedical'";

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('✅ Added AMC: hospital_admin to badgeMap in staffCardStore.ts');
} else {
  console.error('Target not found in staffCardStore.ts');
}

