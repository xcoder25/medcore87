const fs = require('fs');
const path = require('path');

const searchInputs = [];

function scan(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) scan(full);
    else if (/\.tsx$/.test(f)) {
      const c = fs.readFileSync(full, 'utf8');
      const lines = c.split('\n');
      lines.forEach((l, idx) => {
        if (l.includes('placeholder=') && /search/i.test(l)) {
          searchInputs.push({ file: path.relative('apps/os/src', full), line: idx + 1, text: l.trim() });
        }
      });
    }
  }
}

scan('apps/os/src');
console.log('Total search inputs found:', searchInputs.length);
searchInputs.forEach(s => console.log(`${s.file}:${s.line} -> ${s.text}`));

