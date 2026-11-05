const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/clinical-core/LaboratorySuite.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import type { LabOrder } from '@medcore/types';",
    "import type { LabOrder } from '@medcore/types';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  );
}

// 2. Add labSuggestions hook
const stateAnchor = "const [search, setSearch] = useState('');";
const stateReplacement = `const [search, setSearch] = useState('');

  const labSuggestions: SearchSuggestion[] = useMemo(() => {
    return orders.slice(0, 30).map((o) => ({
      id: o.id,
      label: o.patientName,
      sub: o.testName + ' · ' + o.barcode,
      category: o.status.toUpperCase(),
      icon: FlaskConical,
      onClick: () => setSearch(o.patientName),
    }));
  }, [orders]);`;

if (!content.includes('labSuggestions')) {
  content = content.replace(stateAnchor, stateReplacement);
}

// 3. Replace the input
const searchInputRegex = /<div style=\{\{\s*position:\s*'relative'\s*\}\}>[\s\S]*?<input value=\{search\} onChange=\{\(e\) => setSearch\(e\.target\.value\)\} placeholder="Patient, barcode, test…"[\s\S]*?\/>\s*<\/div>/;

const searchInputReplacement = `<div style={{ minWidth: 260 }}>
                <InteractiveSearchBar
                  value={search}
                  onChange={setSearch}
                  onClear={() => setSearch('')}
                  placeholder="Patient, barcode, test…"
                  suggestions={labSuggestions}
                  resultsCount={filtered.length}
                  totalCount={orders.length}
                  size="sm"
                  aria-label="Search laboratory worklist"
                />
              </div>`;

if (searchInputRegex.test(content)) {
  content = content.replace(searchInputRegex, searchInputReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('LaboratorySuite search bar updated!');

