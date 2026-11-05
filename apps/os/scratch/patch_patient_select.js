const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/common/SearchablePatientSelect.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add isHovered state
if (!content.includes('isHovered')) {
  content = content.replace(
    "const [highlightIndex, setHighlightIndex] = useState(0);",
    "const [highlightIndex, setHighlightIndex] = useState(0);\n  const [isHovered, setIsHovered] = useState(false);"
  );
}

// 2. Add onMouseEnter / onMouseLeave to the input container
content = content.replace(
  "style={{\n          display: 'flex',\n          alignItems: 'center',\n          position: 'relative',\n          width: '100%',\n        }}",
  `style={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          width: '100%',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}`
);

// 3. Update the input style for state transitions and glowing border
content = content.replace(
  "border: isOpen ? '1.5px solid #0052D4' : '1px solid #CBD5E1',",
  "border: isOpen ? '1.5px solid #0066FF' : isHovered ? '1.5px solid #94A3B8' : '1px solid #CBD5E1',"
);

content = content.replace(
  "boxShadow: isOpen ? '0 0 0 3px rgba(0, 82, 212, 0.12)' : 'none',",
  "boxShadow: isOpen ? '0 0 0 3.5px rgba(0, 102, 255, 0.16), 0 2px 8px rgba(0, 102, 255, 0.08)' : isHovered ? '0 2px 5px rgba(0, 0, 0, 0.04)' : 'none',\n            caretColor: '#0066FF',"
);

// 4. In the dropdown header, add live match count
const dropdownHeader = `<div
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 1000,
          background: '#FFFFFF',
          borderRadius: 12,
          border: '1px solid #E2E8F0',
          boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.18)',
          marginTop: 6,
          maxHeight: 320,
          overflowY: 'auto',
          padding: 6,
        }}
      >`;

const dropdownHeaderReplacement = `<div
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 1000,
          background: '#FFFFFF',
          borderRadius: 12,
          border: '1px solid #E2E8F0',
          boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.18)',
          marginTop: 6,
          maxHeight: 320,
          overflowY: 'auto',
          padding: 6,
          animation: 'slideDown 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {query.trim() && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px 8px', borderBottom: '1px solid #F1F5F9', marginBottom: 4 }}>
            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>SEARCH RESULTS</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: filteredPatients.length > 0 ? '#E0F2FE' : '#FEE2E2', color: filteredPatients.length > 0 ? '#0369A1' : '#B91C1C' }}>
              {filteredPatients.length} {filteredPatients.length === 1 ? 'match' : 'matches'}
            </span>
          </div>
        )}`;

if (content.includes(dropdownHeader)) {
  content = content.replace(dropdownHeader, dropdownHeaderReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('SearchablePatientSelect updated!');

