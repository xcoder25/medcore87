const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/finance/AkwaRemitRevenueSuite.tsx');
let content = fs.readFileSync(file, 'utf8');

const targetStr = `<div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search size={14} style={{ position: 'absolute', left: 10, color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search receipt, patient, RRR, ref…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    padding: '7px 12px 7px 32px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                    width: 240,
                  }}
                />
              </div>`;

// Normalize \r\n to \n
const normContent = content.replace(/\r\n/g, '\n');
const normTarget = targetStr.replace(/\r\n/g, '\n');

if (normContent.includes(normTarget)) {
  const replaced = normContent.replace(
    normTarget,
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
  fs.writeFileSync(file, replaced, 'utf8');
  console.log('[OK] Successfully replaced search bar in AkwaRemitRevenueSuite.tsx');
} else {
  console.warn('[WARN] normTarget still not found');
}

