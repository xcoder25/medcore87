const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/cashier/CashierRevenue.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'sub: (b.mrn || b.id)',
  'sub: (b.patientId || b.id)'
);

fs.writeFileSync(file, content, 'utf8');
console.log('[OK] Fixed CashierRevenue.tsx');

