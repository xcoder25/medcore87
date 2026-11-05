const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/clinical-core/PharmacyDispensingSuite.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import type { PrescriptionOrder, FormularyItem } from '@medcore/types';",
    "import type { PrescriptionOrder, FormularyItem } from '@medcore/types';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  );
}

// 2. Add pharmacySuggestions hook
const stateAnchor = "const [search, setSearch] = useState('');";
const stateReplacement = `const [search, setSearch] = useState('');

  const pharmacySuggestions: SearchSuggestion[] = React.useMemo(() => {
    const list: SearchSuggestion[] = [];
    if (activeTab === 'queue') {
      queue.slice(0, 25).forEach((q) => {
        list.push({
          id: q.id,
          label: q.patientName,
          sub: q.hospitalNumber + ' · ' + q.drugName + ' (' + q.dosage + ')',
          category: 'QUEUE',
          icon: Pill,
          onClick: () => setSearch(q.patientName),
        });
      });
    } else {
      formulary.slice(0, 25).forEach((f) => {
        list.push({
          id: f.id,
          label: f.brandName,
          sub: f.genericName + ' · ' + f.strength + ' · Stock: ' + f.stock,
          category: 'FORMULARY',
          icon: Package,
          onClick: () => setSearch(f.brandName),
        });
      });
    }
    return list;
  }, [activeTab, queue, formulary]);`;

if (!content.includes('pharmacySuggestions')) {
  content = content.replace(stateAnchor, stateReplacement);
}

// 3. Replace the input
const searchWrapRegex = /\{activeTab !== 'scan' && \(\s*<div style=\{\{\s*display:\s*'flex'[\s\S]*?<input[\s\S]*?placeholder=\{activeTab === 'queue' \? 'Search patient, doctor, drug…' : 'Search medicine…'\}[\s\S]*?\/>\s*<\/div>\s*\)\}/;

const searchWrapReplacement = `{activeTab !== 'scan' && (
          <div style={{ minWidth: 260, margin: '4px 0' }}>
            <InteractiveSearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder={activeTab === 'queue' ? 'Search patient, doctor, drug…' : 'Search medicine…'}
              suggestions={pharmacySuggestions}
              resultsCount={filteredQueue.length}
              size="sm"
              aria-label="Search pharmacy records"
            />
          </div>
        )}`;

if (searchWrapRegex.test(content)) {
  content = content.replace(searchWrapRegex, searchWrapReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('PharmacyDispensingSuite search bar updated!');

