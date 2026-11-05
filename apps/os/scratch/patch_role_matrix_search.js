const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/rbac/RoleMatrixManager.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import { MODULE_CATALOG,",
    "import { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';\nimport { MODULE_CATALOG,"
  );
}

// 2. Add moduleSuggestions hook
const stateAnchor = "const [search, setSearch] = useState('');";
const stateReplacement = `const [search, setSearch] = useState('');

  const moduleSuggestions: SearchSuggestion[] = useMemo(() => {
    return MODULE_CATALOG.slice(0, 30).map((m) => ({
      id: m.key,
      label: m.label,
      sub: m.desc,
      category: m.category.toUpperCase(),
      icon: Shield,
      onClick: () => setSearch(m.label),
    }));
  }, []);`;

if (!content.includes('moduleSuggestions')) {
  content = content.replace(stateAnchor, stateReplacement);
}

// 3. Replace the input
const searchDivRegex = /<div style=\{\{\s*position:\s*'relative',\s*width:\s*'100%'\s*\}\}>[\s\S]*?<input[\s\S]*?placeholder="Search clinical tools, patient scopes, or modules \(e\.g\. ophthalmology, vitals, cashier\)…"[\s\S]*?\/>[\s\S]*?<\/div>/;

const searchDivReplacement = `<InteractiveSearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            placeholder="Search clinical tools, patient scopes, or modules…"
            suggestions={moduleSuggestions}
            resultsCount={filteredModules.length}
            totalCount={MODULE_CATALOG.length}
            size="md"
            aria-label="Search workstation modules"
          />`;

if (searchDivRegex.test(content)) {
  content = content.replace(searchDivRegex, searchDivReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('RoleMatrixManager search bar updated!');

