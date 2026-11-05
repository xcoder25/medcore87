const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/gateway-modules/AppointmentsManager.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import { SearchablePatientSelect, formatPatientName } from '../common/SearchablePatientSelect';",
    "import { SearchablePatientSelect, formatPatientName } from '../common/SearchablePatientSelect';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  );
}

// 2. Add apptSuggestions hook
const stateAnchor = "const [searchQuery, setSearchQuery] = useState('');";
const stateReplacement = `const [searchQuery, setSearchQuery] = useState('');

  const apptSuggestions: SearchSuggestion[] = React.useMemo(() => {
    return appointments.slice(0, 25).map((a) => ({
      id: a.id,
      label: a.patientName,
      sub: a.time + ' · ' + a.doctorName + ' · ' + a.type,
      category: a.status.toUpperCase(),
      icon: Calendar,
      onClick: () => setSearchQuery(a.patientName),
    }));
  }, [appointments]);`;

if (!content.includes('apptSuggestions')) {
  content = content.replace(stateAnchor, stateReplacement);
}

// 3. Replace the input
const searchDivRegex = /<div style=\{\{\s*display:\s*'flex',\s*alignItems:\s*'center',\s*gap:\s*10,\s*flex:\s*1,\s*minWidth:\s*260,\s*background:\s*'#0A1929'[\s\S]*?<input[\s\S]*?placeholder="Search appointment by patient name or type\.\.\."[\s\S]*?\/>\s*<\/div>/;

const searchDivReplacement = `<div style={{ flex: 1, minWidth: 260 }}>
          <InteractiveSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder="Search appointment by patient name or type..."
            suggestions={apptSuggestions}
            resultsCount={filteredAppointments.length}
            totalCount={appointments.length}
            size="sm"
            aria-label="Search appointments"
          />
        </div>`;

if (searchDivRegex.test(content)) {
  content = content.replace(searchDivRegex, searchDivReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('AppointmentsManager search bar updated!');

