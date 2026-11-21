# MedCore Hospital OS — Beginner User Manual

Welcome to **MedCore Hospital OS**. This plain-language step-by-step guide walks a first-time user through setting up the hospital, logging in safely, enrolling staff, registering patients, managing automated outpatient visits, billing & Pharmacy payments, inpatient ward admission, and using Celestia AI.

---

## 1. Creating Your First Hospital Administrator
1. Open the MedCore registration link (`/reg`) in your browser.
2. Select or enter your **Hospital Facility Name** (for example, *Ikot Ekpene General Hospital*).
3. Enter your **Full Name**, valid **Work Email** (used for Two-Factor Authentication OTPs), and choose a **6-Digit Security PIN** (keep it confidential).
4. Click **Create Hospital Admin**. *(Any empty required box will automatically highlight in red so you know what to fill in.)*
5. Save or note your generated **Staff Badge ID** (e.g., `AKS-2026-XXXX`).

---

## 2. Hospital Setup & Onboarding Wizard
After signing in for the first time as Admin, complete the **4-Step Hospital Setup Wizard**:
- **Step 1 (Facility Profile)**: Fill in Government HFR Code, Supervising Board (e.g., AKSHMB / AKSPHCDA / FMOH), Authorization Circular Reference, Chief Medical Director, LGA, and Ward.
- **Step 2 (Compliance)**: Tick **NDPR** and **Data Processing Agreement**, then enter the Signatory Full Name.
- **Step 3 (Clinical Desks)**: Toggle the units active in your hospital (OPD, Pharmacy, Laboratory, Maternity, Theatre, AkwaRemit, etc.).
- **Step 4 (Review & Finish)**: Click **Complete Setup** to launch your Admin Command Centre.

---

## 3. Signing In, Two-Factor Authentication (2FA) & Biometrics
1. On the Sign-In screen, select your **Hospital Facility**.
2. Enter your **Staff Badge ID** (or Work Email) and **6-Digit PIN**, then click **Sign In**.
3. Complete **2FA Verification**:
   - **Email OTP**: Enter the 6-digit code sent to your work email, **OR**
   - **Biometric 2FA (Fingerprint / Face ID / Windows Hello)**: Once enrolled, tap **Verify with Fingerprint / Face ID** to sign in instantly without waiting for email.
4. **How to Enroll Biometrics**:
   - Once inside MedCore OS, click your **Name / Avatar** at the top-right corner to open your **Staff Profile**.
   - Scroll to **Biometric 2FA** and click **Enroll Fingerprint / Face ID**, then follow your phone or laptop prompt.
5. **Locking the Terminal**:
   - Stepping away? Click the **Lock** icon in the top bar.
   - Even if someone reloads or refreshes the browser, the workstation stays locked until unlocked with your **PIN** or **Biometrics**.

---

## 4. Creating Staff Accounts & Managing Presence
As **Hospital Admin**:
1. Open **Access & Staff Enrolment** from the sidebar -> **Enrol New Staff**.
2. Enter the staff member's **Full Name**, **Work Email**, choose their **Hospital Specialty / Role** (Receptionist, Triage Nurse, Doctor, Pharmacist, Lab Scientist, Accountant, Health Records/HIM), set a **6-Digit PIN**, enter their **Civil Service / IPPIS ID**, and upload a **Passport Headshot** (optional).
3. Click **Complete Enrolment & Issue Staff ID**. Their scannable Staff ID Card is created immediately.
4. To monitor attendance, open **Staffing · Staff Presence & Rosters**. Every staff row shows their **Exact Date & Time** under **Last seen**, online/off-duty badge, and an **AI Roster Analysis** panel highlighting uncovered desks.
   - *Admin Security Tool*: Under **Access & Staff Enrolment**, you can view any staff member's **Biometric 2FA** status and click **Reset Biometrics** if they lose or replace their device.

---

## 5. Registering a Patient (Front Desk / Reception)
1. Log in as **Reception / Front Desk** -> click **Register New**.
2. **Option A — AI Paper Form Scanner (Fastest)**:
   - Click **AI Scan Paper Form** at the top of the registration form.
   - Upload a photo or capture from your webcam/phone of a filled physical paper card.
   - Review the extracted fields (Name, Date of Birth, Sex, Phone, NIN, Address, Next of Kin, Allergies) and click **Autofill EMR Registration Form**.
3. **Option B — Manual Registration**:
   - Fill out Steps 1–5 carefully (required fields turn red if missed when clicking **Next / Register**; optional sections can be skipped where shown).
4. Submit registration to generate the patient's unique **Hospital Number (HN)** and automatic consultation/folder charge sent to Accounts (if applicable).

---

