"""
MedCore Hospital Platform — Master Role-Based QA Tester Manual & Acceptance Guide
Generates a comprehensive, publication-grade PDF manual covering all 14 clinical and operational roles.
"""

import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print 'Page X of Y' 
    plus running header and footer banners on all pages except the cover page.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Suppress running header/footer on title cover

        self.saveState()
        # Top banner line
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#0A2540"))
        self.drawString(36, 756, "MEDCORE HOSPITAL OS — MASTER ROLE-BASED QA TESTER MANUAL")
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawRightString(576, 756, "Akwa Ibom State Healthcare System · QA Runbook v2.4")
        
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.75)
        self.line(36, 749, 576, 749)

        # Bottom banner line
        self.line(36, 42, 576, 42)
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(36, 30, "CONFIDENTIAL & PROPRIETARY — FOR AUTHORIZED HOSPITAL TESTERS ONLY")
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#0A2540"))
        self.drawRightString(576, 30, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def create_tester_manual(output_filename="MedCore_All_Roles_Tester_Manual.pdf"):
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=48,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    # Color Palette Definitions
    c_primary = colors.HexColor("#0A2540")      # Navy Blue
    c_secondary = colors.HexColor("#0284C7")    # Clinical Sky Blue
    c_teal = colors.HexColor("#0D9488")         # Teal
    c_dark = colors.HexColor("#0F172A")         # Slate Dark Text
    c_light = colors.HexColor("#F8FAFC")        # Background Off-white
    c_border = colors.HexColor("#E2E8F0")       # Border Gray
    c_accent = colors.HexColor("#E11D48")       # Crimson / Critical
    c_amber = colors.HexColor("#D97706")        # Warning Amber
    c_green = colors.HexColor("#059669")        # Success Green
    c_purple = colors.HexColor("#7C3AED")       # Royal Purple

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=c_primary,
        alignment=0,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=c_secondary,
        alignment=0,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=c_primary,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=c_secondary,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'SectionH3',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=c_dark,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_dark,
        spaceAfter=6
    )

    body_bold = ParagraphStyle(
        'BodyDarkBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#1E293B")
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=0
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10.5,
        textColor=c_dark
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=table_cell,
        fontName='Helvetica-Bold'
    )

    table_cell_code = ParagraphStyle(
        'TableCellCode',
        parent=table_cell,
        fontName='Courier-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F766E")
    )

    tag_style = ParagraphStyle(
        'TagStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=8,
        textColor=colors.HexColor("#0369A1"),
        alignment=1
    )

    story = []

    # =========================================================================
    # COVER / HEADER BLOCK
    # =========================================================================
    story.append(Spacer(1, 15))
    
    # State & Platform Badge
    badge_data = [[
        Paragraph("<font color='#0D9488'><b>AKWA IBOM STATE HEALTHCARE SYSTEM</b></font> · <font color='#64748B'>Official Hospital OS Acceptance Suite</font>", body_bold),
        Paragraph("<font color='#E11D48'><b>QA TESTER RUNBOOK v2.4</b></font>", ParagraphStyle('RBadge', parent=body_bold, alignment=2))
    ]]
    t_badge = Table(badge_data, colWidths=[380, 160])
    t_badge.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(t_badge)
    story.append(Spacer(1, 10))

    story.append(Paragraph("MedCore Hospital Platform", title_style))
    story.append(Paragraph("Comprehensive Role-Based QA Tester Manual & Acceptance Guide", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=c_primary, spaceBefore=0, spaceAfter=14))

    # Meta Overview Box
    meta_data = [
        [
            Paragraph("<b>Target System:</b> MedCore Hospital OS & Mobile Suite (v2.0)", callout_style),
            Paragraph("<b>Document Scope:</b> All 14 Clinical, Diagnostic & Admin Roles", callout_style)
        ],
        [
            Paragraph("<b>Architecture:</b> Next.js Desktop + Realtime WebSocket Event Bus + Mobile Apps", callout_style),
            Paragraph("<b>Target Audience:</b> QA Engineers, Clinical Testers, Acceptance Reviewers", callout_style)
        ],
        [
            Paragraph("<b>Default Environment:</b> <code>http://localhost:3003</code> / API: <code>http://localhost:4000</code>", callout_style),
            Paragraph("<b>Security Model:</b> Clearance L1-L6, Role-Based Access Control (RBAC)", callout_style)
        ]
    ]
    t_meta = Table(meta_data, colWidths=[270, 270])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 14))

    # Executive Overview
    story.append(Paragraph("<b>1. Purpose & How to Use this Manual</b>", h1_style))
    story.append(Paragraph(
        "This manual is the single source of truth for validating, testing, and accepting the MedCore Hospital Platform. "
        "MedCore is an enterprise-grade hospital operating system designed for state-wide secondary health facilities, "
        "integrating patient identity (FHIR digital cards), real-time clinical workflows (SOAP notes, CPOE order sets, "
        "eMAR nursing administration, LIS lab verification, pharmacy dispensing), and operational governance (bed flow, "
        "cashier revenue collection, staff biometric ID cards, and compliance audit logs).",
        body_style
    ))
    story.append(Paragraph(
        "As a tester, you must verify both <b>Role Isolation</b> (ensuring users only see and execute functions permitted by "
        "their clearance level and department) and <b>Real-Time Event Propagation</b> (verifying that actions taken by one role "
        "immediately reflect on other users' screens via the green LIVE WebSocket notification bus without page reloads).",
        body_style
    ))

    # Test Architecture & Prerequisites Callout
    banner_data = [[
        Paragraph(
            "<b>CRITICAL TEST PREREQUISITE — TWO RUNNING TERMINALS REQUIRED:</b><br/>"
            "• <b>Terminal A (API Server + Live Bus):</b> <code>cd services/api-server && npm run dev</code> (Runs on port 4000; provides WebSocket <code>ws://localhost:4000/ws</code>).<br/>"
            "• <b>Terminal B (Hospital OS UI):</b> <code>cd apps/os && npm run dev</code> (Runs on port 3003; access via Google Chrome or Microsoft Edge).<br/>"
            "• <b>Live Indicator Verification:</b> Always look at the top navigation bar. A bright <b>GREEN 'LIVE' pill</b> confirms the real-time event bus is connected. "
            "If red or grey, clinical alerts and live queue pushes will not fire.",
            callout_style
        )
    ]]
    t_banner = Table(banner_data, colWidths=[540])
    t_banner.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#93C5FD")),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(t_banner)
    story.append(Spacer(1, 14))

    # =========================================================================
    # MASTER CREDENTIAL & ROLE DIRECTORY TABLE
    # =========================================================================
    story.append(Paragraph("<b>2. Master Role & Tester Credential Directory</b>", h1_style))
    story.append(Paragraph(
        "Use the credentials below to log in as each respective staff member. In the Hospital OS login modal, you may authenticate "
        "either via <b>Work Email + Password</b> or switch to <b>Staff ID No. + PIN</b> mode. Each role launches directly into "
        "its dedicated specialized desk.",
        body_style
    ))

    matrix_rows = [
        [
            Paragraph("Role & Title", table_header),
            Paragraph("RoleKey / Lvl", table_header),
            Paragraph("Demo Staff Name", table_header),
            Paragraph("Staff ID / Email", table_header),
            Paragraph("PIN / Pwd", table_header),
            Paragraph("Primary Landing Desk & Scope", table_header)
        ],
        [
            Paragraph("<b>Hospital Administrator</b>", table_cell),
            Paragraph("<code>hospital_admin</code><br/>Clearance L5", table_cell),
            Paragraph("Adm. Ngozi Eze /<br/>Platform Admin", table_cell),
            Paragraph("<code>AKS-ADM-001</code><br/>c.okoro@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>AKS-0012442</code><br/>Pwd: <code>admin123</code>", table_cell),
            Paragraph("Admin Workspace: Command Centre, Staff Enrolment & ID, Beds, Transfers, RBAC, Audit.", table_cell)
        ],
        [
            Paragraph("<b>Medical Doctor</b>", table_cell),
            Paragraph("<code>doctor</code><br/>Clearance L4", table_cell),
            Paragraph("Dr. Amara Okafor", table_cell),
            Paragraph("<code>IGH-DOC-001</code><br/>a.bello@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>doctor123</code>", table_cell),
            Paragraph("Doctor Desk Home: Consultation Queue, SOAP EMR, CPOE Order Sets, EML Formulary, Live Alerts.", table_cell)
        ],
        [
            Paragraph("<b>Consultant Surgeon</b>", table_cell),
            Paragraph("<code>surgeon</code><br/>Clearance L5", table_cell),
            Paragraph("Dr. Emeka Adeyemi", table_cell),
            Paragraph("<code>GHI-SUR-002</code><br/>surgeon@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>doctor123</code>", table_cell),
            Paragraph("Theatre Desk: Operation Theatre suite, Surgical Checklist, ICU allocation, Blood bank requisitions.", table_cell)
        ],
        [
            Paragraph("<b>Senior Nursing Officer</b>", table_cell),
            Paragraph("<code>nurse</code><br/>Clearance L3", table_cell),
            Paragraph("Nurse Aisha Bello", table_cell),
            Paragraph("<code>MSG-NUR-003</code><br/>c.okeke@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>nurse123</code>", table_cell),
            Paragraph("Nurse Desk Home: Ward Board, Inpatient Bed Tracking, Triage/Vitals, eMAR Administration, Shift Handover.", table_cell)
        ],
        [
            Paragraph("<b>Midwife (Labour & Delivery)</b>", table_cell),
            Paragraph("<code>midwife</code><br/>Clearance L3", table_cell),
            Paragraph("Staff Midwife Edidiong", table_cell),
            Paragraph("<code>CH-MID-011</code><br/>midwife@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>nurse123</code>", table_cell),
            Paragraph("Labour & Delivery Desk: Partograph tracking, CTG monitoring, Delivery outcomes, APGAR score, NICU link.", table_cell)
        ],
        [
            Paragraph("<b>Chief Pharmacist</b>", table_cell),
            Paragraph("<code>pharmacist</code><br/>Clearance L3", table_cell),
            Paragraph("Pharm. Chidi Otu", table_cell),
            Paragraph("<code>GHE-PHA-005</code><br/>i.musa@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>pharm123</code>", table_cell),
            Paragraph("Pharmacy Desk: Real-time Rx Dispensing Queue, AKS EML Formulary checks, Stock depletion, Batches.", table_cell)
        ],
        [
            Paragraph("<b>Senior Lab Scientist</b>", table_cell),
            Paragraph("<code>lab</code><br/>Clearance L3", table_cell),
            Paragraph("Kelechi Obiora", table_cell),
            Paragraph("<code>GHI-LAB-006</code><br/>e.nwosu@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>lab123</code>", table_cell),
            Paragraph("Lab Desk Home / LIS: Diagnostic Orders Queue, Specimen Barcode Receipt, Result Entry, Critical Alert Broadcast.", table_cell)
        ],
        [
            Paragraph("<b>Consultant Radiologist</b>", table_cell),
            Paragraph("<code>radiologist</code><br/>Clearance L5", table_cell),
            Paragraph("Dr. Fatima Al-Hassan", table_cell),
            Paragraph("<code>MGH-RAD-007</code><br/>rad@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>doctor123</code>", table_cell),
            Paragraph("Imaging Desk: RIS Modality Worklist, PACS DICOM slice viewer, Diagnostic report authoring, AI radiology findings.", table_cell)
        ],
        [
            Paragraph("<b>Reception & Front Desk</b>", table_cell),
            Paragraph("<code>reception</code><br/>Clearance L2", table_cell),
            Paragraph("Bisi Adewale (Reception)", table_cell),
            Paragraph("<code>GHA-REC-008</code><br/>f.adeyemi@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>reception123</code>", table_cell),
            Paragraph("Reception Front Desk Workspace: MPI Search/Register, Digital Patient Card, OPD Clinic Check-In, Queue Routing.", table_cell)
        ],
        [
            Paragraph("<b>Health Records (HIM)</b>", table_cell),
            Paragraph("<code>records</code><br/>Clearance L2", table_cell),
            Paragraph("Health Records Lead", table_cell),
            Paragraph("<code>GHA-REC-008</code> (HIM mode)<br/>him@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>reception123</code>", table_cell),
            Paragraph("Health Records Command: MPI Quality, Duplicate Folder Merge, Chart Deficiency tracking, ICD-10/ACHI coding.", table_cell)
        ],
        [
            Paragraph("<b>Cashier & Finance Officer</b>", table_cell),
            Paragraph("<code>accountant</code><br/>Clearance L3", table_cell),
            Paragraph("Amaka Oguike", table_cell),
            Paragraph("<code>PSY-ACC-009</code><br/>finance@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>finance123</code>", table_cell),
            Paragraph("Finance Desk: Point-of-Sale (POS) cashiering, AKSHIA/NHIA HMO eligibility validation, Copay collection, Invoices.", table_cell)
        ],
        [
            Paragraph("<b>Biomedical Engineer</b>", table_cell),
            Paragraph("<code>biomedical</code><br/>Clearance L3", table_cell),
            Paragraph("Engr. Bassey Inyang", table_cell),
            Paragraph("<code>IGH-BIO-012</code><br/>biomed@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>staff123</code>", table_cell),
            Paragraph("Biomedical Desk: Equipment registry (Ventilators, Defibs, Autoclaves), Maintenance work orders, Oxygen/Solar sensors.", table_cell)
        ],
        [
            Paragraph("<b>Medical Director (CMO)</b>", table_cell),
            Paragraph("<code>medical_director</code><br/>Clearance L6", table_cell),
            Paragraph("Dr. Bassey Eno (CMO)", table_cell),
            Paragraph("<code>AKS-DIR-001</code><br/>cmo@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>director123</code>", table_cell),
            Paragraph("Executive Director Desk: Clinical governance oversight, Hospital-wide mortality reviews, Bed turnaround, Physician metrics.", table_cell)
        ],
        [
            Paragraph("<b>System Administrator (IT)</b>", table_cell),
            Paragraph("<code>sysadmin</code><br/>Clearance L6", table_cell),
            Paragraph("Ola Bankole", table_cell),
            Paragraph("<code>MHQB-ICT-010</code><br/>admin@ibomspecialist.gov.ng", table_cell_code),
            Paragraph("PIN: <code>1234</code><br/>Pwd: <code>admin123</code>", table_cell),
            Paragraph("System Admin Console: User provisioning, RBAC matrix configuration, Audit logs, Multi-tenant facility management.", table_cell)
        ],
    ]

    t_matrix = Table(matrix_rows, colWidths=[90, 70, 75, 115, 75, 115])
    t_matrix.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_matrix)
    story.append(Spacer(1, 14))

    # =========================================================================
    # ROLE-BY-ROLE DETAILED TEST SPECIFICATIONS
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("<b>3. Comprehensive Role-by-Role Test Specifications</b>", h1_style))
    story.append(Paragraph(
        "Each section below specifies the objective, security clearance level, primary workspace, positive test cases, "
        "step-by-step procedures, expected outcomes, and role-boundary validation checks for every role.",
        body_style
    ))

    def make_role_header(role_num, role_title, role_key, clearance, badge_sample, color_theme):
        header_data = [
            [
                Paragraph(f"<b>3.{role_num} Role: {role_title}</b>", ParagraphStyle('RH1', parent=h2_style, textColor=colors.white, spaceBefore=0, spaceAfter=0)),
                Paragraph(f"<b>RoleKey:</b> <code>{role_key}</code> · <b>Clearance:</b> {clearance} · <b>Sample Badge:</b> <code>{badge_sample}</code>", ParagraphStyle('RH2', parent=body_style, textColor=colors.white, alignment=2, spaceAfter=0))
            ]
        ]
        t_rh = Table(header_data, colWidths=[270, 270])
        t_rh.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), color_theme),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        return t_rh

    def make_test_case_table(tc_id, title, precondition, steps, expected, edge_case):
        tc_data = [
            [
                Paragraph(f"<b>Test Case ID:</b> {tc_id}", table_cell_bold),
                Paragraph(f"<b>Title:</b> {title}", table_cell_bold)
            ],
            [
                Paragraph("<b>Pre-conditions:</b>", table_cell),
                Paragraph(precondition, table_cell)
            ],
            [
                Paragraph("<b>Step-by-Step Instructions:</b>", table_cell),
                Paragraph(steps, table_cell)
            ],
            [
                Paragraph("<b>Expected System Behavior:</b>", table_cell),
                Paragraph(expected, table_cell)
            ],
            [
                Paragraph("<b>Edge Case / Boundary Check:</b>", table_cell),
                Paragraph(edge_case, table_cell)
            ]
        ]
        t_tc = Table(tc_data, colWidths=[120, 420])
        t_tc.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        return t_tc

    # -------------------------------------------------------------------------
    # 3.1 HOSPITAL ADMINISTRATOR
    # -------------------------------------------------------------------------
    story.append(make_role_header(1, "Hospital Administrator", "hospital_admin", "Level 5 (Admin)", "AKS-ADM-001", c_primary))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Executive operational oversight, staff credentialing, physical bed capacity, departmental resource allocation, "
        "compliance reporting, and institutional governance across secondary facilities in Akwa Ibom State.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-ADM-01",
        "Staff Enrolment & Digital ID Card Generation (AMC-YYYY-####)",
        "Logged in as Hospital Administrator (Badge AKS-ADM-001 / PIN AKS-0012442).",
        "1. Open left navigation menu and select <b>Staff Enrolment & ID</b>.<br/>"
        "2. Click <b>'Enrol New Staff Member'</b>.<br/>"
        "3. Enter Full Name: <i>'Dr. Emmanuel Udo'</i>, Department: <i>'Paediatrics'</i>, Role: <i>'Medical Officer'</i>, License No: <i>'MDCN-78291'</i>.<br/>"
        "4. Click <b>'Issue Official Staff Credential'</b>.<br/>"
        "5. Observe generated badge format, QR code payload, and clearance level assignment.",
        "System creates record with standardized badge ID format <code>AMC-2026-####</code>. The generated Staff Card "
        "renders with photo placeholder, MDCN license verification badge, and embedded cryptographic QR code readable by MedCore Clinic mobile app.",
        "Attempt to enrol staff without required medical council license. System must flag validation warning."
    ))
    story.append(Spacer(1, 6))
    story.append(make_test_case_table(
        "TC-ADM-02",
        "Command Centre Live Bed Tracking & Facility Pulse",
        "Hospital OS API server running on port 4000; Admin logged in.",
        "1. Navigate to <b>Command Centre</b> from sidebar or quick actions.<br/>"
        "2. Inspect the <b>Beds Matrix</b> (Total beds, Occupied, Reserved, Maintenance).<br/>"
        "3. Toggle filter between <i>'Male Medical Ward'</i>, <i>'Female Surgical'</i>, <i>'Maternity'</i>, and <i>'ICU'</i>.<br/>"
        "4. Click on an occupied bed and view real-time patient metadata overlay.",
        "Real-time bed counts reflect live database state without page refresh. Occupancy rate calculation updates dynamically. "
        "Critical alerts display on the command pulse banner.",
        "Simulate full capacity (100% occupancy). System triggers <b>'Bed Diversion Warning'</b> and alerts triage nurses."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.2 MEDICAL DOCTOR / CLINICIAN
    # -------------------------------------------------------------------------
    story.append(make_role_header(2, "Medical Officer / Doctor", "doctor", "Level 4 (Clinical)", "IGH-DOC-001", c_secondary))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Outpatient and inpatient clinical consultations, electronic SOAP medical record authoring, CPOE diagnostic and "
        "medication orders adhering to the Akwa Ibom State Essential Medicines List (AKS EML), and real-time critical lab review.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-DOC-01",
        "Clinical Consultation SOAP Notes & CPOE EML Prescriptions",
        "Doctor logged in; Patient 'Uduak Essen' checked in and routed to Doctor's OPD consultation queue.",
        "1. On <b>Doctor Desk Home</b>, select patient <i>'Uduak Essen'</i> from the Active Consultation Queue.<br/>"
        "2. Click <b>'Open EMR Encounter'</b>.<br/>"
        "3. Complete <b>SOAP</b> tabs:<br/>"
        "   • <i>Subjective:</i> Acute retrosternal chest pain radiating to left arm, 2 hours duration.<br/>"
        "   • <i>Objective:</i> BP 158/96 mmHg, HR 104 bpm, SpO2 96% on room air.<br/>"
        "   • <i>Assessment:</i> Acute Coronary Syndrome (ICD-10: I20.0).<br/>"
        "   • <i>Plan:</i> Urgent Troponin I, 12-lead ECG, Aspirin 300mg stat, Clopidogrel 300mg stat.<br/>"
        "4. Click <b>'Order Medications'</b>, search <i>'Aspirin 300mg dispersible'</i> (verify AKS EML compliance tag).<br/>"
        "5. Click <b>'Sign & Transmit to Pharmacy Bus'</b>.",
        "Encounter is saved under Patient EMR with doctor's digital signature. Prescription event is emitted onto the WebSocket bus, "
        "immediately populating the Chief Pharmacist's dispense queue without manual refresh.",
        "Prescribe medication outside of AKS EML formulary. System prompts for clinical justification and non-formulary approval override."
    ))
    story.append(Spacer(1, 6))
    story.append(make_test_case_table(
        "TC-DOC-02",
        "Real-Time Critical Lab Result Audio & Visual Alert Reception",
        "Doctor logged in with Doctor Desk open; Lab Tech enters critical value in background.",
        "1. Keep Doctor Desk active.<br/>"
        "2. Lab technician verifies critical Troponin I result (2.1 ng/mL, reference < 0.04).<br/>"
        "3. Observe Doctor Desk header notification bell and audio chime.<br/>"
        "4. Click on the flashing red <b>'CRITICAL LAB ALERT'</b> banner.<br/>"
        "5. Review test values and click <b>'Acknowledge & Action Result'</b>.",
        "Audio notification chimes immediately upon broadcast. Red alert indicator pulses with patient name and critical test parameter. "
        "Clicking acknowledge writes doctor's timestamp to the audit trail.",
        "Verify alert persists if Doctor is on a different sub-tab until explicitly acknowledged."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.3 CONSULTANT SURGEON
    # -------------------------------------------------------------------------
    story.append(make_role_header(3, "Consultant Surgeon", "surgeon", "Level 5 (Consultant)", "GHI-SUR-002", c_accent))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Operative surgery scheduling, perioperative care coordination, WHO Surgical Safety Checklist compliance, "
        "blood bank cross-matching orders, and post-operative ICU recovery placement.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-SUR-01",
        "WHO Surgical Safety Checklist Execution & OT Case Log",
        "Surgeon logged in (Badge GHI-SUR-002 / PIN 1234); Patient booked for emergency laparotomy.",
        "1. On <b>Theatre Desk</b>, select scheduled surgery <i>'Emergency Laparotomy — Patient ID: PAT-1'</i>.<br/>"
        "2. Click <b>'Open Surgical Suite'</b>.<br/>"
        "3. Execute the 3 WHO Checklist Stages:<br/>"
        "   • <b>Sign In (Before Induction):</b> Confirm patient identity, site marked, anaesthesia machine check, pulse oximeter on.<br/>"
        "   • <b>Time Out (Before Incision):</b> Introduction of team members, verbal confirmation of procedure, anticipated blood loss.<br/>"
        "   • <b>Sign Out (Before Leaving OR):</b> Instrument/sponge counts correct, specimen labelled, recovery plan.<br/>"
        "4. Document Intraoperative Findings and Blood Requisition (2 units Packed RBCs cross-matched).<br/>"
        "5. Complete operation and request transfer to <b>ICU Bed 03</b>.",
        "Surgery log marks all 3 checklist checkpoints completed with timestamps and surgeon identity. Blood bank receives "
        "stat cross-match alert. ICU dashboard receives impending transfer notification.",
        "Attempt to complete surgery without verifying instrument count. System blocks sign-out until verified or marked as emergency override with justification."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.4 SENIOR NURSING OFFICER
    # -------------------------------------------------------------------------
    story.append(make_role_header(4, "Senior Nursing Officer", "nurse", "Level 3 (Nursing)", "MSG-NUR-003", c_purple))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Inpatient ward operations, patient triage, vital signs monitoring with National Early Warning Score (NEWS2) calculation, "
        "electronic Medication Administration Record (eMAR), and shift handover reporting.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-NUR-01",
        "Triage Vital Signs Entry & Automatic NEWS2 Deterioration Alert",
        "Nurse logged in (Badge MSG-NUR-003 / PIN 1234); Patient arriving at OPD triage.",
        "1. Navigate to <b>Triage / Vitals Station</b>.<br/>"
        "2. Select patient <i>'Uduak Essen'</i>.<br/>"
        "3. Enter physiological parameters:<br/>"
        "   • Respiration Rate: <i>24 bpm</i> (Score: 2)<br/>"
        "   • Oxygen Saturation: <i>93%</i> (Score: 2)<br/>"
        "   • Systolic Blood Pressure: <i>88 mmHg</i> (Score: 3)<br/>"
        "   • Pulse Rate: <i>118 bpm</i> (Score: 2)<br/>"
        "   • Consciousness: <i>Voice responsive</i> (Score: 3)<br/>"
        "   • Temperature: <i>38.8 °C</i> (Score: 1)<br/>"
        "4. Observe auto-calculated aggregate NEWS2 score.",
        "Total NEWS2 score computes to 13 (High Clinical Risk). Interface immediately displays red emergency deterioration banner "
        "and prompts: <i>'Urgent Clinical Review Required — Alerting Duty Clinician & Ward Lead'</i>.",
        "Enter unrealistic vital signs (e.g., HR = 350 bpm). Input field validates against physiological boundaries."
    ))
    story.append(Spacer(1, 6))
    story.append(make_test_case_table(
        "TC-NUR-02",
        "eMAR Drug Administration Verification & Barcode Validation",
        "Inpatient admitted to Female Medical Ward with active doctor prescription.",
        "1. Open <b>Ward / Inpatient Nursing Suite</b> and select Bed FMW-04.<br/>"
        "2. Click <b>'eMAR Administration'</b>.<br/>"
        "3. Review due medications: <i>'Ceftriaxone 1g IV Stat'</i>.<br/>"
        "4. Click <b>'Administer'</b>, input nurse PIN <code>1234</code> to confirm verification of 5 Rights of Medication Administration.<br/>"
        "5. Submit administration record.",
        "eMAR status changes from 'Due' to 'Administered' with green checkmark, exact timestamp, and nurse badge ID. Dose is logged in patient medical history.",
        "Attempt to administer a medication flagged as 'Patient Allergic' in EMR. System forces high-priority allergy override warning."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.5 MIDWIFE / LABOUR & DELIVERY
    # -------------------------------------------------------------------------
    story.append(make_role_header(5, "Midwife / Labour & Delivery", "midwife", "Level 3 (Midwifery)", "CH-MID-011", colors.HexColor("#DB2777")))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Specialized obstetric and neonatal care, digital partograph monitoring during active labour, "
        "cardiotocography (CTG) fetal heart tracing, delivery outcome documentation, and newborn APGAR scoring.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-MID-01",
        "Digital Partograph Cervical Dilation & Alert Line Crossing",
        "Midwife logged in; Primigravida patient admitted to Labour Ward in active labour.",
        "1. On <b>Labour & Delivery Desk</b>, open patient <i>'Blessing Akpan'</i>.<br/>"
        "2. Click <b>'Digital Partograph'</b>.<br/>"
        "3. Record hourly labour observations:<br/>"
        "   • 08:00 — Cervical dilation: <i>4 cm</i>, Fetal Heart Rate (FHR): <i>140 bpm</i>, Contractions: <i>2 in 10 mins</i>.<br/>"
        "   • 12:00 — Cervical dilation: <i>4 cm</i> (Plot graph point).<br/>"
        "4. Observe curve crossing the WHO <b>'Alert Line'</b>.",
        "Partograph plots trajectory. When dilation crosses the Alert Line, system flags <b>'Prolonged Labour / Arrest of Dilation'</b> "
        "and sends push notification to On-Call Consultant Obstetrician.",
        "Document Postpartum Hemorrhage (PPH) blood loss > 500 mL. System triggers emergency PPH protocol checklist (Uterotonics, IV access, Bimanual compression)."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.6 CHIEF PHARMACIST
    # -------------------------------------------------------------------------
    story.append(make_role_header(6, "Chief Pharmacist", "pharmacist", "Level 3 (Pharmacy)", "GHE-PHA-005", c_green))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Ingestion of e-prescriptions from the clinical bus, clinical drug-drug interaction and contraindication screening, "
        "dispensing against the Akwa Ibom State Essential Medicines List (AKS EML), and real-time inventory stock depletion.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-PHA-01",
        "Real-Time Prescription Ingestion & Inventory Depletion",
        "Doctor transmits electronic prescription for Patient 'Uduak Essen' (Aspirin 300mg, Atorvastatin 40mg).",
        "1. Open <b>Pharmacy Desk</b>.<br/>"
        "2. Notice new prescription appears immediately in the <b>'Pending Dispense Queue'</b> without manual page refresh.<br/>"
        "3. Click on prescription to review prescribed items, doctor digital signature, and patient allergy profile.<br/>"
        "4. Click <b>'Verify Clinical Appropriateness & Stock Availability'</b>.<br/>"
        "5. Enter batch number <code>BN-ASP-2026A</code>, expiry date, and click <b>'Dispense Medications'</b>.",
        "Status changes to 'Dispensed'. System automatically decrements inventory count in the central hospital pharmacy stock ledger. "
        "A dispense event is broadcast to the patient's mobile app and Cashier ledger.",
        "Attempt to dispense item with zero stock balance. System prevents completion and offers alternative formulary bio-equivalents."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.7 SENIOR MEDICAL LABORATORY SCIENTIST
    # -------------------------------------------------------------------------
    story.append(make_role_header(7, "Senior Lab Scientist (LIS)", "lab", "Level 3 (Laboratory)", "GHI-LAB-006", colors.HexColor("#0891B2")))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Laboratory Information System (LIS) specimen accessioning, barcode scanning, analytical diagnostic testing, "
        "reference range validation, and broadcast of critical diagnostic results to clinical leads.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-LAB-01",
        "Specimen Accessioning & Critical Result Broadcasting",
        "Doctor orders stat 'Troponin I' test for patient PAT-1.",
        "1. Open <b>Lab Desk Home</b>.<br/>"
        "2. Locate requisition for patient <i>'Uduak Essen'</i> in <b>Requisition Queue</b>.<br/>"
        "3. Click <b>'Receive Specimen'</b> (Blood sample in EDTA tube, barcode LAB-8829).<br/>"
        "4. Click <b>'Enter Test Results'</b>.<br/>"
        "5. Input parameter: <i>'Troponin I'</i> = <code>2.1</code> ng/mL (Reference: < 0.04 ng/mL).<br/>"
        "6. Tag flag as <b>'CRITICAL'</b> and enter verification PIN <code>1234</code>.<br/>"
        "7. Click <b>'Authorize & Broadcast to Live Bus'</b>.",
        "Result enters patient EMR immediately. WebSocket bus sends high-priority clinical event. Hospital OS top bar bell icon alerts "
        "the treating physician and attending ward nurse with auditory and visual banners.",
        "Simulate negative lab test result (within normal range). Verify normal result populates EMR without triggering emergency red bell chime."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.8 CONSULTANT RADIOLOGIST
    # -------------------------------------------------------------------------
    story.append(make_role_header(8, "Consultant Radiologist", "radiologist", "Level 5 (Radiology)", "MGH-RAD-007", c_purple))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Radiology Information System (RIS) worklist management, Picture Archiving and Communication System (PACS) "
        "DICOM image viewing, diagnostic interpretation, structured radiological reporting, and AI finding verification.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-RAD-01",
        "PACS DICOM Review & Diagnostic Imaging Report Authoring",
        "Radiologist logged in; Stat Chest X-ray performed for emergency department patient.",
        "1. Open <b>Imaging Desk (RIS / PACS)</b>.<br/>"
        "2. Select exam from worklist: <i>'Chest X-Ray AP/PA — Patient: Uduak Essen'</i>.<br/>"
        "3. Open DICOM viewer: test window/level adjustment, zoom, pan, and measurement calipers.<br/>"
        "4. Switch to <b>Diagnostic Reporting</b> panel.<br/>"
        "5. Document Findings: <i>'Cardiomegaly with bilateral pulmonary vascular congestion. No pneumothorax.'</i><br/>"
        "6. Impression: <i>'Consistent with acute congestive cardiac failure.'</i><br/>"
        "7. Click <b>'Sign & Finalize Imaging Report'</b>.",
        "Finalized report is cryptographically signed and attached to patient digital chart. EMR indicates imaging study completed and available for doctor review.",
        "Verify unauthorized role (e.g., Reception or Cashier) cannot access PACS DICOM viewer or edit radiology reports."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.9 RECEPTION & FRONT DESK OFFICER
    # -------------------------------------------------------------------------
    story.append(make_role_header(9, "Reception & Front Desk Officer", "reception", "Level 2 (Records)", "GHA-REC-008", colors.HexColor("#0F766E")))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Front desk patient reception, Master Patient Index (MPI) deduplication, demographic capture, Digital Patient Card "
        "issuance (FHIR QR payload), and clinic OPD visit check-in.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-REC-01",
        "Master Patient Index (MPI) Registration, NIN Capture & Digital Health Card Binding",
        "Receptionist logged in (Badge GHA-REC-008 / PIN 1234) on Reception Workspace.",
        "1. On <b>Reception Workspace</b>, enter search criteria: <i>'Edet Bassey'</i>.<br/>"
        "2. Confirm patient does not exist; click <b>'Register New Patient'</b>.<br/>"
        "3. Enter National Identity Number: <code>12345678901</code> in the dedicated NIN input field.<br/>"
        "4. Fill demographic details: Full Name: <i>'Edet Bassey'</i>, DOB: <i>'14/05/1984'</i>, Gender: <i>'Male'</i>, Phone: <i>'08031234567'</i>, LGA: <i>'Eket'</i>.<br/>"
        "5. Select primary insurance: <i>'AKSHIA (Akwa Ibom State Health Insurance)'</i>, Policy No: <code>AKSHIA-POL-88201</code>.<br/>"
        "6. Click <b>'Generate Master Patient Record & Digital Card'</b>.<br/>"
        "7. Check in patient to <b>General OPD Clinic Queue</b>.",
        "Patient record created with unique Medical Record Number (MRN). The 11-digit NIN is cryptographically bound to the "
        "Statewide Digital Health Card, displayed as verified/bound on the card face and embedded into the FHIR R4 Patient identifier bundle. "
        "Patient name appears in the Triage Nurse's arrival queue.",
        "Attempt to enter non-numeric characters or invalid length in NIN field. Field restricts input strictly to 11 digits."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.10 HEALTH RECORDS OFFICER (HIM)
    # -------------------------------------------------------------------------
    story.append(make_role_header(10, "Health Records Officer (HIM)", "records", "Level 2 (HIM)", "GHA-REC-008", colors.HexColor("#0F766E")))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Health Information Management (HIM), physical and electronic folder transit tracking, Master Patient Index (MPI) "
        "duplicate chart merging, chart deficiency reviews, and standardized clinical coding (ICD-10 / ACHI).",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-HIM-01",
        "Chart Deficiency Review & ICD-10 Morbidity Coding",
        "Discharged inpatient chart forwarded to Health Records department.",
        "1. Open <b>Health Records Command Desk</b>.<br/>"
        "2. Select discharged encounter for patient <i>'Uduak Essen'</i>.<br/>"
        "3. Run <b>Chart Deficiency Audit</b> (checks for: Doctor Signature, Nursing Handover, Discharge Summary, Pharmacy Bill).<br/>"
        "4. Open <b>Clinical Coding Module</b>.<br/>"
        "5. Assign Primary Diagnosis ICD-10 code: <code>I21.0</code> (ST elevation myocardial infarction).<br/>"
        "6. Assign Secondary Diagnosis ICD-10: <code>I10</code> (Essential hypertension).<br/>"
        "7. Assign Procedure ACHI Code: <code>38497-00</code>.<br/>"
        "8. Mark chart as <b>'Audited, Coded & Archived'</b>.",
        "Chart completeness score updates to 100%. ICD-10 codes populate the state NHMIS/DHIS2 epidemiological reporting database. "
        "Record is locked from further unauthorized edits.",
        "Attempt to archive chart with missing physician signature. System flags deficiency and returns folder to doctor's pending chart tray."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.11 CASHIER & FINANCE OFFICER
    # -------------------------------------------------------------------------
    story.append(make_role_header(11, "Hospital Accountant / Cashier", "accountant", "Level 3 (Finance)", "PSY-ACC-009", c_amber))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Point-of-Sale (POS) fee collection, invoice reconciliation, Akwa Ibom State Health Insurance Agency (AKSHIA) "
        "and National Health Insurance Authority (NHIA) policy verification, copay collection, and revenue shift balancing.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-FIN-01",
        "HMO Policy Verification & Multi-Tender Payment Collection",
        "Cashier logged in (Badge PSY-ACC-009 / PIN 1234); Patient presenting at billing counter.",
        "1. On <b>Finance Desk</b>, enter Patient MRN or search <i>'Uduak Essen'</i>.<br/>"
        "2. Review pending unbilled items generated by Doctor and Lab orders.<br/>"
        "3. Click <b>'Verify Insurance Eligibility'</b> using Policy ID <code>AKSHIA-POL-88201</code>.<br/>"
        "4. Observe returned status: <i>'Eligible — Comprehensive Plan (10% Copay on Drugs, 0% on Consult)'</i>.<br/>"
        "5. System recalculates total bill: Original NGN 24,500 -> Patient Copay NGN 1,450.<br/>"
        "6. Select Tender: <i>'POS Terminal — FirstBank'</i>, input transaction reference <code>TXN-99214</code>.<br/>"
        "7. Click <b>'Collect Payment & Print Official Receipt'</b>.",
        "Payment is registered in central ledger. Bill is cleared. An unblocking signal is transmitted to Pharmacy allowing "
        "medication release. Official Akwa Ibom State revenue receipt is generated.",
        "Test with expired policy <code>AKSHIA-POL-EXPIRED</code>. System returns 'Ineligible / Expired' and switches bill to 100% Private Out-of-Pocket tariff."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.12 BIOMEDICAL ENGINEER
    # -------------------------------------------------------------------------
    story.append(make_role_header(12, "Biomedical Engineer & Facilities", "biomedical", "Level 3 (Engineering)", "IGH-BIO-012", colors.HexColor("#475569")))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Medical equipment asset lifecycle management, preventive maintenance schedules, calibration logging, "
        "breakdown work order resolution, and facility utility sensor monitoring (Medical Oxygen plant, Solar-Grid backup, Cold Chain).",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-BIO-01",
        "Ventilator Calibration & Corrective Maintenance Work Order",
        "Biomedical Engineer logged in (Badge with BIO segment / PIN 1234).",
        "1. Open <b>Biomedical Desk</b>.<br/>"
        "2. Review Critical Equipment Registry: Ventilators, Defibrillators, Infant Incubators, Dialysis Machines.<br/>"
        "3. Select equipment <i>'ICU Ventilator #02 — SN: VENT-8819'</i>.<br/>"
        "4. Log scheduled calibration: O2 sensor checked, pressure flow verified within +/- 2% tolerance.<br/>"
        "5. Receive work order from Theatre: <i>'Autoclave Steam Leak'</i>.<br/>"
        "6. Change work order status from <b>'Reported'</b> -> <b>'In Progress'</b> -> <b>'Resolved & Certified Safe'</b>.",
        "Equipment status updates to 'Active & Calibrated'. Clinical theatre desk receives notification that autoclave is operational. "
        "Maintenance cost and replacement gasket parts are logged.",
        "Simulate oxygen manifold pressure drop below threshold (< 4 bar). System triggers alert on Command Centre."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.13 MEDICAL DIRECTOR (CMO)
    # -------------------------------------------------------------------------
    story.append(make_role_header(13, "Medical Director / CMO", "medical_director", "Level 6 (Executive)", "AKS-DIR-001", c_primary))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Institutional clinical governance, state health indicator tracking, departmental clinical audit oversight, "
        "mortality and sentinel event reviews, and physician productivity benchmarking.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-DIR-01",
        "Executive Clinical Governance & Hospital Performance Audit",
        "Medical Director logged in (Badge with DIR segment / PIN 1234).",
        "1. Open <b>Director Desk</b>.<br/>"
        "2. Review <b>Hospital Clinical KPIs</b>:<br/>"
        "   • Average Length of Stay (ALOS): <i>3.4 days</i>.<br/>"
        "   • Bed Turnaround Time: <i>42 minutes</i>.<br/>"
        "   • Emergency Triage-to-Doctor Time: <i>18 minutes</i>.<br/>"
        "   • 30-Day Inpatient Readmission Rate: <i>4.1%</i>.<br/>"
        "3. Inspect Mortality & Adverse Event Log: review anonymized incident report.<br/>"
        "4. Issue Clinical Directive: <i>'Mandatory Sepsis Screening for all acute admissions'</i>.",
        "Executive dashboards display real-time aggregated metrics across all wards. Clinical directive broadcasts to all active doctor and nurse terminals.",
        "Verify non-executive clinician cannot access confidential executive mortality reviews or doctor peer rating statistics."
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 3.14 SYSTEM ADMINISTRATOR & ICT LEAD
    # -------------------------------------------------------------------------
    story.append(make_role_header(14, "System Administrator & ICT Lead", "sysadmin", "Level 6 (SuperAdmin)", "MHQB-ICT-010", colors.HexColor("#1E293B")))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Role Objective:</b> Enterprise security administration, user account provisioning, Role-Based Access Control (RBAC) permission overrides, "
        "multi-tenant facility onboarding, WebSocket gateway health monitoring, and system compliance audit logs.",
        body_style
    ))
    story.append(make_test_case_table(
        "TC-SYS-01",
        "Granular RBAC Permission Lockdown & User Suspension",
        "System Administrator logged in (Badge MHQB-ICT-010 / PIN 1234).",
        "1. Open <b>System Admin Console</b> and select <b>Access Control (RBAC)</b>.<br/>"
        "2. Locate user <i>'Nurse Aisha Bello (MSG-NUR-003)'</i>.<br/>"
        "3. Test emergency suspension: Toggle account status to <b>'Suspended / Deactivated'</b>.<br/>"
        "4. In a separate browser tab, attempt to log in using badge <code>MSG-NUR-003</code> and PIN <code>1234</code>.<br/>"
        "5. Observe system refusal: <i>'Account Suspended — Contact System Administrator'</i>.<br/>"
        "6. In Admin console, re-activate account and verify instant restoration.",
        "Account status update propagates immediately. Suspended user sessions are terminated instantly on the live bus. "
        "All credential changes are recorded in the immutable compliance audit log.",
        "Attempt to modify superadmin permissions without Level 6 clearance. System blocks self-escalation attempt."
    ))
    story.append(Spacer(1, 14))

    # =========================================================================
    # END-TO-END MASTER CLINICAL LOOP SCENARIO
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("<b>4. End-to-End Master Clinical Loop (Patient Journey)</b>", h1_style))
    story.append(Paragraph(
        "To validate cross-role synchronization and real-time clinical bus integrity, the tester must execute this sequential "
        "360-degree patient journey through all operational departments in a single unbroken test session.",
        body_style
    ))

    journey_steps = [
        [
            Paragraph("Step & Role", table_header),
            Paragraph("Department", table_header),
            Paragraph("Action & Test Data Input", table_header),
            Paragraph("Expected Live System State Change", table_header)
        ],
        [
            Paragraph("<b>Step 1</b><br/>Receptionist", table_cell),
            Paragraph("Front Desk", table_cell),
            Paragraph("Search MPI; Register new patient <b>'Uduak Essen'</b> (DOB: 12/03/1980, Female, Phone: 08023456789). Policy: <code>AKSHIA-POL-88201</code>. Check in to OPD.", table_cell),
            Paragraph("Patient record created; Digital Card issued with QR; Patient appears in Triage Queue.", table_cell)
        ],
        [
            Paragraph("<b>Step 2</b><br/>Triage Nurse", table_cell),
            Paragraph("OPD Triage", table_cell),
            Paragraph("Call patient from queue. Record vitals: BP 162/98 mmHg, HR 102 bpm, Temp 37.4°C, SpO2 95%, Pain: 8/10 chest. Flag as <b>Urgent (Yellow)</b>.", table_cell),
            Paragraph("Vitals written to EMR. Patient automatically advances to Doctor's Active Consultation Tray.", table_cell)
        ],
        [
            Paragraph("<b>Step 3</b><br/>Medical Doctor", table_cell),
            Paragraph("Consultation", table_cell),
            Paragraph("Open Patient 360. Enter SOAP consultation notes. Prescribe: <i>Aspirin 300mg stat</i> and <i>Clopidogrel 300mg stat</i>. Order Stat Lab: <i>Troponin I</i>.", table_cell),
            Paragraph("Prescription sent to Pharmacy bus. Lab requisition pushed to LIS. Unbilled items added to Cashier ledger.", table_cell)
        ],
        [
            Paragraph("<b>Step 4</b><br/>Cashier", table_cell),
            Paragraph("Revenue Desk", table_cell),
            Paragraph("Look up patient bill. Verify HMO policy <code>AKSHIA-POL-88201</code>. Collect 10% copay (NGN 1,450) via POS. Issue receipt.", table_cell),
            Paragraph("Bill status marked 'Paid & Eligible'. Pharmacy dispense lock is cleared.", table_cell)
        ],
        [
            Paragraph("<b>Step 5</b><br/>Lab Scientist", table_cell),
            Paragraph("Laboratory (LIS)", table_cell),
            Paragraph("Accession specimen LAB-8829. Input Troponin I result: <code>2.1 ng/mL</code>. Tag as <b>CRITICAL</b> and authorize with PIN <code>1234</code>.", table_cell),
            Paragraph("Live audio chime fires. Red pulsing alert appears on Doctor's and Ward Nurse's screen.", table_cell)
        ],
        [
            Paragraph("<b>Step 6</b><br/>Medical Doctor", table_cell),
            Paragraph("Doctor Desk", table_cell),
            Paragraph("Doctor acknowledges critical alert. Initiates immediate Inpatient Admission Order to <b>Female Medical Ward — Bed 04</b>.", table_cell),
            Paragraph("Bed 04 status flips from 'Available' to 'Reserved/Admitted'. Ward Nurse receives admission notification.", table_cell)
        ],
        [
            Paragraph("<b>Step 7</b><br/>Ward Nurse", table_cell),
            Paragraph("Inpatient Ward", table_cell),
            Paragraph("Accept patient transfer to Bed FMW-04. Open eMAR, verify doctor order, administer stat medications, log nurse verification PIN.", table_cell),
            Paragraph("Bed marked 'Occupied'. eMAR updates to 'Administered'. Real-time bed occupancy in Command Centre increments.", table_cell)
        ],
        [
            Paragraph("<b>Step 8</b><br/>Pharmacist", table_cell),
            Paragraph("Pharmacy", table_cell),
            Paragraph("Review active inpatient orders. Verify batch number <code>BN-ASP-2026A</code>. Complete dispensing.", table_cell),
            Paragraph("Central inventory decrements. Stock ledger records batch tracking and deduction.", table_cell)
        ],
        [
            Paragraph("<b>Step 9</b><br/>Health Records", table_cell),
            Paragraph("HIM Desk", table_cell),
            Paragraph("Retrieve completed encounter chart. Audit chart completeness. Code primary ICD-10 diagnosis <code>I21.0</code>. Archive folder.", table_cell),
            Paragraph("Chart locked. Epidemic surveillance data pushed to state health reporting repository.", table_cell)
        ],
        [
            Paragraph("<b>Step 10</b><br/>Hospital Admin", table_cell),
            Paragraph("Command Centre", table_cell),
            Paragraph("Open Command Centre dashboard. Inspect total admissions, bed occupancy rate, revenue collected, and security audit log.", table_cell),
            Paragraph("Metrics show real-time synchronization across all operational nodes.", table_cell)
        ]
    ]

    t_journey = Table(journey_steps, colWidths=[70, 75, 235, 160])
    t_journey.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_journey)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECURITY & RBAC BOUNDARY TESTS
    # =========================================================================
    story.append(Paragraph("<b>5. Security, RBAC Negative Testing & Boundary Enforcement</b>", h1_style))
    story.append(Paragraph(
        "A critical responsibility of the tester is verifying that unauthorized actions are strictly prohibited by the application. "
        "Execute the negative test cases below to confirm that permission boundaries cannot be breached.",
        body_style
    ))

    rbac_tests = [
        [
            Paragraph("Test ID", table_header),
            Paragraph("Role Under Test", table_header),
            Paragraph("Attempted Unauthorized Action", table_header),
            Paragraph("Expected Security Reaction & Enforcement", table_header)
        ],
        [
            Paragraph("<b>SEC-01</b>", table_cell_bold),
            Paragraph("Receptionist (L2)", table_cell),
            Paragraph("Attempting to access Doctor Desk or prescribe medications via direct URL navigation (<code>/doctor-portal</code>).", table_cell),
            Paragraph("System blocks access, redirects to Reception Front Desk Workspace, and displays <i>'403 Forbidden: Insufficient Clearance Level'</i>.", table_cell)
        ],
        [
            Paragraph("<b>SEC-02</b>", table_cell_bold),
            Paragraph("Cashier (L3)", table_cell),
            Paragraph("Attempting to alter diagnostic lab results or cancel physician clinical orders.", table_cell),
            Paragraph("No edit controls rendered; direct API attempts return <i>'Unauthorized Role for Clinical Modification'</i>.", table_cell)
        ],
        [
            Paragraph("<b>SEC-03</b>", table_cell_bold),
            Paragraph("Doctor (L4)", table_cell),
            Paragraph("Attempting to void or alter payment transactions in the Cashier revenue ledger.", table_cell),
            Paragraph("Cashier ledger controls are hidden and restricted to Finance clearance.", table_cell)
        ],
        [
            Paragraph("<b>SEC-04</b>", table_cell_bold),
            Paragraph("Pharmacist (L3)", table_cell),
            Paragraph("Attempting to sign surgical WHO checklists or allocate ICU beds.", table_cell),
            Paragraph("Theatre suite is restricted to Surgeon clearance (L5).", table_cell)
        ],
        [
            Paragraph("<b>SEC-05</b>", table_cell_bold),
            Paragraph("Nurse (L3)", table_cell),
            Paragraph("Attempting to reconfigure system RBAC role definitions or delete audit logs.", table_cell),
            Paragraph("RBAC configuration console requires Level 6 SuperAdmin clearance.", table_cell)
        ],
        [
            Paragraph("<b>SEC-06</b>", table_cell_bold),
            Paragraph("Suspended Staff", table_cell),
            Paragraph("Logging in with a badge ID that was marked as 'Suspended' by the Hospital Admin.", table_cell),
            Paragraph("Login rejected immediately: <i>'Credential Deactivated. Please report to Hospital Administration'</i>.", table_cell)
        ]
    ]

    t_rbac = Table(rbac_tests, colWidths=[55, 95, 195, 195])
    t_rbac.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#334155")),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_rbac)
    story.append(Spacer(1, 14))

    # =========================================================================
    # MOBILE APP SUITE TEST RUNBOOK
    # =========================================================================
    story.append(Paragraph("<b>6. Mobile Applications Test Runbook (Clinic & Care)</b>", h1_style))
    story.append(Paragraph(
        "MedCore includes two companion mobile applications built on Expo React Native. Testers should validate mobile-desktop "
        "interoperability as outlined below.",
        body_style
    ))

    mobile_data = [
        [
            Paragraph("App Name", table_header),
            Paragraph("User Persona", table_header),
            Paragraph("Primary Mobile Workflows to Validate", table_header),
            Paragraph("Desktop Sync Checkpoint", table_header)
        ],
        [
            Paragraph("<b>MedCore Clinic</b><br/>(Staff Mobile)<br/><code>apps/clinic</code>", table_cell),
            Paragraph("Doctors, Nurses, Ward Staff on mobile shift", table_cell),
            Paragraph("1. Log in via Staff QR badge scan.<br/>"
                      "2. Bedside eMAR administration: scan patient wristband QR to confirm identity.<br/>"
                      "3. Ward round voice-to-text quick clinical notes.<br/>"
                      "4. Digital nurse shift handover checklist.", table_cell),
            Paragraph("Bedside medication administration immediately reflects on Desktop OS eMAR and Ward occupancy board.", table_cell)
        ],
        [
            Paragraph("<b>MedCore Care</b><br/>(Patient Mobile)<br/><code>apps/care</code>", table_cell),
            Paragraph("Patients, Family members, Enrollees", table_cell),
            Paragraph("1. Access FHIR Digital Patient Card with offline QR.<br/>"
                      "2. Review authorized diagnostic lab test results.<br/>"
                      "3. View dispensed medication dosage reminders.<br/>"
                      "4. Request outpatient clinic appointment booking.", table_cell),
            Paragraph("Patient appointment request appears in Front Desk Reception Workspace pending appointment queue.", table_cell)
        ]
    ]

    t_mobile = Table(mobile_data, colWidths=[90, 85, 205, 160])
    t_mobile.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_teal),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_mobile)
    story.append(Spacer(1, 14))

    # =========================================================================
    # DEFECT SEVERITY & ACCEPTANCE SIGN-OFF BLOCK
    # =========================================================================
    story.append(KeepTogether([
        Paragraph("<b>7. Defect Severity Classification & Acceptance Sign-Off</b>", h1_style),
        Paragraph(
            "When logging discrepancies, defects, or usability findings during test execution, assign severity according to "
            "the standardized criteria below:",
            body_style
        ),
        Table([
            [Paragraph("Severity", table_header), Paragraph("Definition", table_header), Paragraph("Hospital Operational Impact", table_header), Paragraph("SLA", table_header)],
            [Paragraph("<font color='#E11D48'><b>Sev-1: Blocker</b></font>", table_cell), Paragraph("System crash, data corruption, patient safety risk, clinical alert failure.", table_cell), Paragraph("Halt pilot; immediate developer intervention required.", table_cell), Paragraph("4 hours", table_cell_bold)],
            [Paragraph("<font color='#D97706'><b>Sev-2: Major</b></font>", table_cell), Paragraph("Core role function impaired without practical workaround (e.g., cannot dispense drugs).", table_cell), Paragraph("Departmental operations degraded; priority hotfix.", table_cell), Paragraph("24 hours", table_cell_bold)],
            [Paragraph("<font color='#0284C7'><b>Sev-3: Moderate</b></font>", table_cell), Paragraph("Non-critical workflow defect with manual operational workaround.", table_cell), Paragraph("Minor staff inconvenience; resolved in scheduled build.", table_cell), Paragraph("72 hours", table_cell_bold)],
            [Paragraph("<font color='#64748B'><b>Sev-4: Minor</b></font>", table_cell), Paragraph("Cosmetic layout defect, typographical error, minor styling misalignment.", table_cell), Paragraph("No operational impact; addressed in next polish cycle.", table_cell), Paragraph("1 week", table_cell_bold)],
        ], colWidths=[90, 200, 180, 70], style=[
            ('BACKGROUND', (0, 0), (-1, 0), c_primary),
            ('GRID', (0, 0), (-1, -1), 0.5, c_border),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ]),
        Spacer(1, 15),
        Paragraph("<b>Formal Acceptance & Pilot Readiness Sign-Off Block</b>", h2_style),
        Table([
            [
                Paragraph("<b>Lead Quality Assurance Engineer:</b><br/><br/>Name: ___________________________<br/>Sign: ___________________________<br/>Date: ___________________________", callout_style),
                Paragraph("<b>Clinical Champion / Lead Clinician:</b><br/><br/>Name: ___________________________<br/>Sign: ___________________________<br/>Date: ___________________________", callout_style),
                Paragraph("<b>Hospital ICT Director / Ministry Lead:</b><br/><br/>Name: ___________________________<br/>Sign: ___________________________<br/>Date: ___________________________", callout_style)
            ]
        ], colWidths=[180, 180, 180], style=[
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ])
    ]))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Manual successfully created at: {output_filename}")

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "MedCore_All_Roles_Tester_Manual.pdf"
    create_tester_manual(out)
