const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/rbac/AccessControl.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import { getCustomRoles } from '../../lib/rolePermissionsStore';",
    "import { getCustomRoles } from '../../lib/rolePermissionsStore';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  );
}

// 2. Add staffSuggestions hook
const suggestionsAnchor = "const [search, setSearch] = useState('');";
const suggestionsReplacement = `const [search, setSearch] = useState('');

  const staffSuggestions: SearchSuggestion[] = useMemo(() => {
    return allStaff.slice(0, 30).map((s) => ({
      id: s.id,
      label: s.name,
      sub: s.badgeId + ' · ' + s.role + ' · ' + s.department,
      category: s.department.toUpperCase(),
      icon: Users,
      onClick: () => setSearch(s.name),
    }));
  }, [allStaff]);`;

if (!content.includes('staffSuggestions')) {
  content = content.replace(suggestionsAnchor, suggestionsReplacement);
}

// 3. Replace the input
const searchInputRegex = /<div style=\{\{\s*flex:\s*1,\s*display:\s*'flex',\s*alignItems:\s*'center',\s*gap:\s*8,\s*background:\s*'#F8FAFC',\s*border:\s*'1px solid #CBD5E1'[\s\S]*?<input[\s\S]*?placeholder="Search staff by name, role, department or badge ID…"[\s\S]*?<\/div>/;

const searchInputReplacement = `<div style={{ flex: 1, minWidth: 260 }}>
                <InteractiveSearchBar
                  value={search}
                  onChange={setSearch}
                  onClear={() => setSearch('')}
                  placeholder="Search staff by name, role, department or badge ID…"
                  suggestions={staffSuggestions}
                  resultsCount={filteredStaff.length}
                  totalCount={allStaff.length}
                  size="sm"
                  aria-label="Search staff directory"
                />
              </div>`;

if (searchInputRegex.test(content)) {
  content = content.replace(searchInputRegex, searchInputReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('AccessControl search bar updated!');

