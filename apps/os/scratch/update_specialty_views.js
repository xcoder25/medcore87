const fs = require('fs');
const path = 'c:\\Users\\Dell\\OneDrive\\Desktop\\medcore\\apps\\os\\src\\components\\clinical-ux\\ClinicalUxSuite.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Add imports
const importTarget = "import { PatientChartBanner } from '../clinical-core/PatientChartBanner';";
const newImports = `import { PatientChartBanner } from '../clinical-core/PatientChartBanner';
import { OphthalmologySuite } from '../clinical-core/OphthalmologySuite';
import { DigitalConsentSuite } from '../clinical-core/DigitalConsentSuite';
import { FluidBalanceSuite } from '../clinical-core/FluidBalanceSuite';`;

if (c.includes(importTarget)) {
  c = c.replace(importTarget, newImports);
  console.log('✅ Added specialty suite imports to ClinicalUxSuite');
} else {
  console.warn('⚠️ Could not match PatientChartBanner import');
}

// 2. Replace SpecialtyViews function with full specialty suite
const oldSpecialtyViews = `function SpecialtyViews({ facilityId, patient }: { facilityId: string; patient: FacilityPatient | null | undefined }) {
  const [view, setView] = useState<'maternity' | 'paeds' | 'cardiac'>('maternity');
  return (
    <div style={{ background: '#fff', border: \`1px solid \${C.border}\`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['maternity', 'paeds', 'cardiac'] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} style={view === v ? btnPri : btnSec}>{v}</button>
        ))}
      </div>
      {view === 'maternity' && (
        <div>
          <div style={{ fontWeight: 800 }}>Maternity focus</div>
          <p style={{ fontSize: 13, color: C.muted }}>ANC visits, labour board link, gravidity/parity fields — use Maternity module for full board. Patient: {patient ? \`\${patient.firstName} \${patient.lastName}\` : 'none selected'}.</p>
        </div>
      )}
      {view === 'paeds' && (
        <div>
          <div style={{ fontWeight: 800 }}>Paediatrics focus</div>
          <p style={{ fontSize: 13, color: C.muted }}>Growth chart hooks, immunisation — open Paediatric module for full suite. Facility {facilityId}.</p>
        </div>
      )}
      {view === 'cardiac' && (
        <div>
          <div style={{ fontWeight: 800 }}>Cardiac focus</div>
          <p style={{ fontSize: 13, color: C.muted }}>ECG/report queue via imaging orders; BP trends in vitals flowsheet.</p>
        </div>
      )}
    </div>
  );
}`;

const newSpecialtyViews = `function SpecialtyViews({ facilityId, patient }: { facilityId: string; patient: FacilityPatient | null | undefined }) {
  const [view, setView] = useState<'ophthalmology' | 'fluid_balance' | 'consent' | 'maternity' | 'paeds' | 'cardiac'>('ophthalmology');
  return (
    <div style={{ background: '#fff', border: \`1px solid \${C.border}\`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', borderBottom: \`1px solid \${C.border}\`, paddingBottom: 12 }}>
        {[
          { id: 'ophthalmology', label: '?? Eye Clinic / Ophthalmology' },
          { id: 'fluid_balance', label: '?? Nursing Fluid Balance (I/O)' },
          { id: 'consent', label: '?? Legal & Treatment Consents' },
          { id: 'maternity', label: '?? Maternity / ANC' },
          { id: 'paeds', label: '?? Paediatrics / Growth' },
          { id: 'cardiac', label: '?? Cardiac / ECG' },
        ].map((v) => (
          <button key={v.id} type="button" onClick={() => setView(v.id as any)} style={view === v.id ? btnPri : btnSec}>
            {v.label}
          </button>
        ))}
      </div>

      {view === 'ophthalmology' && (
        <OphthalmologySuite facilityId={facilityId} patient={patient} />
      )}
      {view === 'fluid_balance' && (
        <FluidBalanceSuite facilityId={facilityId} patient={patient} />
      )}
      {view === 'consent' && (
        <DigitalConsentSuite facilityId={facilityId} patient={patient} />
      )}
      {view === 'maternity' && (
        <div>
          <div style={{ fontWeight: 800 }}>Maternity & Obstetric Focus</div>
          <p style={{ fontSize: 13, color: C.muted }}>ANC visits, labor board link, gravidity/parity fields — use the specialized MaternityOgSuite for continuous CTG and MFTI monitoring. Patient: {patient ? \`\${patient.firstName} \${patient.lastName}\` : 'none selected'}.</p>
        </div>
      )}
      {view === 'paeds' && (
        <div>
          <div style={{ fontWeight: 800 }}>Paediatrics & NICU Focus</div>
          <p style={{ fontSize: 13, color: C.muted }}>Growth chart percentiles, APGAR scores, weight-adjusted dosing, and immunization registry. Facility {facilityId}.</p>
        </div>
      )}
      {view === 'cardiac' && (
        <div>
          <div style={{ fontWeight: 800 }}>Cardiac & Hemodynamics Focus</div>
          <p style={{ fontSize: 13, color: C.muted }}>ECG interpretation queue, troponin lab monitoring, and BP trends in vitals flowsheet.</p>
        </div>
      )}
    </div>
  );
}`;

if (c.includes(oldSpecialtyViews)) {
  c = c.replace(oldSpecialtyViews, newSpecialtyViews);
  console.log('✅ Replaced SpecialtyViews with enhanced multi-specialty suite');
} else {
  // Try CRLF match
  const oldSpecialtyCRLF = oldSpecialtyViews.replace(/\n/g, '\r\n');
  if (c.includes(oldSpecialtyCRLF)) {
    c = c.replace(oldSpecialtyCRLF, newSpecialtyViews.replace(/\n/g, '\r\n'));
    console.log('✅ Replaced SpecialtyViews (CRLF)');
  } else {
    console.error('❌ Could not match oldSpecialtyViews');
  }
}

fs.writeFileSync(path, c, 'utf8');
console.log('✅ Done updating ClinicalUxSuite.tsx');

