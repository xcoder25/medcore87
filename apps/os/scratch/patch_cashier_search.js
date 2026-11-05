const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/cashier/CashierRevenue.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import { listBillLines, subscribeBills } from '../../lib/patientBillingStore';",
    "import { listBillLines, subscribeBills } from '../../lib/patientBillingStore';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  );
}

// 2. Add cashierSuggestions hook
const stateAnchor = "const [search, setSearch] = useState('');";
const stateReplacement = `const [search, setSearch] = useState('');

  const cashierSuggestions: SearchSuggestion[] = useMemo(() => {
    return bills.slice(0, 30).map((b) => ({
      id: b.id,
      label: b.patientName,
      sub: (b.mrn || b.id) + ' · ₦' + b.totalNaira.toLocaleString() + ' · ' + (b.services?.join(', ') || 'Consultation'),
      category: b.status.toUpperCase(),
      icon: CreditCard,
      onClick: () => setSearch(b.patientName),
    }));
  }, [bills]);`;

if (!content.includes('cashierSuggestions')) {
  content = content.replace(stateAnchor, stateReplacement);
}

// 3. Replace the input
const searchWrapRegex = /<div className="os-search-wrap" style=\{\{\s*flex:\s*1,\s*minWidth:\s*220\s*\}\}>[\s\S]*?<input[\s\S]*?placeholder="Search patient, MRN or bill ID…"[\s\S]*?\/>\s*<\/div>/;

const searchWrapReplacement = `<div style={{ flex: 1, minWidth: 260 }}>
          <InteractiveSearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            placeholder="Search patient, MRN or bill ID…"
            suggestions={cashierSuggestions}
            resultsCount={filtered.length}
            totalCount={bills.length}
            size="sm"
            aria-label="Search patient bills and invoices"
          />
        </div>`;

if (searchWrapRegex.test(content)) {
  content = content.replace(searchWrapRegex, searchWrapReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('CashierRevenue search bar updated!');

