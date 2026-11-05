const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/finance/AkwaRemitRevenueSuite.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
content = content.replace(
  "import React, { useEffect, useMemo, useState } from 'react';",
  "import React, { useEffect, useMemo, useState } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
);

// 2. Add suggestions memo
content = content.replace(
  "const filteredPayments = useMemo(() => {",
  `const akwaSuggestions = useMemo<SearchSuggestion[]>(() => {
    return payments.slice(0, 30).map((p) => ({
      id: p.id,
      label: p.patientName,
      sub: \`\${p.receiptNo} · ₦\${p.amountNgn.toLocaleString()} · \${p.method}\`,
      category: p.remittanceStatus.toUpperCase(),
      badge: p.remittanceStatus === 'remitted' ? 'Remitted' : 'Pending',
      onClick: () => setSearch(p.patientName),
    }));
  }, [payments]);

  const filteredPayments = useMemo(() => {`
);

// 3. Replace search input div
const searchDivRegex = /<div\s*style=\{\{\s*position:\s*'relative',\s*display:\s*'flex',\s*alignItems:\s*'center',\s*\}\}>\s*<Search[\s\S]*?placeholder="Search receipt, patient, RRR, ref…"[\s\S]*?<\/div>/;

if (searchDivRegex.test(content)) {
  content = content.replace(
    searchDivRegex,
    `<div style={{ minWidth: 260, maxWidth: 360, flex: 1 }}>
                <InteractiveSearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search receipt, patient, RRR, ref…"
                  suggestions={akwaSuggestions}
                  size="sm"
                  themeColor="#0052D4"
                />
              </div>`
  );
  console.log('[OK] Replaced search bar in AkwaRemitRevenueSuite.tsx');
} else {
  console.warn('[WARN] Search div regex did not match in AkwaRemitRevenueSuite.tsx');
}

fs.writeFileSync(file, content, 'utf8');

