const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, regex, replacement) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!regex.test(content)) {
    console.warn('Regex did not match in ' + path.basename(filePath));
    return false;
  }
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully replaced in ' + path.basename(filePath));
  return true;
}

// 1. PatientsManager search div
replaceInFile(
  path.join(__dirname, '../src/components/gateway-modules/PatientsManager.tsx'),
  /<div style=\{\{\s*display:\s*'flex',\s*alignItems:\s*'center',\s*gap:\s*10,\s*flex:\s*1,\s*minWidth:\s*260,\s*background:\s*'#0A1929'[\s\S]*?<input[\s\S]*?placeholder="Search by patient name[\s\S]*?<\/div>/,
  `<div style={{ flex: 1, minWidth: 260 }}>
          <InteractiveSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by patient name, MRN, ward, or diagnosis..."
            suggestions={patientSuggestions}
            size="sm"
            themeColor="#1A6EB5"
          />
        </div>`
);

// 2. ConsultationsManager search div
replaceInFile(
  path.join(__dirname, '../src/components/gateway-modules/ConsultationsManager.tsx'),
  /<div style=\{\{\s*display:\s*'flex',\s*alignItems:\s*'center',\s*gap:\s*8,\s*background:\s*'#0A1929'[\s\S]*?<input[\s\S]*?placeholder="Search patient\.\.\."[\s\S]*?<\/div>/,
  `<div style={{ marginBottom: 10 }}>
              <InteractiveSearchBar
                value={patientSearch}
                onChange={setPatientSearch}
                placeholder="Search patient..."
                suggestions={consultPatientSuggestions}
                size="sm"
                themeColor="#1A6EB5"
              />
            </div>`
);

