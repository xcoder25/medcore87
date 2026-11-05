const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/finance/AkwaRemitRevenueSuite.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('InteractiveSearchBar')) {
  content = content.replace(
    "import { Landmark,",
    "import { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';\nimport { Landmark,"
  );
}

// 2. Add akwaSuggestions hook
const stateAnchor = "const [search, setSearch] = useState('');";
const stateReplacement = `const [search, setSearch] = useState('');

  const akwaSuggestions: SearchSuggestion[] = useMemo(() => {
    return payments.slice(0, 30).map((p) => ({
      id: p.id,
      label: p.receiptNo + ' · ' + p.patientName,
      sub: '₦' + p.amountNgn.toLocaleString() + ' · ' + p.method + (p.paystackRef ? ' · ' + p.paystackRef : ''),
      category: p.remittanceStatus.toUpperCase(),
      icon: Landmark,
      onClick: () => setSearch(p.receiptNo),
    }));
  }, [payments]);`;

if (!content.includes('akwaSuggestions')) {
  content = content.replace(stateAnchor, stateReplacement);
}

// 3. Replace the input
const searchDivRegex = /<div\s+style=\{\{\s*position:\s*'relative',\s*display:\s*'flex',\s*alignItems:\s*'center',\s*\}\}>[\s\S]*?<input[\s\S]*?placeholder="Search receipt, patient, RRR, ref…"[\s\S]*?\/>\s*<\/div>/;

const searchDivReplacement = `<div style={{ width: 280, maxWidth: '100%' }}>
                <InteractiveSearchBar
                  value={search}
                  onChange={setSearch}
                  onClear={() => setSearch('')}
                  placeholder="Search receipt, patient, RRR, ref…"
                  suggestions={akwaSuggestions}
                  resultsCount={filteredPayments.length}
                  totalCount={payments.length}
                  size="sm"
                  aria-label="Search AkwaRemit state receipts"
                />
              </div>`;

if (searchDivRegex.test(content)) {
  content = content.replace(searchDivRegex, searchDivReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('AkwaRemitRevenueSuite search bar updated!');

