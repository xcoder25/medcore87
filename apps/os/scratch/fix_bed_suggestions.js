const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/beds/BedManagement.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove bedSuggestions from top
const oldSuggestions = `  const bedSuggestions: SearchSuggestion[] = useMemo(() => {
    const list: SearchSuggestion[] = [];
    bedsList.forEach((b) => {
      if (b.patientName) {
        list.push({
          id: 'p-' + b.id,
          label: b.patientName,
          sub: b.code + ' · ' + b.ward + ' (' + (b.hospitalNumber || 'Inpatient') + ')',
          category: 'Patient',
          icon: BedDouble,
          onClick: () => setSearch(b.patientName || ''),
        });
      }
      list.push({
        id: 'b-' + b.id,
        label: b.code,
        sub: b.ward + ' · ' + b.status,
        category: 'Bed',
        icon: BedDouble,
        onClick: () => setSearch(b.code),
      });
    });
    wards.filter((w) => w !== 'All wards').forEach((w) => {
      list.push({
        id: 'w-' + w,
        label: w,
        category: 'Ward',
        onClick: () => { setFilterWard(w); setSearch(''); },
      });
    });
    return list;
  }, [bedsList, wards]);\n`;

const normContent = content.replace(/\r\n/g, '\n');
const normOld = oldSuggestions.replace(/\r\n/g, '\n');

if (normContent.includes(normOld)) {
  content = normContent.replace(normOld, '');
  console.log('[OK] Removed old bedSuggestions from top');
} else {
  console.warn('[WARN] Old bedSuggestions not found exactly');
}

// 2. Add correct bedSuggestions after wards definition
const wardsTarget = `  const wards = useMemo(
    () => ['All Wards', ...Array.from(new Set(bedsList.map((b) => b.ward))).sort()],
    [bedsList]
  );`;

const correctSuggestions = `  const wards = useMemo(
    () => ['All Wards', ...Array.from(new Set(bedsList.map((b) => b.ward))).sort()],
    [bedsList]
  );

  const bedSuggestions: SearchSuggestion[] = useMemo(() => {
    const list: SearchSuggestion[] = [];
    bedsList.forEach((b) => {
      if (b.patient) {
        list.push({
          id: 'p-' + b.id,
          label: b.patient,
          sub: b.bedNo + ' · ' + b.ward + ' (' + (b.hospitalNumber || 'Inpatient') + ')',
          category: 'Patient',
          icon: BedDouble,
          onClick: () => setSearch(b.patient || ''),
        });
      }
      list.push({
        id: 'b-' + b.id,
        label: b.bedNo,
        sub: b.ward + ' · ' + b.status,
        category: 'Bed',
        icon: BedDouble,
        onClick: () => setSearch(b.bedNo),
      });
    });
    wards.filter((w) => w !== 'All Wards').forEach((w) => {
      list.push({
        id: 'w-' + w,
        label: w,
        sub: 'Ward Filter',
        category: 'Ward',
        onClick: () => { setFilterWard(w); setSearch(''); },
      });
    });
    return list;
  }, [bedsList, wards]);`;

const normWards = wardsTarget.replace(/\r\n/g, '\n');
const normCorrect = correctSuggestions.replace(/\r\n/g, '\n');

if (content.includes(normWards)) {
  content = content.replace(normWards, normCorrect);
  console.log('[OK] Inserted correct bedSuggestions after wards');
  fs.writeFileSync(file, content, 'utf8');
} else {
  console.warn('[WARN] Wards target not found');
}

