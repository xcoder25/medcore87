/* ============================================================
   CONSULTATIONS PAGE
   ============================================================ */
Pages.consultations = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  let selectedPatient = D.patients[0];
  let noteType = 'SOAP';

  root.innerHTML = `
  <div class="page-enter">
    ${C.pageHeader('🩺 Consultations','Document clinical assessments and consultation notes')}

    <div class="content-cols-sidebar">

      <!-- LEFT: Previous Consultations -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 Patient</div>
          </div>
          <div class="card-body" style="padding:var(--space-3);">
            <div class="search-input-wrap mb-3">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Search patient..." oninput="Pages.searchConsultPatient(this.value)">
            </div>
            <div id="consult-patient-list">
              ${D.patients.map(p=>`
                <div class="message-item ${p.id===selectedPatient.id?'unread':''}" onclick="Pages.selectConsultPatient('${p.id}')">
                  ${C.avatar(p, 38)}
                  <div class="message-body">
                    <div class="message-name">${p.name}</div>
                    <div class="message-preview">${p.diagnoses[0]}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">📝 Recent Notes</div></div>
          <div class="card-body" style="padding:var(--space-3);">
            ${D.clinicalNotes.map(n=>`
              <div style="padding:8px;border-radius:var(--radius-md);cursor:pointer;margin-bottom:6px;border:1px solid var(--border);" onclick="Pages.viewNote('${n.id}')">
                <div style="font-size:12px;font-weight:700;">${n.title}</div>
                <div style="font-size:10px;color:var(--text-muted);">${n.type} • ${n.date}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${n.content}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- RIGHT: SOAP Form -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📄 New Consultation Note</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Patient: <strong>${selectedPatient.name}</strong> (${selectedPatient.mrn})</div>
          </div>
          <div class="flex gap-2 items-center">
            <select class="form-control form-control-sm" id="note-type" onchange="Pages.switchNoteType(this.value)" style="width:160px;">
              <option>SOAP Note</option>
              <option>Progress Note</option>
              <option>Admission Note</option>
              <option>Ward Round Note</option>
              <option>Consultation Note</option>
              <option>Procedure Note</option>
              <option>Discharge Summary</option>
            </select>
          </div>
        </div>

        <div class="card-body" id="consult-form">
          ${renderSOAP()}
        </div>

        <div class="card-footer">
          <div class="flex justify-between items-center">
            <div style="font-size:12px;color:var(--text-muted);">🔐 Digital signature will be applied on save</div>
            <div class="flex gap-3">
              <button class="btn btn-ghost" onclick="if(confirm('Clear note?'))document.getElementById('consult-form').innerHTML = Pages.renderSOAPContent();">🗑 Clear</button>
              <button class="btn btn-outline" onclick="alert('Note saved as draft (demo)')">💾 Save Draft</button>
              <button class="btn btn-primary" onclick="Pages.signNote()">✅ Sign & Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  function renderSOAP() {
    return `
    <!-- SECTION TABS -->
    <div class="tab-bar" id="soap-tabs" style="margin-bottom:var(--space-4);">
      <button class="tab-item active" onclick="Pages.switchSOAP(this,'soap-s')">S — Subjective</button>
      <button class="tab-item" onclick="Pages.switchSOAP(this,'soap-o')">O — Objective</button>
      <button class="tab-item" onclick="Pages.switchSOAP(this,'soap-a')">A — Assessment</button>
      <button class="tab-item" onclick="Pages.switchSOAP(this,'soap-p')">P — Plan</button>
    </div>

    <!-- S: Subjective -->
    <div id="soap-s" class="tab-content active">
      <div class="form-group">
        <label class="form-label">Chief Complaint <span class="required">*</span></label>
        <input class="form-control" placeholder="e.g. Shortness of breath and swollen ankles for 3 days">
      </div>
      <div class="form-group">
        <label class="form-label">History of Presenting Illness</label>
        <textarea class="form-control" rows="4" placeholder="Describe onset, duration, character, associated symptoms, aggravating and relieving factors..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Duration</label>
          <input class="form-control" placeholder="e.g. 3 days">
        </div>
        <div class="form-group">
          <label class="form-label">Severity (1–10)</label>
          <input class="form-control" type="range" min="1" max="10" value="5">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Past Medical History</label>
        <textarea class="form-control" rows="2" placeholder="Previous illnesses, hospitalisations, surgeries..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Drug History & Allergies</label>
        <textarea class="form-control" rows="2" placeholder="Current medications, previous adverse drug reactions...">Amlodipine 5mg OD, Metformin 500mg BD, Lisinopril 10mg OD
ALLERGIES: Penicillin, Aspirin</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Social History</label>
          <textarea class="form-control" rows="2" placeholder="Occupation, smoking, alcohol, social circumstances..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Family History</label>
          <textarea class="form-control" rows="2" placeholder="Relevant family history..."></textarea>
        </div>
      </div>
    </div>

    <!-- O: Objective -->
    <div id="soap-o" class="tab-content">
      <div style="margin-bottom:var(--space-4);">
        <div class="divider-text" style="margin-bottom:var(--space-3);">VITAL SIGNS</div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Blood Pressure</label>
            <div class="input-group">
              <input type="text" placeholder="120/80" value="${selectedPatient.vitals.bp}">
              <span class="input-group-suffix">mmHg</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Heart Rate</label>
            <div class="input-group">
              <input type="number" placeholder="78" value="${selectedPatient.vitals.pulse}">
              <span class="input-group-suffix">bpm</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Temperature</label>
            <div class="input-group">
              <input type="number" step="0.1" placeholder="36.8" value="${selectedPatient.vitals.temp}">
              <span class="input-group-suffix">°C</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">SpO₂</label>
            <div class="input-group">
              <input type="number" placeholder="97" value="${selectedPatient.vitals.spo2}">
              <span class="input-group-suffix">%</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Resp. Rate</label>
            <div class="input-group">
              <input type="number" placeholder="18" value="${selectedPatient.vitals.rr}">
              <span class="input-group-suffix">/min</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Weight</label>
            <div class="input-group">
              <input type="number" placeholder="72" value="${selectedPatient.vitals.weight}">
              <span class="input-group-suffix">kg</span>
            </div>
          </div>
        </div>
      </div>
      <div class="divider-text" style="margin-bottom:var(--space-3);">PHYSICAL EXAMINATION</div>
      <div class="form-group">
        <label class="form-label">General Examination</label>
        <textarea class="form-control" rows="2" placeholder="e.g. Alert and oriented, not in acute distress, mild pallor noted..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Cardiovascular Examination</label>
        <textarea class="form-control" rows="2" placeholder="e.g. Heart sounds S1+S2, no murmur, JVP not elevated..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Respiratory Examination</label>
        <textarea class="form-control" rows="2" placeholder="e.g. Air entry bilaterally equal, bilateral basal crepitations..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Abdominal Examination</label>
        <textarea class="form-control" rows="2" placeholder="e.g. Soft, non-tender, no organomegaly..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Clinical Findings Summary</label>
        <textarea class="form-control" rows="2" placeholder="Relevant positive and negative findings..."></textarea>
      </div>
    </div>

    <!-- A: Assessment -->
    <div id="soap-a" class="tab-content">
      <div class="alert alert-critical mb-4">
        <span class="alert-icon">⚠</span>
        <div>Known allergies: <strong>${selectedPatient.allergies.join(', ')||'None'}</strong> — ensure prescriptions avoid these drugs.</div>
      </div>
      <div class="form-group">
        <label class="form-label">Primary Diagnosis <span class="required">*</span></label>
        <input class="form-control" placeholder="Search ICD-10 code or enter diagnosis..." value="${selectedPatient.diagnoses[0]||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Secondary Diagnoses</label>
        ${selectedPatient.diagnoses.slice(1).map(d=>`<input class="form-control" style="margin-bottom:8px;" value="${d}">`).join('')}
        <input class="form-control" placeholder="+ Add secondary diagnosis...">
      </div>
      <div class="form-group">
        <label class="form-label">Differential Diagnoses</label>
        <textarea class="form-control" rows="2" placeholder="List of considered alternative diagnoses..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Clinical Impression</label>
        <textarea class="form-control" rows="3" placeholder="Overall clinical impression and reasoning..."></textarea>
      </div>
    </div>

    <!-- P: Plan -->
    <div id="soap-p" class="tab-content">
      <div class="form-group">
        <label class="form-label">Investigations Ordered</label>
        <textarea class="form-control" rows="2" placeholder="e.g. FBC, U&E, CXR, ECG..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Medications / Changes</label>
        <textarea class="form-control" rows="3" placeholder="New medications, dose changes, discontinuations..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Referrals</label>
          <input class="form-control" placeholder="e.g. Refer to Cardiology for CCF management">
        </div>
        <div class="form-group">
          <label class="form-label">Procedures</label>
          <input class="form-control" placeholder="e.g. IV cannulation, wound dressing">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Follow-up</label>
          <input class="form-control" type="date">
        </div>
        <div class="form-group">
          <label class="form-label">Admission / Discharge</label>
          <select class="form-control">
            <option>Continue current admission</option>
            <option>Transfer to ICU</option>
            <option>Transfer to Ward</option>
            <option>Plan for discharge</option>
            <option>Discharge today</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Patient / Family Instructions</label>
        <textarea class="form-control" rows="2" placeholder="Discharge instructions, dietary advice, activity restrictions..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Additional Notes</label>
        <textarea class="form-control" rows="2" placeholder="Any other clinical notes..."></textarea>
      </div>
    </div>`;
  }

  Pages.renderSOAPContent = renderSOAP;

  Pages.switchSOAP = function(btn, id) {
    document.querySelectorAll('#soap-tabs .tab-item').forEach(el=>el.classList.remove('active'));
    document.querySelectorAll('#soap-s,#soap-o,#soap-a,#soap-p').forEach(el=>el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(id).classList.add('active');
  };

  Pages.signNote = function() {
    C.showModal('sign-modal','✅ Sign & Save Note',`
      <div class="alert alert-info mb-4">
        <span class="alert-icon">ℹ</span>
        <div>By signing this note, you confirm it is accurate and take full clinical responsibility.</div>
      </div>
      <div style="background:var(--surface);border-radius:var(--radius-md);padding:var(--space-4);margin-bottom:var(--space-4);">
        <div style="font-size:12px;color:var(--text-muted);">DIGITAL SIGNATURE</div>
        <div style="font-size:16px;font-weight:700;font-style:italic;color:var(--primary);margin-top:8px;">Dr. Adewale Bello</div>
        <div style="font-size:11px;color:var(--text-muted);">General Physician • Internal Medicine • ${new Date().toLocaleString()}</div>
      </div>
    `,`
      <button class="btn btn-ghost" onclick="document.getElementById('sign-modal').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="alert('Note signed and saved successfully (demo)');document.getElementById('sign-modal').remove();">✅ Confirm & Sign</button>
    `,'modal-sm');
  };
};
