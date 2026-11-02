const fs = require('fs');
const code = fs.readFileSync('apps/os/src/components/rbac/AccessControl.tsx', 'utf8');

const lines = code.split('\n');
console.log('Total lines:', lines.length);

lines.forEach((l, i) => {
  if (l.includes("useState<'directory' | 'enrol' | 'cards'>") || l.includes("activeTab === 'cards'") || (l.includes("setActiveTab") && l.includes("button"))) {
    console.log(`L${i+1}: ${l.trim()}`);
  }
});

