const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/beds/BedManagement.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import { calculateInpatientIndicators } from '../../lib/dhis2Export';",
    "import { calculateInpatientIndicators } from '../../lib/dhis2Export';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  );
}

// 2. Add bedSuggestions useMemo
const stateAnchor = "const [search, setSearch] = useState('');";
const stateReplacement = `const [search, setSearch] = useState('');

  const bedSuggestions: SearchSuggestion[] = useMemo(() => {
    const list: SearchSuggestion[] = [];
    bedsList.forEach((b) => {
      if (b.patientName) {
        list.push({
          id: 'p-' + b.id,
          label: b.patientName,
          sub: b.code + ' · ' + b.ward + ' (' + (b.hospitalNumber || 'Inpatient') + ')',
          category: 'Patient',
          icon: BedDouble,
          onClick: () => setSearch(b.patientName || ''),
        });
      }
      list.push({
        id: 'b-' + b.id,
        label: b.code,
        sub: b.ward + ' · ' + b.status,
        category: 'Bed',
        icon: BedDouble,
        onClick: () => setSearch(b.code),
      });
    });
    wards.filter((w) => w !== 'All wards').forEach((w) => {
      list.push({
        id: 'w-' + w,
        label: w,
        category: 'Ward',
        onClick: () => { setFilterWard(w); setSearch(''); },
      });
    });
    return list;
  }, [bedsList, wards]);`;

if (!content.includes('bedSuggestions')) {
  content = content.replace(stateAnchor, stateReplacement);
}

// 3. Replace the input
const inputRegex = /<div style=\{\{\s*position:\s*'relative',\s*flex:\s*1,\s*minWidth:\s*180\s*\}\}>[\s\S]*?<input[\s\S]*?placeholder="Search bed, patient, ward…"[\s\S]*?\/>\s*<\/div>/;

const inputReplacement = `<div style={{ flex: 1, minWidth: 220 }}>
          <InteractiveSearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            placeholder="Search bed, patient, ward…"
            suggestions={bedSuggestions}
            resultsCount={filtered.length}
            totalCount={bedsList.length}
            size="sm"
            aria-label="Search bed census"
          />
        </div>`;

if (inputRegex.test(content)) {
  content = content.replace(inputRegex, inputReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('BedManagement search bar updated!');

