const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/finance/AkwaRemitRevenueSuite.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace the duplicate akwaSuggestions
const dup = `  const akwaSuggestions = useMemo<SearchSuggestion[]>(() => {
    return payments.slice(0, 30).map((p) => ({
      id: p.id,
      label: p.patientName,
      sub: \`\${p.receiptNo} · ₦\${p.amountNgn.toLocaleString()} · \${p.method}\`,
      category: p.remittanceStatus.toUpperCase(),
      badge: p.remittanceStatus === 'remitted' ? 'Remitted' : 'Pending',
      onClick: () => setSearch(p.patientName),
    }));
  }, [payments]);\n\n`;

const normContent = content.replace(/\r\n/g, '\n');
const normDup = dup.replace(/\r\n/g, '\n');

if (normContent.includes(normDup)) {
  const fixed = normContent.replace(normDup, '');
  fs.writeFileSync(file, fixed, 'utf8');
  console.log('[OK] Removed duplicate akwaSuggestions in AkwaRemitRevenueSuite.tsx');
} else {
  console.warn('[WARN] Duplicate akwaSuggestions pattern not found');
}

