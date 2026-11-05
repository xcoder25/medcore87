const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/clinical-core/EmergencyTriageSuite.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import type { EmergencyTriagePatient } from '@medcore/types';",
    "import type { EmergencyTriagePatient } from '@medcore/types';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  );
}

// 2. Add triageSuggestions hook
const stateAnchor = "const [search, setSearch] = useState('');";
const stateReplacement = `const [search, setSearch] = useState('');

  const triageSuggestions: SearchSuggestion[] = React.useMemo(() => {
    return patients.slice(0, 20).map((p) => ({
      id: p.id,
      label: p.patientName,
      sub: p.id + ' · ' + p.chiefComplaint + (p.assignedBay ? ' · ' + p.assignedBay : ''),
      category: 'ESI ' + p.esiLevel,
      icon: Activity,
      onClick: () => {
        setSearch(p.patientName);
        setSelectedId(p.id);
      },
    }));
  }, [patients]);`;

if (!content.includes('triageSuggestions')) {
  content = content.replace(stateAnchor, stateReplacement);
}

// 3. Replace the input
const searchWrapRegex = /<div className="os-search-wrap" style=\{\{\s*flex:\s*1,\s*minWidth:\s*200\s*\}\}>[\s\S]*?<input[\s\S]*?placeholder="Search emergency triage queue\.\.\."[\s\S]*?\/>\s*<\/div>/;

const searchWrapReplacement = `<div style={{ flex: 1, minWidth: 260 }}>
              <InteractiveSearchBar
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Search emergency triage queue..."
                suggestions={triageSuggestions}
                resultsCount={filteredPatients.length}
                totalCount={patients.length}
                size="sm"
                aria-label="Search emergency queue"
              />
            </div>`;

if (searchWrapRegex.test(content)) {
  content = content.replace(searchWrapRegex, searchWrapReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('EmergencyTriageSuite search bar updated!');

