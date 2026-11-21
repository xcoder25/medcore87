'use client';

/**
 * Printable AI-Scannable Blank Patient Registration Form Generator (A4).
 * Designed specifically for clean handwriting / high-OCR accuracy with PhysicalFormScannerModal.
 */

export interface PrintableRegFormOptions {
  facilityName: string;
  facilityId?: string;
  hfrCode?: string;
  facilityPhone?: string;
  facilityAddress?: string;
  logoUrl?: string;
  copies?: number;
  includeConsentBlock?: boolean;
}

function escHtml(v: string | undefined | null): string {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCharBoxes(count: number): string {
  return Array.from({ length: count })
    .map(() => '<span class="box"></span>')
    .join('');
}

export function buildPrintablePatientRegFormHtml(opts: PrintableRegFormOptions): string {
  const facilityName = escHtml(opts.facilityName || 'MedCore Hospital Facility');
  const facilityId = escHtml(opts.facilityId || 'FAC-01');
  const hfrCode = opts.hfrCode ? escHtml(opts.hfrCode) : '';
  const facilityPhone = opts.facilityPhone ? escHtml(opts.facilityPhone) : '';
  const facilityAddress = opts.facilityAddress ? escHtml(opts.facilityAddress) : '';
  const copies = Math.max(1, Math.min(25, Number(opts.copies) || 1));
  const includeConsent = opts.includeConsentBlock !== false;
  const logoHtml = opts.logoUrl
    ? `<img src="${escHtml(opts.logoUrl)}" alt="Hospital Logo" style="height:44px;width:44px;object-fit:contain;border-radius:6px;border:1px solid #cbd5e1;" />`
    : `<div style="height:44px;width:44px;border:1.5px solid #0f172a;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;">MC</div>`;

  const singleForm = `
    <div class="form-page">
      <div class="fiducial tl"></div>
      <div class="fiducial tr"></div>
      <div class="fiducial bl"></div>
      <div class="fiducial br"></div>

      <header class="hdr">
        <div class="hdr-left">
          ${logoHtml}
          <div>
            <div class="fac-name">${facilityName}</div>
            <div class="fac-meta">
              Code: ${facilityId}${hfrCode ? ` &middot; HFR: ${hfrCode}` : ''}${facilityPhone ? ` &middot; Tel: ${facilityPhone}` : ''}
            </div>
            ${facilityAddress ? `<div class="fac-meta">${facilityAddress}</div>` : ''}
          </div>
        </div>
        <div class="hdr-right">
          <div class="doc-title">PATIENT REGISTRATION FORM</div>
          <div class="doc-sub">AI-Scannable Paper Intake &middot; Fill in <strong>BLOCK CAPITALS</strong> (Dark Ink)</div>
        </div>
      </header>

      <section class="sec">
        <div class="sec-title">1. PATIENT IDENTITY &amp; DEMOGRAPHICS</div>
        <div class="grid-3">
          <div class="field"><label>Last Name / Surname *</label><div class="line"></div></div>
          <div class="field"><label>First Name *</label><div class="line"></div></div>
          <div class="field"><label>Middle Name</label><div class="line"></div></div>
        </div>
        <div class="grid-4" style="margin-top:7px;">
          <div class="field"><label>Date of Birth (DD / MM / YYYY) *</label><div class="boxes">${renderCharBoxes(2)}<span class="sep">/</span>${renderCharBoxes(2)}<span class="sep">/</span>${renderCharBoxes(4)}</div></div>
          <div class="field"><label>Age (Years)</label><div class="line"></div></div>
          <div class="field">
            <label>Sex *</label>
            <div class="checks">
              <span><span class="chk"></span> Male (M)</span>
              <span><span class="chk"></span> Female (F)</span>
              <span><span class="chk"></span> Other</span>
            </div>
          </div>
          <div class="field">
            <label>Marital Status</label>
            <div class="checks">
              <span><span class="chk"></span> Single</span>
              <span><span class="chk"></span> Married</span>
              <span><span class="chk"></span> Widowed</span>
            </div>
          </div>
        </div>
        <div class="grid-3" style="margin-top:7px;">
          <div class="field"><label>Occupation</label><div class="line"></div></div>
          <div class="field"><label>Religion</label><div class="line"></div></div>
          <div class="field"><label>National ID (NIN &mdash; 11 Digits)</label><div class="boxes">${renderCharBoxes(11)}</div></div>
        </div>
      </section>

      <section class="sec">
        <div class="sec-title">2. CONTACT &amp; ADDRESS DETAILS</div>
        <div class="grid-3">
          <div class="field"><label>Primary Phone Number *</label><div class="line"></div></div>
          <div class="field"><label>Alternate Phone</label><div class="line"></div></div>
          <div class="field"><label>Email Address</label><div class="line"></div></div>
        </div>
        <div class="grid-3" style="margin-top:7px;">
          <div class="field" style="grid-column:span 2;"><label>Residential Street Address *</label><div class="line"></div></div>
          <div class="field"><label>State / LGA / Ward *</label><div class="line"></div></div>
        </div>
      </section>

      <section class="sec">
        <div class="sec-title">3. CLINICAL SAFETY &amp; HEALTH INSURANCE (HMO / NHIA)</div>
        <div class="grid-4">
          <div class="field">
            <label>Blood Group</label>
            <div class="checks">
              <span><span class="chk"></span>O+</span><span><span class="chk"></span>A+</span><span><span class="chk"></span>B+</span><span><span class="chk"></span>AB+</span><span><span class="chk"></span>O-</span>
            </div>
          </div>
          <div class="field">
            <label>Genotype</label>
            <div class="checks">
              <span><span class="chk"></span>AA</span><span><span class="chk"></span>AS</span><span><span class="chk"></span>SS</span><span><span class="chk"></span>AC</span>
            </div>
          </div>
          <div class="field"><label>Insurance / HMO Provider (or Self-Pay)</label><div class="line"></div></div>
          <div class="field"><label>NHIA / AKSHIA / Enrollee No.</label><div class="line"></div></div>
        </div>
        <div class="grid-3" style="margin-top:7px;">
          <div class="field"><label>Known Drug / Food Allergies (write NONE if none)</label><div class="line"></div></div>
          <div class="field"><label>Chronic Conditions (e.g. HTN, Diabetes, Asthma)</label><div class="line"></div></div>
          <div class="field"><label>Current Regular Medications</label><div class="line"></div></div>
        </div>
      </section>

      <section class="sec">
        <div class="sec-title">4. NEXT OF KIN &amp; CLINIC VISIT DETAILS</div>
        <div class="grid-3">
          <div class="field"><label>Next of Kin Full Name *</label><div class="line"></div></div>
          <div class="field"><label>Relationship (e.g. Spouse, Parent)</label><div class="line"></div></div>
          <div class="field"><label>Next of Kin Phone *</label><div class="line"></div></div>
        </div>
        <div class="grid-3" style="margin-top:7px;">
          <div class="field"><label>Preferred Clinic / Department</label><div class="line"></div></div>
          <div class="field" style="grid-column:span 2;"><label>Reason for Today's Visit / Chief Complaint</label><div class="line"></div></div>
        </div>
      </section>

      ${
        includeConsent
          ? `<section class="sec consent-box">
        <div class="sec-title">5. PATIENT DATA PRIVACY &amp; REGISTRATION CONSENT (NDPR)</div>
        <p class="consent-text">
          I confirm that the information provided above is accurate and consent to ${facilityName} creating and maintaining my encrypted electronic health record for clinical care, laboratory/pharmacy services, and statutory care continuity.
        </p>
        <div class="grid-3" style="margin-top:8px;">
          <div class="field"><label>Patient / Guardian Signature</label><div class="line"></div></div>
          <div class="field"><label>Date</label><div class="line"></div></div>
          <div class="field"><label>Official Use: Assigned Hospital No. &amp; Officer</label><div class="line"></div></div>
        </div>
      </section>`
          : `<section class="sec">
        <div class="sec-title">5. OFFICIAL FRONT DESK VERIFICATION</div>
        <div class="grid-3">
          <div class="field"><label>Patient / Guardian Signature</label><div class="line"></div></div>
          <div class="field"><label>Assigned Hospital Number</label><div class="line"></div></div>
          <div class="field"><label>Receiving Desk Officer &amp; Date</label><div class="line"></div></div>
        </div>
      </section>`
      }

      <footer class="ftr">
        <span>Tip: Place flat on desk or hold steady under bright light when scanning into AI Paper Form Scanner.</span>
        <span>${facilityName} &middot; Intake Template v2</span>
      </footer>
    </div>
  `;

  const pages = Array.from({ length: copies }).map(() => singleForm).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Patient Registration Form — ${facilityName}</title>
  <style>
    @page { size: A4 portrait; margin: 9mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .form-page { position: relative; border: 1.5px solid #0f172a; padding: 14px 16px; min-height: 274mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
    .form-page:last-child { page-break-after: auto; }
    .fiducial { position: absolute; width: 10px; height: 10px; border: 2px solid #0f172a; }
    .fiducial.tl { top: 4px; left: 4px; border-right: none; border-bottom: none; }
    .fiducial.tr { top: 4px; right: 4px; border-left: none; border-bottom: none; }
    .fiducial.bl { bottom: 4px; left: 4px; border-right: none; border-top: none; }
    .fiducial.br { bottom: 4px; right: 4px; border-left: none; border-top: none; }
    .hdr { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 8px; }
    .hdr-left { display: flex; align-items: center; gap: 10px; }
    .fac-name { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; }
    .fac-meta { font-size: 10px; color: #334155; margin-top: 2px; }
    .hdr-right { text-align: right; }
    .doc-title { font-size: 13px; font-weight: 800; letter-spacing: 0.04em; background: #0f172a; color: #fff; padding: 4px 10px; border-radius: 4px; display: inline-block; }
    .doc-sub { font-size: 9.5px; color: #334155; margin-top: 4px; }
    .sec { border: 1px solid #94a3b8; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
    .sec-title { font-size: 10px; font-weight: 800; color: #0f172a; letter-spacing: 0.05em; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .field label { display: block; font-size: 9px; font-weight: 700; color: #334155; margin-bottom: 3px; }
    .line { border-bottom: 1.3px solid #334155; height: 22px; background: #f8fafc; }
    .boxes { display: flex; align-items: center; gap: 2px; height: 22px; }
    .box { display: inline-block; width: 15px; height: 20px; border: 1.2px solid #334155; background: #fff; }
    .sep { font-size: 11px; font-weight: 700; margin: 0 1px; }
    .checks { display: flex; flex-wrap: wrap; gap: 8px; font-size: 10px; font-weight: 600; padding-top: 4px; }
    .chk { display: inline-block; width: 11px; height: 11px; border: 1.3px solid #0f172a; margin-right: 3px; vertical-align: -1px; }
    .consent-box { background: #f8fafc; }
    .consent-text { margin: 0; font-size: 9.5px; line-height: 1.4; color: #1e293b; }
    .ftr { display: flex; justify-content: space-between; font-size: 9px; color: #475569; border-top: 1px dashed #94a3b8; padding-top: 5px; margin-top: 4px; }
  </style>
</head>
<body>
${pages}
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { try { window.print(); } catch (e) {} }, 180);
  });
</script>
</body>
</html>`;
}

export function printBlankPatientRegForm(opts: PrintableRegFormOptions): boolean {
  if (typeof window === 'undefined') return false;
  const html = buildPrintablePatientRegFormHtml(opts);
  const w = window.open('', '_blank', 'width=860,height=1050');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
  }

  // Fallback hidden iframe when browser blocks popups
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      window.setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch { /* ignore */ }
        window.setTimeout(() => iframe.remove(), 1500);
      }, 250);
      return true;
    }
    iframe.remove();
  } catch {
    /* ignore */
  }
  return false;
}
