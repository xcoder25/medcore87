const fs = require('fs');
const path = 'C:/Users/Dell/.gemini/antigravity/brain/2566514e-374d-44cf-90bb-23aa8a8ada3f/medcore-user-manual.md';
let manual = fs.readFileSync(path, 'utf8');

// 1. In Table of Contents, update entries
manual = manual.replace(
  "5. [Admin: Managing Staff Accounts](#5-admin-managing-staff)",
  "5. [Admin: Managing Staff Accounts & Role Matrix](#5-admin-managing-staff)"
);

// 2. Add Section 5.4 & 5.5 to Section 5
const section5Target = `> [!CAUTION]
> Removing a staff member is permanent. Use **Suspend** instead if they may return.`;

const section5Addition = `> [!CAUTION]
> Removing a staff member is permanent. Use **Suspend** instead if they may return.

### 5.4 — Role Matrix & Hospital Tools Studio
As a Facility Administrator, you have total control over what modules and clinical tools every role in your hospital can access, and you can create completely new custom roles to match your hospital's staffing structure:

1. Click the **"Role Matrix & Tools"** tab in Staff Management.
2. Filter tools by category (**All**, **Clinical**, **Nursing**, **Diagnostics**, **Pharmacy**, **Billing & Admin**, **Specialties**).
3. **Toggle Permissions Instantly:** Click any checkbox in the matrix to grant or revoke access to any module for any role (e.g. Doctor, Nurse, Cashier, Records). Changes take effect across your facility immediately without restarting or redeploying.
4. **Active Scope Indicators:** View exact database and clinical record access privileges granted to each staff designation.

### 5.5 — Creating a New Hospital Role
When your hospital introduces new departments, specialty staff, or allied health professionals:
1. In the **Role Matrix & Tools** studio, click **"+ Create New Role"**.
2. Select a starting template:
   - **Clinical Officer / Specialist** (pre-configures consultation notes, prescriptions, investigations, specialty suites)
   - **Nurse / Inpatient Care** (pre-configures triage, vitals, fluid balance, bedside care)
   - **Allied Health Professional** (pre-configures therapy, nutrition, eye/dental care)
   - **Finance & Revenue Desk** (pre-configures billing, cash desk, waivers)
   - **Blank Slate** (custom from scratch)
3. Fill in the role details:
   - **Role Code** (e.g. \`optometrist\`, \`physiotherapist\`, \`dialysis_nurse\`)
   - **Display Title** (e.g. *Consultant Optometrist*)
   - **Department** (e.g. *Eye Care Clinic*)
   - **Clearance Level** (Level 1 to Level 6 Executive)
4. Check the exact modules and tools this new role should have access to.
5. Click **"Deploy New Role"**. The role is instantly saved to your facility and appears immediately in the **Enrol New Staff** dropdown for badge issuance.`;

manual = manual.replace(section5Target, section5Addition);

// 3. Add Fluid Balance to Section 7 (Triage / Nursing)
const section7Target = `4. Click **"Send to Doctor Queue"**
5. The patient automatically appears in the Doctor's consultation queue`;

const section7Addition = `4. Click **"Send to Doctor Queue"**
5. The patient automatically appears in the Doctor's consultation queue

### 7.2 — Nursing Fluid Balance & Intake/Output Flowsheet
For inpatients, post-operative wards, and critical care monitoring, nurses can maintain an hour-by-hour fluid balance record:
1. Open the patient record and select **"Nursing Care / Fluid Balance"**.
2. Enter the patient's current **Body Weight (kg)**.
3. Record hourly **Fluid Intake**:
   - Oral fluids & water
   - Intravenous (IV) infusions (Normal Saline, Dextrose, Ringers Lactate)
   - Blood products and parenteral nutrition / enteral feeds
4. Record hourly **Fluid Output**:
   - Urine output (urinal, catheter bag)
   - Surgical wound drains & chest tubes
   - Nasogastric (NG) aspirate & vomiting
5. **Real-time Clinical Analytics:**
   - **Net Fluid Balance:** Instantly calculates $(+) \\text{ Retention}$ or $(-) \\text{ Deficit}$ in mL.
   - **Weight-Adjusted Urine Output Rate:** Computes $\\text{mL/kg/hour}$ automatically.
   - **Automated Clinical Alerts:** Highlights **Oliguria Warning** if urine output drops below $0.5\\text{ mL/kg/h}$, signaling potential acute kidney injury or hypovolemia.`;

