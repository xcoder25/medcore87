const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function walk(dir, files = []) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      walk(full, files);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(srcDir);
console.log(`Scanning ${files.length} TypeScript files for search inputs...\n`);

const searchInputs = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  // Check for input tags with search in placeholder or name or class
  const regex = /<input[^>]*placeholder=["'][^"']*[Ss]earch[^"']*["'][^>]*>|<input[\s\S]{1,250}?placeholder=["'][^"']*[Ss]earch[^"']*["'][\s\S]{0,100}?>/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const rel = path.relative(srcDir, file);
    const lineNum = content.slice(0, match.index).split(/\r?\n/).length;
    // Check if within SearchablePatientSelect or InteractiveSearchBar
    if (rel.includes('InteractiveSearchBar') || rel.includes('SearchablePatientSelect')) {
      continue;
    }
    searchInputs.push({ file: rel, line: lineNum, text: match[0].replace(/\s+/g, ' ').trim() });
  }
}

console.log(`Found ${searchInputs.length} search input elements:\n`);
searchInputs.forEach((s, idx) => {
  console.log(`${idx + 1}. [${s.file}:${s.line}]\n   ${s.text}\n`);
});