## 6. Issuing a Scannable Digital Health Card (HIM / Records)
1. Log in as **Health Records / HIM** (or **Digital Patient Card**).
2. Click **Issue Health Card** next to the registered patient (or open the **Digital Health Cards** tab).
3. MedCore assigns a non-sequential **SHID** (State Health Identifier) and generates an official card with a live ISO-standard **Scannable QR Code** that works with any phone camera, handheld barcode/QR scanner, or MedCore's **Scan ID / QR** workstation.

---

## 7. Automated OPD Flow & Scan Check-In (No Manual Send/Complete Needed)
1. When a patient returns, Front Desk opens **Scan ID / QR**, scans their card QR (or types their HN/SHID), and checks them in. *(Click **Clear Scan** anytime to reset the scan screen.)*
2. Look at **All Active OPD** on the Front Desk home screen — the queue status progresses **automatically** without manual **Send** or **Done** clicks:
   - `Waiting Triage` -> Nurse records vitals -> `Waiting Doctor` -> Doctor opens consult -> `With Doctor` -> Doctor prescribes/orders tests (`Done w/ Doctor (Auto)`) **OR** admits the patient to a ward bed (`Admitted (Ward / Bed)`).

---

## 8. Nurse Triage, Ward Bed Admission & Inpatient e-MAR
1. **OPD Triage**: Nurse logs in -> **Triage / Vitals Station** -> selects verified patient -> records BP, Temp, SpO2, Pulse, Weight, urgency -> saves. The patient moves automatically to the Doctor's queue.
2. **Inpatient Admission**: When a patient needs admission, the **Doctor** opens **Bed & Ward Occupancy / Admit to Bed**, picks an **Available Bed** and Ward, enters diagnosis and nursing orders, and confirms. The patient's OPD visit automatically changes to **Admitted** and appears in the Nurse's inpatient unit.
3. **Inpatient Nursing & e-MAR / Ward Med Requests**:
   - Nurses open **Inpatient & e-MAR** to administer scheduled doses (`Mark Given`) or safely document `Hold` / `Refuse`.
   - If ward stock runs low or an urgent patient dose is needed, open **Ward Med Requests** in Nursing to send a `Routine` / `Urgent` / `STAT` drug request directly to Pharmacy.
   - For critical patients transitioning out of Intensive Care, use **ICU & Critical Care Telemetry** -> **ICU Step-Down & Bed Transfer**.

---

## 9. Pharmacy: Dispensing, Separate Payment Desk & Drug Hold ("Come Back Later")
1. **Dispense Queue**: Pharmacists see incoming prescriptions from Doctors and **Ward Med Requests** from Nurses. Nurse vitals and Front Desk OPD noise are completely separated from Pharmacy.
2. **Pharmacy Payment Desk**:
   - Open **Pharmacy Payment Desk** (isolated emerald till showing **only** medication and OTC Pharmacy bills).
   - If a patient asks to remove one or more drugs because they cannot afford them right now, click **Hold for Later**. The held drug immediately drops out of the payable bill total and sits safely in **Held / Deferred Drugs** until the patient returns with funds and you click **Restore to Bill**.
   - Click **Collect & Issue Receipt** (Cash Till, AkwaRemit POS, Direct AkwaRemit RRR, or HMO). Cash payments remain marked **Pending TSA Remittance** until the Accountant settles the cash shift batch.
   - Click any receipt under **Today's Pharmacy Receipts** to open it with its QR code and **Print Official Receipt**.
3. **Prescription Records & Formulary**:
   - Open **Prescription Records** for the longitudinal master-detail medication dossier and **Formulary & Stock Control** for real-time FEFO stock tracking.

---

## 10. Hospital Accounts & Shift Cash Lodgment (TSA / AkwaRemit)
1. **Cashier / Accounts** collects folder/consultation/lab/imaging fees at the main till (never prematurely showing Cash as already settled under Direct AkwaRemit RRR).
2. At shift close, Head Cashier lodges physical cash in the partner transit bank account and runs **Automated AkwaRemit Batch Settlement** to clear pending cash ARNs programmatically.

---

## 11. Using Celestia AI (Voice & Automation)
1. Click the floating **Celestia AI** assistant (or open **Celestia** from the sidebar).
2. Type a question or command — **OR tap the Microphone icon** to speak naturally (high-accuracy clinical voice-to-text supports Nigerian names, LGAs, drug names, vitals, and EMR terms).
3. Examples of what Celestia can do automatically within your role:
   - *Admin*: `"Create 8 beds in Male Medical Ward"`, `"Analyze roster coverage"`, `"Open staffing"`.
   - *Pharmacy*: `"Check low stock drugs"`, `"Open pharmacy payment desk"`.
   - *Reception / Clinical*: `"Verify patient [Name or HN]"`, `"Open bed census"`.
   - *Accounts*: `"Pending cash at till"`, `"Prepare batch settlement"`.
