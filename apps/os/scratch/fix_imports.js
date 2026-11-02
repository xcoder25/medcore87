/**
 * Fix: Add markVisitsPaidForPatient to the receptionOpsStore import in PosPaymentDesk.tsx
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  'c:\\Users\\Dell\\OneDrive\\Desktop\\medcore\\apps\\os\\src\\components\\cashier\\PosPaymentDesk.tsx'
);

let content = fs.readFileSync(filePath, 'utf8');

// The existing receptionOpsStore import block (lines 19-28)
// We need to add markVisitsPaidForPatient to it
const oldImport = `} from '../../lib/receptionOpsStore';`;
const newImport = `  markVisitsPaidForPatient,\n} from '../../lib/receptionOpsStore';`;

if (content.includes('markVisitsPaidForPatient,\n} from \'../../lib/receptionOpsStore\'')) {
  console.log('✅ markVisitsPaidForPatient already in import - nothing to do');
  process.exit(0);
}

if (!content.includes(oldImport)) {
  console.error('❌ Could not find receptionOpsStore closing import line');
  process.exit(1);
}

content = content.replace(oldImport, newImport);
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Added markVisitsPaidForPatient to receptionOpsStore import');

