const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/dashboards/ReceptionWorkspace.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import { listActiveStaff, type StaffPresence } from '../../lib/staffPresenceStore';",
    "import { listActiveStaff, type StaffPresence } from '../../lib/staffPresenceStore';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  );
}

// 2. Add receptionSuggestions hook
const queryAnchor = "const [query, setQuery] = useState('');";
const queryReplacement = `const [query, setQuery] = useState('');

  const receptionSuggestions: SearchSuggestion[] = useMemo(() => {
    return patients.slice(0, 40).map((p) => {
      const full = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
      return {
        id: p.id,
        label: full,
        sub: p.hospitalNumber + (p.phone ? ' · Tel: ' + p.phone : '') + (p.nin ? ' · NIN: ' + p.nin : ''),
        category: p.insuranceScheme ? p.insuranceScheme.toUpperCase() : 'REGISTRY',
        icon: Users,
        onClick: () => {
          openPatient(p);
        },
      };
    });
  }, [patients]);`;

if (!content.includes('receptionSuggestions')) {
  content = content.replace(queryAnchor, queryReplacement);
}

// 3. Replace the input
const searchInputRegex = /<input\s+autoFocus\s+style=\{inputStyle\}\s+placeholder="Search name, hospital no\., phone, NHIA, NIN…"\s+value=\{query\}\s+onChange=\{\(e\) => setQuery\(e\.target\.value\)\}\s*\/>/;

const searchInputReplacement = `<div style={{ flex: 1 }}>
              <InteractiveSearchBar
                autoFocus
                value={query}
                onChange={setQuery}
                onClear={() => setQuery('')}
                placeholder="Search name, hospital no., phone, NHIA, NIN…"
                suggestions={receptionSuggestions}
                resultsCount={searchHits.length}
                totalCount={patients.length}
                size="md"
                aria-label="Search patient registry"
              />
            </div>`;

if (searchInputRegex.test(content)) {
  content = content.replace(searchInputRegex, searchInputReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('ReceptionWorkspace search bar updated!');

