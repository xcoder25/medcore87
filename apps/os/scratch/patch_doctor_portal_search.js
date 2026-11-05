const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/dashboards/DoctorPortal.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import { SearchablePatientSelect } from '../common/SearchablePatientSelect';",
    "import { SearchablePatientSelect } from '../common/SearchablePatientSelect';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  );
}

// 2. Patch PatientsView (line ~515)
const patientsViewAnchor = `  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'inpatient' | 'outpatient' | 'critical'>('all');
  const [selected, setSelected] = useState<Patient | null>(null);`;

const patientsViewReplacement = `  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'inpatient' | 'outpatient' | 'critical'>('all');
  const [selected, setSelected] = useState<Patient | null>(null);

  const patientSuggestions: SearchSuggestion[] = useMemo(() => {
    return PATIENTS.map((p) => ({
      id: p.id,
      label: p.name,
      sub: p.id + ' · ' + p.diagnosis + (p.bed ? ' · Bed: ' + p.bed : ''),
      category: p.status.toUpperCase(),
      icon: Users,
      onClick: () => {
        setSearch(p.name);
        setSelected(p);
      },
    }));
  }, []);`;

if (!content.includes('patientSuggestions')) {
  content = content.replace(patientsViewAnchor, patientsViewReplacement);
}

// Replace the input in PatientsView
const pInputRegex = /<div style=\{\{\s*flex:\s*1,\s*position:\s*'relative',\s*minWidth:\s*200\s*\}\}>[\s\S]*?<input value=\{search\} onChange=\{e => setSearch\(e\.target\.value\)\} placeholder="Search patient name, MRN, diagnosis…"[\s\S]*?\/>\s*<\/div>/;

const pInputReplacement = `<div style={{ flex: 1, minWidth: 260 }}>
            <InteractiveSearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search patient name, MRN, diagnosis…"
              suggestions={patientSuggestions}
              resultsCount={filtered.length}
              totalCount={PATIENTS.length}
              size="sm"
              aria-label="Search patient roster"
            />
          </div>`;

if (pInputRegex.test(content)) {
  content = content.replace(pInputRegex, pInputReplacement);
}

// 3. Patch the registry search bar (line ~2476)
const rInputRegex = /<div style=\{\{\s*flex:\s*1,\s*position:\s*'relative',\s*minWidth:\s*200\s*\}\}>[\s\S]*?<input[\s\S]*?placeholder="Search name, hospital number…"[\s\S]*?\/>\s*<\/div>/;

const rInputReplacement = `<div style={{ flex: 1, minWidth: 260 }}>
          <InteractiveSearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            placeholder="Search name, hospital number…"
            resultsCount={rows.length}
            totalCount={registry.length}
            size="sm"
            aria-label="Search patient registry"
          />
        </div>`;

if (rInputRegex.test(content)) {
  content = content.replace(rInputRegex, rInputReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('DoctorPortal search bars updated!');

