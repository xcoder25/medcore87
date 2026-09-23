/* ============================================================
   REFERRALS PAGE
   ============================================================ */
Pages.referrals = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  root.innerHTML = `
  <div class="page-enter">
    ${C.pageHeader('↗ Referrals & Consultations','Manage outgoing and incoming referrals',`
      <button class="btn btn-primary" onclick="Pages.showNewReferralModal()">➕ New Referral</button>
    `)}

    <div class="content-cols-main">
      <!-- LEFT: Referral List -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="tab-bar" id="ref-tabs">
          <button class="tab-item active" onclick="Pages.switchRefTab(this,'ref-out')">📤 Outgoing (${D.referrals.filter(r=>r.type==='outgoing').length})</button>
          <button class="tab-item" onclick="Pages.switchRefTab(this,'ref-in')">📥 Incoming (${D.referrals.filter(r=>r.type==='incoming').length})</button>
        </div>

        <div id="ref-out" class="tab-content active">
          ${D.referrals.filter(r=>r.type==='outgoing').map(r=>renderReferralCard(r)).join('')}
        </div>
        <div id="ref-in" class="tab-content">
          ${D.referrals.filter(r=>r.type==='incoming').map(r=>renderReferralCard(r)).join('')}
        </div>
      </div>

      <!-- RIGHT: Referral Stats -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        ${[
          {label:'Outgoing Referrals',val:D.referrals.filter(r=>r.type==='outgoing').length,icon:'📤',color:'var(--primary)'},
          {label:'Incoming Referrals',val:D.referrals.filter(r=>r.type==='incoming').length,icon:'📥',color:'var(--accent)'},
          {label:'Pending Response',val:D.referrals.filter(r=>r.status==='pending').length,icon:'⏳',color:'var(--warning)'},
          {label:'Completed',val:D.referrals.filter(r=>r.status==='completed').length,icon:'✅',color:'var(--success)'},
        ].map(s=>`
          <div class="card" style="padding:var(--space-4);border-left:3px solid ${s.color};">
            <div class="flex items-center gap-3">
              <span style="font-size:24px;">${s.icon}</span>
              <div>
                <div style="font-size:24px;font-weight:800;line-height:1;color:${s.color};">${s.val}</div>
                <div style="font-size:12px;color:var(--text-muted);">${s.label}</div>
              </div>
            </div>
          </div>`).join('')}

        <!-- Referral Status Pipeline -->
        <div class="card">
          <div class="card-header"><div class="card-title">📊 Status Pipeline</div></div>
          <div class="card-body">
            ${['Requested','Accepted','In Consultation','Completed'].map((step,i)=>`
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                <div style="width:28px;height:28px;border-radius:50%;background:${i===0?'var(--warning)':i===1?'var(--primary)':i===2?'var(--purple)':'var(--success)'};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${i+1}</div>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:600;">${step}</div>
                </div>
                <div style="font-size:12px;font-weight:700;color:${i===0?'var(--warning)':i===1?'var(--primary)':i===2?'var(--purple)':'var(--success)'};">
                  ${D.referrals.filter(r=>r.status===['pending','accepted','in-consultation','completed'][i]).length}
                </div>
              </div>
              ${i<3?`<div style="width:2px;height:16px;background:var(--border);margin:0 13px;"></div>`:''}`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;

  function renderReferralCard(r) {
    const urgencyColor = {emergency:'var(--critical)',urgent:'var(--warning)',routine:'var(--success)'}[r.urgency]||'var(--success)';
    return `
    <div class="card mb-4" style="border-left:4px solid ${urgencyColor};">
      <div class="card-body">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div style="font-size:14px;font-weight:700;">${r.patientName}</div>
            <div style="font-size:12px;color:var(--text-muted);">${r.type==='outgoing'?`To: ${r.toSpec}`:`From: ${r.fromDoctor}`} • ${r.date}</div>
          </div>
          <div class="flex gap-2 items-center">
            <span class="badge" style="background:${urgencyColor}20;color:${urgencyColor};">${r.urgency.toUpperCase()}</span>
            ${C.statusBadge(r.status)}
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;">${r.reason}</div>
        ${r.consultant?`<div style="font-size:12px;color:var(--text-muted);">👨‍⚕️ Consultant: ${r.consultant}</div>`:''}
        <div class="flex gap-2 mt-3">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/emr/${r.patient||''}')">📋 Patient Record</button>
          ${r.status==='pending'?`<button class="btn btn-primary btn-sm" onclick="alert('Following up (demo)')">📞 Follow Up</button>`:''}
        </div>
      </div>
    </div>`;
  }

  Pages.switchRefTab = function(btn, id) {
    document.querySelectorAll('#ref-tabs .tab-item').forEach(el=>el.classList.remove('active'));
    document.querySelectorAll('#ref-out,#ref-in').forEach(el=>el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(id).classList.add('active');
  };

  Pages.showNewReferralModal = function() {
    C.showModal('new-ref-modal','↗ New Referral',`
      <div class="form-group">
        <label class="form-label">Patient <span class="required">*</span></label>
        <select class="form-control">
          ${D.patients.map(p=>`<option>${p.name} — ${p.mrn}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Referring To — Specialty <span class="required">*</span></label>
          <select class="form-control">
            <option>Cardiology</option><option>Nephrology</option><option>Neurology</option><option>Gastroenterology</option>
            <option>Haematology</option><option>Endocrinology</option><option>Pulmonology</option><option>Orthopaedics</option>
            <option>Oncology</option><option>Psychiatry</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Urgency <span class="required">*</span></label>
          <select class="form-control"><option>Routine</option><option>Urgent</option><option>Emergency</option></select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Reason for Referral <span class="required">*</span></label>
        <textarea class="form-control" rows="4" placeholder="Clinical indication, reason for referral, specific clinical question..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Clinical Summary</label>
        <textarea class="form-control" rows="3" placeholder="Brief clinical history, diagnosis, relevant investigations..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Relevant Investigations</label>
        <textarea class="form-control" rows="2" placeholder="Relevant lab results, imaging findings..."></textarea>
      </div>
    `,`
      <button class="btn btn-ghost" onclick="document.getElementById('new-ref-modal').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="alert('Referral sent (demo)');document.getElementById('new-ref-modal').remove();">📤 Send Referral</button>
    `,'modal-lg');
  };
};

