const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/patient-card/DigitalPatientCard.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import { emitLiveAction } from '../../lib/liveActions';",
    "import { emitLiveAction } from '../../lib/liveActions';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  );
}

// 2. Add patientSuggestions hook
const suggestionsAnchor = "const [search, setSearch] = useState('');";
const suggestionsReplacement = `const [search, setSearch] = useState('');

  const patientSuggestions: SearchSuggestion[] = useMemo(() => {
    return patients.slice(0, 30).map((p) => {
      const full = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
      return {
        id: p.id,
        label: full,
        sub: p.hospitalNumber + (p.phone ? ' · Tel: ' + p.phone : '') + (p.nin ? ' · NIN: ' + p.nin : ''),
        category: p.insuranceScheme ? p.insuranceScheme.toUpperCase() : 'PATIENT',
        icon: CreditCard,
        onClick: () => {
          setSelectedPatient(p);
          setSearch(full);
        },
      };
    });
  }, [patients]);`;

if (!content.includes('patientSuggestions')) {
  content = content.replace(suggestionsAnchor, suggestionsReplacement);
}

// 3. Replace the input
const searchInputRegex = /<div style=\{\{\s*display:\s*'flex',\s*alignItems:\s*'center',\s*gap:\s*8,\s*background:\s*'#F1F5F9'[\s\S]*?<input[\s\S]*?placeholder="Search name, SHID, hospital no, phone…"[\s\S]*?<\/div>/;

const searchInputReplacement = `<InteractiveSearchBar
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Search name, SHID, hospital no, phone…"
                suggestions={patientSuggestions}
                resultsCount={filtered.length}
                totalCount={patients.length}
                size="sm"
                aria-label="Search patient cards"
              />`;

if (searchInputRegex.test(content)) {
  content = content.replace(searchInputRegex, searchInputReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('DigitalPatientCard search bar updated!');

