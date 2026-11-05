const fs = require('fs');
const path = require('path');

const targets = [
  'components/gateway-modules/EMRManager.tsx',
  'components/dashboards/DoctorDeskHome.tsx',
  'components/dashboards/LabDeskHome.tsx',
  'components/patient-flow/PatientFlowVisibility.tsx',
  'components/reception/FrontDeskWorkqueues.tsx',
  'components/staffing/StaffingOverview.tsx',
  'components/staffing/HospitalStaffTransfer.tsx',
  'components/clinical-ux/ClinicalUxSuite.tsx',
  'components/clinical-core/ClinicalOrdersPanel.tsx',
  'components/clinical-core/NursingTriageStation.tsx',
  'components/advanced/AdvancedHospitalSuites.tsx',
  'components/compliance/ComplianceAuditLogs.tsx',
  'components/finance/BillingInvoicingSuite.tsx',
  'components/pharmacy/AksEmlFormularyPanel.tsx',
  'components/pharmacy/PharmacyFormularyWorkspace.tsx',
  'components/operations/BiomedicalEquipmentSuite.tsx',
  'components/operations/SupplyChainInventorySuite.tsx',
  'components/interop/DeviceGatewaySettings.tsx',
  'components/interop/LamisNdrSuite.tsx',
];

const basePath = path.join(__dirname, '../src');

for (const t of targets) {
  const full = path.join(basePath, t);
  if (!fs.existsSync(full)) {
    console.log('NOT FOUND: ' + t);
    continue;
  }
  const content = fs.readFileSync(full, 'utf8');
  console.log(`\n=== ${t} ===`);
  const regex = /<input[\s\S]{1,300}?placeholder=["'][^"']*[Ss]earch[^"']*["'][\s\S]{0,300}?\/>|<input[\s\S]{1,300}?placeholder=["'][^"']*[Ss]earch[^"']*["'][\s\S]{0,300}?>/g;
  let match;
  let found = false;
  while ((match = regex.exec(content)) !== null) {
    found = true;
    const lineNum = content.slice(0, match.index).split(/\r?\n/).length;
    console.log(`Line ${lineNum}:\n${match[0]}\n---`);
  }
  if (!found) {
    if (content.includes('InteractiveSearchBar')) {
      console.log('  -> Contains InteractiveSearchBar');
    } else {
      console.log('  -> No search input found');
    }
  }
}