/* ============================================================
   CLINICAL NOTES PAGE
   ============================================================ */
Pages['clinical-notes'] = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  root.innerHTML = `
  <div class="page-enter">
    ${C.pageHeader('📝 Clinical Notes','Document and manage patient clinical notes')}

    <div class="content-cols-sidebar">
      <!-- LEFT: Notes List -->
      <div>
        <div class="card">
          <div class="card-header"><div class="card-title">📋 All Notes</div></div>
          <div class="card-body" style="padding:var(--space-3);">
            <div class="search-input-wrap mb-3">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Search notes...">
            </div>
            <div class="filter-chips mb-3 flex-wrap">
              ${['All','SOAP','Progress','Admission','Ward Round','Discharge'].map((t,i)=>`
                <button class="filter-chip ${i===0?'active':''}">${t}</button>`).join('')}
            </div>
            ${D.clinicalNotes.map(n=>`
              <div style="padding:10px;border-radius:var(--radius-md);border:1px solid var(--border);margin-bottom:8px;cursor:pointer;transition:border-color 0.15s;" onclick="Pages.selectNote('${n.id}')" onmouseenter="this.style.borderColor='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)'">
                <div class="flex justify-between items-center mb-1">
                  <div style="font-size:12px;font-weight:700;">${n.title}</div>
                  <span class="badge badge-primary" style="font-size:9px;">${n.type}</span>
                </div>
                <div style="font-size:10px;color:var(--text-muted);">${n.date} • ${n.author}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${n.content.slice(0,80)}...</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- RIGHT: Note Editor -->
      <div class="card" style="display:flex;flex-direction:column;">
        <div class="card-header">
          <div class="card-title">✏ Note Editor</div>
          <div class="flex gap-2">
            <select class="form-control form-control-sm" style="width:160px;">
              <option>Progress Note</option><option>SOAP Note</option><option>Admission Note</option><option>Ward Round Note</option><option>Discharge Summary</option>
            </select>
          </div>
        </div>
        <div class="card-body" style="flex:1;display:flex;flex-direction:column;gap:var(--space-3);">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Patient <span class="required">*</span></label>
              <select class="form-control">
                ${D.patients.map(p=>`<option>${p.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Note Title</label>
              <input class="form-control" placeholder="e.g. Morning Progress Note">
            </div>
          </div>
          <!-- Toolbar -->
          <div style="display:flex;gap:4px;flex-wrap:wrap;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);">
            ${['B','I','U','H1','H2','• List','1. List','—'].map(t=>`
              <button class="btn btn-ghost btn-sm" style="padding:4px 8px;font-size:12px;" onclick="document.execCommand('${t==='B'?'bold':t==='I'?'italic':t==='U'?'underline':'formatBlock'}','false','${t==='H1'?'h2':t==='H2'?'h3':t}')">${t}</button>`).join('')}
            <div style="flex:1;"></div>
            <button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="Pages.loadTemplate()">📋 Load Template</button>
          </div>
          <!-- Rich Text Area -->
          <div id="note-editor" contenteditable="true" style="flex:1;min-height:300px;padding:var(--space-4);border:1.5px solid var(--border);border-radius:var(--radius-md);font-size:14px;line-height:1.7;outline:none;overflow-y:auto;"
               onfocus="this.style.borderColor='var(--primary)'" onfocusout="this.style.borderColor='var(--border)'">
            <p style="color:var(--text-muted);">Start typing your clinical note here... or load a template above.</p>
          </div>
        </div>
        <div class="card-footer">
          <div class="flex justify-between items-center">
            <span style="font-size:11px;color:var(--text-muted);">🔐 Will be digitally signed by Dr. Adewale Bello</span>
            <div class="flex gap-2">
              <button class="btn btn-ghost" onclick="document.getElementById('note-editor').innerHTML='<p style=color:var(--text-muted)>Start typing...</p>'">🗑 Clear</button>
              <button class="btn btn-outline" onclick="alert('Saved as draft (demo)')">💾 Draft</button>
              <button class="btn btn-primary" onclick="alert('Note signed and saved (demo)')">✅ Sign & Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  Pages.selectNote = function(id) {
    const n = D.clinicalNotes.find(x=>x.id===id);
    if (!n) return;
    document.getElementById('note-editor').innerHTML = n.content.replace(/\n/g,'<br>');
  };

  Pages.loadTemplate = function() {
    C.showModal('template-modal','📋 Note Templates',`
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${[
          {name:'SOAP Note',preview:'S: Chief Complaint...\nO: Vitals, Examination...\nA: Assessment...\nP: Plan...'},
          {name:'Ward Round Note',preview:'Patient reviewed on ward round.\nVitals stable. Assessment...'},
          {name:'Discharge Summary',preview:'Patient is fit for discharge.\nFinal Dx: ...\nTake-home medications: ...'},
        ].map(t=>`
          <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;" onclick="Pages.applyTemplate('${t.name}')">
            <div style="font-size:13px;font-weight:700;">${t.name}</div>
            <div style="font-size:11px;color:var(--text-muted);white-space:pre;">${t.preview}</div>
          </div>`).join('')}
      </div>
    `,'','modal-sm');
  };

  Pages.applyTemplate = function(name) {
    const templates = {
      'SOAP Note':'<p><strong>S (Subjective):</strong></p><p>Chief Complaint: </p><p>History of Presenting Illness: </p><br><p><strong>O (Objective):</strong></p><p>Vitals: BP &nbsp;/&nbsp; HR &nbsp; Temp &nbsp; SpO₂</p><p>Examination: </p><br><p><strong>A (Assessment):</strong></p><p>Impression: </p><br><p><strong>P (Plan):</strong></p><p>Investigations: </p><p>Medications: </p><p>Follow-up: </p>',
      'Ward Round Note':'<p><strong>Ward Round Note</strong></p><p>Patient reviewed on ward round.</p><p>Subjective: </p><p>Vitals: Stable / Abnormal</p><p>Examination: </p><p>Assessment: </p><p>Plan: </p>',
      'Discharge Summary':'<p><strong>Discharge Summary</strong></p><p>Admission Date: </p><p>Discharge Date: </p><p>Principal Diagnosis: </p><p>Procedures Performed: </p><p>Condition at Discharge: Improved / Stable</p><p>Take-Home Medications: </p><p>Follow-up: </p><p>Instructions: </p>',
    };
    document.getElementById('note-editor').innerHTML = templates[name]||'';
    document.getElementById('template-modal').remove();
  };
};
