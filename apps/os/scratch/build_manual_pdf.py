import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print total page count.
    """
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Suppress headers and footers on cover page
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0284C7"))
        self.drawString(54, 11 * inch - 36, "MEDCORE OS")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(120, 11 * inch - 36, "|   Hospital Operations & Clinical User Manual")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)

        # Footer
        self.line(54, 45, 8.5 * inch - 54, 45)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(54, 32, "Akwa Ibom State Health System  ·  Confidential & Operational Document")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 32, page_str)
        self.restoreState()


def build_pdf(output_paths):
    target_primary = output_paths[0]
    doc = SimpleDocTemplate(
        target_primary,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=28,
        leading=34,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=10
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=18,
        textColor=colors.HexColor("#0284C7"),
        spaceAfter=25
    )

    meta_style = ParagraphStyle(
        'CoverMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=15,
        textColor=colors.HexColor("#475569")
    )

    h1_style = ParagraphStyle(
        'Heading1Custom',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0369A1"),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14.5,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=6
    )

    body_bold = ParagraphStyle(
        'BodyBoldCustom',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#065F46")
    )

    callout_warn = ParagraphStyle(
        'CalloutWarnText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#9A3412")
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#FFFFFF")
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B")
    )

    story = []

    # ------------------ COVER PAGE ------------------
    story.append(Spacer(1, 40))
    story.append(Paragraph("MEDCORE OS", title_style))
    story.append(Paragraph("Hospital Management & Clinical Operations System", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=3, color=colors.HexColor("#0284C7"), spaceAfter=25, spaceBefore=0))

    cover_text = """
    <b>Official Comprehensive User Manual for Healthcare Personnel and Administrators</b><br/><br/>
    This manual is authored in plain language to guide all hospital staff members through everyday clinical,
    administrative, and financial workflows. It assumes no prior technical knowledge and covers the complete
    lifecycle of hospital care — from initial facility setup and staff enrollment to patient discharge, automatic
    revenue clearing, and AkwaRemit state treasury remittances.
    """
    story.append(Paragraph(cover_text, meta_style))
    story.append(Spacer(1, 35))

    meta_table_data = [
        [Paragraph("<b>Target Facilities:</b>", meta_style), Paragraph("Akwa Ibom State General & Cottage Hospitals, Primary Health Centres", meta_style)],
        [Paragraph("<b>System Version:</b>", meta_style), Paragraph("MedCore OS v2.4 (Enterprise Production Edition)", meta_style)],
        [Paragraph("<b>Authentication:</b>", meta_style), Paragraph("Physical/Digital Badge ID (AMC-xxxx-xxxx) with 4–6 Digit Security PIN", meta_style)],
        [Paragraph("<b>Financial Hub:</b>", meta_style), Paragraph("AkwaRemit Central Revenue Integration & POS Dual-Balancing", meta_style)],
        [Paragraph("<b>Publication Date:</b>", meta_style), Paragraph("November 2026", meta_style)]
    ]
    meta_table = Table(meta_table_data, colWidths=[1.8 * inch, 4.8 * inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#EDF2F7")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(meta_table)

    story.append(Spacer(1, 45))
    toc_preview = """
    <b>Summary of Included Operational Modules:</b><br/>
    • <b>Section 1:</b> System Overview & Core Architecture<br/>
    • <b>Section 2:</b> First-Time Facility Admin Enrollment (<code>/reg</code>)<br/>
    • <b>Section 3:</b> Daily Staff Login via Badge ID & Security PIN<br/>
    • <b>Section 4:</b> Facility Administrator & Human Resources Management<br/>
    • <b>Section 5:</b> Reception & Patient Front Desk Operations<br/>
    • <b>Section 6:</b> Nursing & Emergency Triage Station<br/>
    • <b>Section 7:</b> Doctor Consultation Desk & Electronic Health Records<br/>
    • <b>Section 8:</b> Pharmacy Dispensary & Flexible Partial Dispensing<br/>
    • <b>Section 9:</b> Diagnostic Laboratories & Immediate Critical Notifications<br/>
    • <b>Section 10:</b> Radiology, Imaging & Diagnostic Reports<br/>
    • <b>Section 11:</b> Cashier & POS Payment Desk (Instant Auto-Clearing)<br/>
    • <b>Section 12:</b> Accounting, Treasury & AkwaRemit Central Lodgement<br/>
    • <b>Section 13:</b> Clinical Discharge & QR-Verified Gate Passes<br/>
    • <b>Section 14:</b> Practical Troubleshooting & Emergency Procedures
    """
    story.append(Paragraph(toc_preview, body_style))
    story.append(PageBreak())

    # ------------------ SECTION 1 ------------------
    story.append(Paragraph("1. System Overview & Core Architecture", h1_style))
    story.append(Paragraph(
        "MedCore OS is a unified clinical operating system designed to eliminate fragmented paper filing, lost receipts, and uncoordinated queues in Akwa Ibom State public hospitals. Every interaction — whether entering vital signs, dispensing medications, or settling bills — synchronizes automatically across departments in real time.",
        body_style
    ))
    story.append(Paragraph(
        "All workstations operate over standard web browsers (Google Chrome recommended) without requiring separate desktop software installations. User accounts are strictly tied to verifiable hospital badges and role-based clearance permissions.",
        body_style
    ))

    # Box: Key Principles
    def make_callout(text, bg="#ECFDF5", border="#6EE7B7", text_color="#065F46"):
        p_style = ParagraphStyle('C', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor(text_color))
        t = Table([[Paragraph(text, p_style)]], colWidths=[6.6 * inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(bg)),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor(border)),
            ('TOPPADDING', (0,0), (-1,-1), 7),
            ('BOTTOMPADDING', (0,0), (-1,-1), 7),
            ('LEFTPADDING', (0,0), (-1,-1), 12),
            ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ]))
        return t

    story.append(make_callout("<b>Key Operational Principle:</b> Every staff member signs in with their assigned Badge ID and PIN. There are no shared accounts. Actions performed on patient records are permanently audited with the clinician's badge number.", bg="#F0F9FF", border="#7DD3FC", text_color="#0369A1"))
    story.append(Spacer(1, 12))

    # ------------------ SECTION 2 ------------------
    story.append(Paragraph("2. First-Time Facility Admin Enrollment (/reg)", h1_style))
    story.append(Paragraph(
        "When MedCore OS is initially deployed at a healthcare facility, the primary Medical Director or designated Facility Administrator registers the hospital's master account. This registration happens exclusively at the dedicated <code>/reg</code> pathway.",
        body_style
    ))
    story.append(Paragraph("<b>Step-by-step Enrollment Instructions:</b>", body_bold))
    steps_s2 = """
    1. <b>Navigate to the Portal:</b> Open Google Chrome and enter <code>https://&lt;facility-domain&gt;/reg</code> in the address bar.<br/>
    2. <b>Select Hospital Facility:</b> Click the Facility dropdown and choose your hospital (e.g., General Hospital Ikot Abasi, General Hospital Eket, or Cottage Hospital Ikot Abia).<br/>
    3. <b>Enter Administrator Profile:</b> Type your Full Name (e.g., <i>Dr. Edidiong Bassey</i>) and an optional official Work Email.<br/>
    4. <b>Establish Security Credentials:</b> Provide a secure password (minimum 6 characters) and define a 4–6 digit confidential Security PIN.<br/>
    5. <b>Capture Digital Photo:</b> Click the circular portrait area to upload a clear passport photograph or direct webcam capture.<br/>
    6. <b>Submit & Obtain Badge ID:</b> Click <b>Enroll as Facility Administrator</b>. The system generates an official Badge ID (e.g. <code>AMC-2026-4821</code>). Record this Badge ID immediately.
    """
    story.append(Paragraph(steps_s2, body_style))
    story.append(make_callout("<b>Important Note:</b> Once a facility has an active administrator registered, the <code>/reg</code> page locks for that facility to prevent unauthorized overrides. All subsequent staff must be added through the Staff Directory by the Admin.", bg="#FFFBEB", border="#FCD34D", text_color="#92400E"))
    story.append(Spacer(1, 12))

    # ------------------ SECTION 3 ------------------
    story.append(Paragraph("3. Staff Login (Badge ID & Security PIN)", h1_style))
    story.append(Paragraph(
        "To ensure seamless shift handovers and avoid credential confusion, all hospital personnel — including Facility Administrators, Doctors, Nurses, Pharmacists, and Cashiers — authenticate via a single unified Badge interface.",
        body_style
    ))
    story.append(Paragraph("<b>Daily Sign-In Procedure:</b>", body_bold))
    steps_s3 = """
    1. Navigate to the main application address (e.g., <code>https://medcore.akwaibomhealth.gov.ng</code>).<br/>
    2. Verify that your correct hospital is selected in the Facility selector at the top.<br/>
    3. In the <b>Staff Badge ID</b> field, enter your assigned ID number (e.g. <code>AMC-2026-4821</code>).<br/>
    4. In the <b>Security PIN</b> field, type your confidential 4–6 digit PIN.<br/>
    5. Click the blue <b>Sign In to Workstation</b> button. The system validates your credentials and immediately opens your department's tailored dashboard.
    """
    story.append(Paragraph(steps_s3, body_style))
    story.append(Spacer(1, 10))

    # ------------------ SECTION 4 ------------------
    story.append(Paragraph("4. Facility Administrator: Staff Enrollment & Permissions", h1_style))
    story.append(Paragraph(
        "The Facility Administrator controls staff roster onboarding, department clearances, and credential resets from the <b>Staff Access & Enrolment</b> dashboard.",
        body_style
    ))
    story.append(Paragraph("<b>Enrolling New Healthcare Personnel:</b>", body_bold))
    steps_s4 = """
    1. Navigate to <b>Staff Access & Enrolment</b> &gt; <b>Enrol New Staff</b>.<br/>
    2. Enter the employee's Full Legal Name, Department, Professional Role, and temporary 4–6 digit PIN.<br/>
    3. Upload their passport photo for digital verification.<br/>
    4. Click <b>Generate Digital Badge & Issue Clearance</b>. The system produces a physical/digital ID card showing the employee's Photo, Role, Department, and unique Badge ID.<br/>
    5. If a staff member is reassigned, on leave, or separated, click <b>Staff Directory</b> to toggle their status between <i>Active</i>, <i>Suspended</i>, or <i>Revoked</i>.
    """
    story.append(Paragraph(steps_s4, body_style))
    story.append(PageBreak())

    # ------------------ SECTION 5 ------------------
    story.append(Paragraph("5. Reception & Patient Front Desk Operations", h1_style))
    story.append(Paragraph(
        "The Reception desk is the gateway for all patient care. Staff here manage registration, national identification, demographic capture, insurance verification, and active visit queueing.",
        body_style
    ))
    reception_table_data = [
        [Paragraph("<b>Step</b>", table_header_style), Paragraph("<b>Action</b>", table_header_style), Paragraph("<b>Operational Details</b>", table_header_style)],
        [Paragraph("<b>1. Search</b>", table_cell_style), Paragraph("Locate Patient", table_cell_style), Paragraph("Search by Full Name, Phone Number, or Hospital Record ID (e.g., MCH-00412).", table_cell_style)],
        [Paragraph("<b>2. Register</b>", table_cell_style), Paragraph("Create Record", table_cell_style), Paragraph("If new, enter Name, Gender, DOB, Phone, Address, Next of Kin, and Insurance/HMO details.", table_cell_style)],
        [Paragraph("<b>3. Check-In</b>", table_cell_style), Paragraph("Open Visit", table_cell_style), Paragraph("Choose Visit Department (General Outpatient, Emergency, Pediatrics, Ante-Natal).", table_cell_style)],
        [Paragraph("<b>4. Route</b>", table_cell_style), Paragraph("Send to Triage", table_cell_style), Paragraph("Click 'Check-In Patient'. The patient's file instantly queues at the Nursing Triage Desk.", table_cell_style)]
    ]
    rec_table = Table(reception_table_data, colWidths=[1.1 * inch, 1.5 * inch, 4.0 * inch])
    rec_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0284C7")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(rec_table)
    story.append(Spacer(1, 14))

    # ------------------ SECTION 6 ------------------
    story.append(Paragraph("6. Nursing & Emergency Triage Station", h1_style))
    story.append(Paragraph(
        "Prior to clinical consultation, nursing officers record biometric vitals and classify clinical urgency using the standardized South African Triage Scale (SATS) color-coding system.",
        body_style
    ))
    story.append(Paragraph("<b>Required Vital Parameters:</b>", body_bold))
    triage_info = """
    • <b>Blood Pressure (mmHg):</b> Systolic & Diastolic parameters (e.g., 120/80).<br/>
    • <b>Pulse Rate (bpm) & Oxygen Saturation (% SpO2):</b> Peripheral pulse and oximetry.<br/>
    • <b>Temperature (°C) & Respiratory Rate:</b> Core body temperature and breathing cycles.<br/>
    • <b>Weight (kg) & Height (cm):</b> Used for automated pediatric dosage calculations.<br/>
    • <b>Triage Priority Classification:</b> Red (Emergency - immediate resuscitation), Orange (Very Urgent - within 10 mins), Yellow (Urgent - within 60 mins), Green (Routine Outpatient).<br/>
    Submitting vitals immediately forwards the patient into the attending Physician's priority consultation queue.
    """
    story.append(Paragraph(triage_info, body_style))
    story.append(Spacer(1, 10))

    # ------------------ SECTION 7 ------------------
    story.append(Paragraph("7. Doctor Consultation Desk & Electronic Health Records", h1_style))
    story.append(Paragraph(
        "The Doctor Desk provides a comprehensive clinical interface containing longitudinal patient history, previous admissions, past laboratory results, and real-time consultation drafting.",
        body_style
    ))
    story.append(Paragraph("<b>Standard Consultation Workflow:</b>", body_bold))
    doc_steps = """
    1. <b>Queue Selection:</b> Select the highest-priority patient from the active waiting queue.<br/>
    2. <b>Clinical History & Examination:</b> Document Presenting Complaint, History of Presenting Illness, Systems Review, and Physical Examination findings.<br/>
    3. <b>Diagnosis:</b> Enter provisional and confirmed diagnoses with ICD-11 coding assistance.<br/>
    4. <b>Order Investigations:</b> Dispatch electronic orders directly to Diagnostic Laboratory and Radiology workstations. Tests queue immediately without requiring paper order slips.<br/>
    5. <b>Electronic Prescriptions:</b> Select pharmaceuticals from the hospital formulary, specifying dosage, route, frequency, and duration. Contraindications and duplicate therapies are flagged automatically.<br/>
    6. <b>Disposition:</b> Mark patient as <i>Discharged Home</i>, <i>Admitted to Ward</i>, or <i>Referred to Specialist</i>.
    """
    story.append(Paragraph(doc_steps, body_style))
    story.append(Spacer(1, 12))

    # ------------------ SECTION 8 ------------------
    story.append(Paragraph("8. Pharmacy Dispensary & Flexible Partial Dispensing", h1_style))
    story.append(Paragraph(
        "Prescriptions written by physicians stream directly to the Pharmacy Dispensary in real time. Pharmacists review orders, verify stock levels, and dispense medications safely.",
        body_style
    ))
    story.append(make_callout(
        "<b>Patient Financial Empowerment (Partial Dispensing):</b> MedCore OS recognizes that patients may not have enough cash to purchase an entire multi-drug prescription in a single transaction. Pharmacists can check off only the specific items the patient can currently afford. The bill adjusts immediately, allowing patients to collect essential drugs now and return for the remainder later.",
        bg="#F0FDF4", border="#86EFAC", text_color="#166534"
    ))
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>Dispensing Sequence:</b>", body_bold))
    pharm_steps = """
    1. Select the patient from the <b>Active Prescriptions</b> queue.<br/>
    2. Review prescribed items, dosages, and counseling notes.<br/>
    3. Uncheck any items the patient cannot afford or choose to postpone.<br/>
    4. Click <b>Confirm Dispensing & Update Inventory</b>. Drug inventory counts automatically deduct.<br/>
    5. Dispensing notes and instructions are generated for the medication label.
    """
    story.append(Paragraph(pharm_steps, body_style))
    story.append(PageBreak())

    # ------------------ SECTION 9 & 10 ------------------
    story.append(Paragraph("9. Diagnostic Laboratories & Critical Result Alerts", h1_style))
    story.append(Paragraph(
        "When a physician orders laboratory investigations, the order instantly registers in the Pathology & Laboratory module.",
        body_style
    ))
    lab_text = """
    • <b>Sample Phlebotomy:</b> Lab technicians scan or select the patient's requisition, print barcode identifiers, and mark specimens as <i>Sample Collected</i>.<br/>
    • <b>Result Entry & Validation:</b> Quantitative and qualitative findings are input against normal biological reference ranges.<br/>
    • <b>Automated Critical Alerts:</b> Severely abnormal values (e.g., Potassium &lt; 2.5 or &gt; 6.5 mmol/L, Platelets &lt; 20,000) automatically flash an urgent red notification badge on the ordering physician's desk.
    """
    story.append(Paragraph(lab_text, body_style))
    story.append(Spacer(1, 12))

    story.append(Paragraph("10. Radiology, Imaging & Diagnostic Reports", h1_style))
    story.append(Paragraph(
        "Diagnostic imaging requests (X-Ray, Ultrasound, CT Scan, Echocardiography) are processed directly at the Radiology console. Radiologists can review clinical indications, enter structured radiologist findings, upload DICOM/JPEG imagery, and publish verified reports directly into the patient's master record.",
        body_style
    ))
    story.append(Spacer(1, 14))

    # ------------------ SECTION 11 ------------------
    story.append(Paragraph("11. Cashier & POS Payment Desk (Instant Auto-Clearing)", h1_style))
    story.append(Paragraph(
        "The Point of Sale (POS) Payment Desk centralizes all bill settlements. Outstanding balances from consultations, laboratory investigations, pharmaceuticals, and bed fees are consolidated into a single live ledger.",
        body_style
    ))
    story.append(make_callout(
        "<b>Automated Cash Clearance Guarantee:</b> In earlier versions, receiving cash required cashiers to separately click 'Mark as Paid' in other modules. With the new release, selecting Cash and clicking <b>Charge / Process Cash Payment</b> prints the receipt AND automatically marks the patient's visit, billing lines, and pharmacy orders as PAID instantly. No secondary manual steps are required.",
        bg="#F0F9FF", border="#38BDF8", text_color="#0369A1"
    ))
    story.append(Spacer(1, 10))

    payment_table_data = [
        [Paragraph("<b>Method</b>", table_header_style), Paragraph("<b>Workflow Mechanism</b>", table_header_style), Paragraph("<b>Verification Speed</b>", table_header_style)],
        [Paragraph("<b>Cash</b>", table_cell_style), Paragraph("Cashier collects physical currency, clicks Charge. Ledger, visits, and receipts finalize simultaneously.", table_cell_style), Paragraph("Instantaneous (0 sec)", table_cell_style)],
        [Paragraph("<b>Card / POS</b>", table_cell_style), Paragraph("Integrated Paystack checkout. Card or USSD transaction with real-time modal.", table_cell_style), Paragraph("Auto-polled every 2.5 sec", table_cell_style)],
        [Paragraph("<b>Direct Transfer</b>", table_cell_style), Paragraph("Dynamic virtual bank account generated for patient mobile banking transfers.", table_cell_style), Paragraph("Auto-polled every 2.5 sec", table_cell_style)],
        [Paragraph("<b>HMO Insurance</b>", table_cell_style), Paragraph("Enter HMO Provider Code and Pre-Authorization number. Bill logged to state NHIA registry.", table_cell_style), Paragraph("Immediate confirmation", table_cell_style)],
        [Paragraph("<b>Govt Waiver</b>", table_cell_style), Paragraph("Applied for indigent patients, maternal child health programs, or emergency waivers.", table_cell_style), Paragraph("Authorized by Admin PIN", table_cell_style)]
    ]
    pay_table = Table(payment_table_data, colWidths=[1.1 * inch, 4.1 * inch, 1.4 * inch])
    pay_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(pay_table)
    story.append(Spacer(1, 12))

    # ------------------ SECTION 12 ------------------
    story.append(Paragraph("12. Accounting, Treasury & AkwaRemit Central Lodgement", h1_style))
    story.append(Paragraph(
        "To ensure complete fiscal transparency and compliance with Akwa Ibom State public finance standards, all collections are monitored through the <b>Accounting Workspace & AkwaRemit Central Hub</b>.",
        body_style
    ))
    acct_text = """
    • <b>Real-Time Balancing Matrix:</b> Tracks daily collections partitioned by department, cashier badge number, and payment mechanism.<br/>
    • <b>Automated Remittance Alerts:</b> If physical cash collections remain unremitted to the bank for over 24 hours, the system generates an operational audit flag to ensure timely treasury lodgement.<br/>
    • <b>AkwaRemit Lodgement Protocol:</b> Accountants generate daily remittance batches, input bank deposit slip identifiers, and transmit digital lodgement summaries directly to the Akwa Ibom State Internal Revenue Service (AKIRS) portal.
    """
    story.append(Paragraph(acct_text, body_style))
    story.append(PageBreak())

    # ------------------ SECTION 13 ------------------
    story.append(Paragraph("13. Clinical Discharge & QR-Verified Gate Passes", h1_style))
    story.append(Paragraph(
        "Patient departure is strictly coordinated to protect clinical safety and eliminate unpaid exit leakages.",
        body_style
    ))
    discharge_steps = """
    <b>Four-Stage Discharge Verification Protocol:</b><br/>
    1. <b>Physician Sign-Off:</b> The attending doctor signs the Clinical Discharge Summary, prescribing take-home medications and scheduling outpatient follow-up clinics.<br/>
    2. <b>Pharmacy Clearance:</b> Dispensary confirms all take-home pharmaceuticals have been received and labeled.<br/>
    3. <b>Revenue Clearance:</b> POS Payment Desk verifies that all inpatient, laboratory, and pharmacy charges are settled.<br/>
    4. <b>Digital Gate Pass Issuance:</b> Once all three departments clear the file, the system generates an official <b>MedCore Digital Gate Pass</b> featuring a cryptographic QR code.<br/>
    5. <b>Security Gate Verification:</b> Hospital security officers at the exit gate scan the patient's QR code using any smartphone or handheld terminal. A green confirmation screen authorizes exit.
    """
    story.append(Paragraph(discharge_steps, body_style))
    story.append(Spacer(1, 14))

    # ------------------ SECTION 14 ------------------
    story.append(Paragraph("14. Practical Troubleshooting & Emergency Procedures", h1_style))
    story.append(Paragraph(
        "Below are concise resolutions for the most frequent operational challenges encountered by facility personnel:",
        body_style
    ))

    faq_data = [
        [Paragraph("<b>Issue Observed</b>", table_header_style), Paragraph("<b>Probable Cause</b>", table_header_style), Paragraph("<b>Immediate Resolution</b>", table_header_style)],
        [
            Paragraph("<b>Cannot Log In</b>", table_cell_style),
            Paragraph("Invalid Badge ID format or incorrect PIN.", table_cell_style),
            Paragraph("Verify Badge format (e.g. AMC-2026-xxxx). Do not use email. If PIN is forgotten, Facility Admin can reset it in Staff Directory.", table_cell_style)
        ],
        [
            Paragraph("<b>Card Payment Pending</b>", table_cell_style),
            Paragraph("Bank network delay during Paystack checkout.", table_cell_style),
            Paragraph("System automatically queries bank status every 2.5 seconds. Wait 30 seconds. Do not ask patient to pay twice without checking ledger.", table_cell_style)
        ],
        [
            Paragraph("<b>Facility Admin Already Enrolled</b>", table_cell_style),
            Paragraph("Attempting to access /reg on an active facility.", table_cell_style),
            Paragraph("The hospital already has an admin. Navigate to the main login page (remove /reg) and sign in with existing credentials.", table_cell_style)
        ],
        [
            Paragraph("<b>Receipt Won't Print</b>", table_cell_style),
            Paragraph("Browser pop-up blocker or printer offline.", table_cell_style),
            Paragraph("Click the padlock icon next to the browser URL and select 'Allow Pop-ups'. Verify thermal printer USB/Bluetooth connection.", table_cell_style)
        ],
        [
            Paragraph("<b>Temporary Power / Internet Loss</b>", table_cell_style),
            Paragraph("Public grid or network outage.", table_cell_style),
            Paragraph("MedCore OS caches active patient files locally. Continue offline triage and cash receipt logging. Data syncs automatically once reconnected.", table_cell_style)
        ]
    ]

    faq_table = Table(faq_data, colWidths=[1.4 * inch, 1.8 * inch, 3.4 * inch])
    faq_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(faq_table)
    story.append(Spacer(1, 18))

    story.append(Paragraph(
        "<b>Emergency IT Support Contacts:</b><br/>"
        "• Hospital Internal IT Helpdesk: On-Duty Facility Technical Officer<br/>"
        "• State Ministry of Health MedCore Command: <code>support@medcore.akwaibomhealth.gov.ng</code><br/>"
        "• AkwaRemit Central Finance Liaison: <code>remittance@akwaibomhealth.gov.ng</code>",
        meta_style
    ))

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[SUCCESS] Compiled PDF to: {target_primary}")

    # Copy to all requested destinations
    import shutil
    for path in output_paths[1:]:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        shutil.copyfile(target_primary, path)
        print(f"[SUCCESS] Mirrored PDF to: {path}")

if __name__ == "__main__":
    paths = [
        r"c:\Users\Dell\OneDrive\Desktop\medcore\apps\os\public\MedCore_OS_User_Manual.pdf",
        r"C:\Users\Dell\.gemini\antigravity\brain\2566514e-374d-44cf-90bb-23aa8a8ada3f\MedCore_OS_User_Manual.pdf",
    ]
    build_pdf(paths)