manual = manual.replace(section7Target, section7Addition);

// 4. Add Ophthalmology & Digital Consent to Section 8 (Doctor Consultation)
const section8Target = `### 8.6 — Completing the Consultation
1. After writing notes, orders, and prescriptions, click **"Complete Consultation"**
2. The patient's status updates — they move to the next stage (Pharmacy, Lab, or Cashier)`;

const section8Addition = `### 8.6 — Ophthalmology Specialty Examination Suite
For eye clinics and vision examinations, doctors and optometrists can record comprehensive ocular assessments:
1. In the consultation view, open **"Specialty Views"** and select **"Ophthalmology"**.
2. **Visual Acuity (Snellen Scale):** Record uncorrected (UCVA) and best-corrected (BCVA) visual acuity for **OD (Right Eye)**, **OS (Left Eye)**, and **OU (Both Eyes)**.
3. **Intraocular Pressure (IOP) Tonometry:** Record pressure in mmHg using Goldmann applanation or Tonopen, with automated high-pressure glaucoma flags (normal: $10 - 21\\text{ mmHg}$).
4. **Slit Lamp Anterior Segment:** Document cornea clarity, anterior chamber depth/cells, iris pattern, and lens status (cataract staging).
5. **Dilated Fundus & Cup-to-Disc Ratio:** Document optic disc margin, C:D ratio (flagging ratios $>0.6$ or asymmetry), macula, and peripheral retinal findings.
6. **Manifest Refraction & Eyeglass Prescription:** Record Sphere (SPH), Cylinder (CYL), Axis, and Near Addition (ADD) with single-click prescription generation for optical dispensing.

### 8.7 — Digital Treatment Consent & Legal Release
MedCore OS provides a paperless, legally binding digital consent workflow compliant with the Nigerian Data Protection Regulation (NDPR) and international healthcare standards:
1. Open the patient's record and click **"Consent & Legal"**.
2. Select the consent agreement type:
   - **General Treatment & Hospital Care Consent**
   - **Surgical Procedure & Anesthesia Consent** (includes procedure name, primary surgeon, anesthesia type, and declared procedural risks)
   - **Blood & Blood Component Transfusion Consent** (includes donor screening disclosures and transfusion benefits/risks)
   - **NDPR / Health Data Privacy & Confidentiality Consent**
   - **Financial Responsibility & Billing Agreement**
3. **Signer Identity & Verification:** Indicate whether the signer is the patient or an authorized surrogate / next-of-kin (Parent, Legal Guardian, Spouse, Adult Child).
4. **Digital Touch/Stylus Signature:** The patient or guardian signs directly on the touch screen or using a mouse on the interactive signature canvas pad.
5. **Witness Verification & Cryptographic Audit Hash:** The presiding clinician or nurse enters their staff badge ID as a witness. The system generates an unalterable **SHA-256 cryptographic audit signature** that records the exact timestamp and terms signed.
6. Click **"Save & Bind Consent"** to store it permanently in the patient's electronic health record, or click **"Print Legal Release"** for an archival hard copy.

### 8.8 — Completing the Consultation
1. After writing notes, orders, and prescriptions, click **"Complete Consultation"**
2. The patient's status updates — they move to the next stage (Pharmacy, Lab, or Cashier)`;

manual = manual.replace(section8Target, section8Addition);

fs.writeFileSync(path, manual, 'utf8');
console.log('Successfully updated medcore-user-manual.md with all new clinical suites and role matrix documentation!');

