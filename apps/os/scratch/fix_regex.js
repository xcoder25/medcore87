const fs = require('fs');
const filePath = 'apps/os/src/app/page.tsx';
let code = fs.readFileSync(filePath, 'utf8');
code = code.replace(
  "replace(/ w/g, (c) => c.toUpperCase())",
  "replace(/\\b\\w/g, (c) => c.toUpperCase())"
);
fs.writeFileSync(filePath, code, 'utf8');
console.log('Fixed capitalize regex in page.tsx');

