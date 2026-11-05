const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'src', 'components');

const items = [
  {
    file: path.join(BASE, 'dashboards', 'LabDeskHome.tsx'),
    search: "import React, { useEffect, useMemo, useState } from 'react';",
    replace: "import React, { useEffect, useMemo, useState } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  },
  {
    file: path.join(BASE, 'clinical-core', 'NursingTriageStation.tsx'),
    search: "import React, { useEffect, useState, useCallback, useMemo } from 'react';",
    replace: "import React, { useEffect, useState, useCallback, useMemo } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  },
  {
    file: path.join(BASE, 'pharmacy', 'PharmacyFormularyWorkspace.tsx'),
    search: "import React, { useCallback, useEffect, useMemo, useState } from 'react';",
    replace: "import React, { useCallback, useEffect, useMemo, useState } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  },
  {
    file: path.join(BASE, 'interop', 'LamisNdrSuite.tsx'),
    search: "import React, { useState, useEffect, useMemo } from 'react';",
    replace: "import React, { useState, useEffect, useMemo } from 'react';\nimport { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';"
  }
];

for (const it of items) {
  let content = fs.readFileSync(it.file, 'utf8');
  if (content.includes(it.search)) {
    content = content.replace(it.search, it.replace);
    fs.writeFileSync(it.file, content, 'utf8');
    console.log('[OK] Added import to ' + path.basename(it.file));
  } else {
    console.warn('[WARN] Not found in ' + path.basename(it.file));
  }
}

