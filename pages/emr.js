/* ============================================================
   EMR PAGE — Electronic Medical Record
   ============================================================ */
Pages.emr = function({ id } = {}) {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  const p = D.getPatient(id);
  if (!p) {
    root.innerHTML = C.emptyState('❌','Patient Not Found','The requested patient record could not be found.');
    return;
  }

  const labs  = D.getPatientLabs(p.id);
  const rads  = D.getPatientRadiology(p.id);
  const rxs   = D.getPatientPrescriptions(p.id);
  const notes = D.getPatientNotes(p.id);
  const refs  = D.getPatientReferrals(p.id);

  const allergyTags = p.allergies.length
    ? p.allergies.map(a=>`<span class="profile-tag allergy">⚠ ${a}</span>`).join('')
    : '<span class="profile-tag">No known allergies</span>';

  root.innerHTML = `
  <div class="page-enter">

    <!-- BREADCRUMB -->
    <div class="breadcrumb mb-4">
      <span onclick="Router.navigate('/patients')" style="cursor:pointer;color:var(--primary);">👥 Patients</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-current">${p.name}</span>
    </div>

    <!-- PATIENT HEADER BANNER -->
    <div class="patient-profile-header mb-5">
      <div class="flex items-start gap-5 flex-wrap">
        <div>${C.avatar(p, 72)}</div>
        <div style="flex:1;">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="patient-profile-name">${p.name}</div>
            ${C.statusBadge(p.status)}
            ${p.status==='critical'?`<span class="badge badge-critical heartbeat">CRITICAL</span>`:''}
          </div>
          <div class="patient-profile-mrn">${p.mrn} • ${p.age===0?'Neonatal':p.age+'y'} / ${p.sex} • Blood: ${p.blood} • ${p.type==='inpatient'?`Ward ${p.ward}, Bed ${p.bed}`:'Outpatient'}</div>
          <div class="patient-profile-tags">
            ${allergyTags}
            <span class="profile-tag">📅 Admitted: ${p.admitDate||'OPD'}</span>
            <span class="profile-tag">👨‍⚕️ ${p.attending}</span>
            ${p.diagnoses.map(d=>`<span class="profile-tag">🏷 ${d}</span>`).join('')}
          </div>
        </div>
        <div class="flex gap-2 flex-wrap" style="align-self:flex-start;">
          <button class="btn btn-accent btn-sm" onclick="Router.navigate('/consultations?patient=${p.id}')">🩺 Consult</button>
          <button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);" onclick="Router.navigate('/prescriptions?patient=${p.id}')">💊 Prescribe</button>
          <button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);" onclick="Router.navigate('/laboratory?patient=${p.id}')">🧪 Order Lab</button>
        </div>
      </div>
    </div>

    <!-- EMR TABS -->
    <div class="tab-bar" id="emr-tabs">
      ${['Overview','Vitals','Diagnoses','Medications','Lab Results','Radiology','Clinical Notes','Timeline'].map((t,i)=>`
        <button class="tab-item ${i===0?'active':''}" onclick="Pages.switchEMRTab(this,'emr-tab-${i}')">${t}</button>`).join('')}
    </div>

    <!-- TAB CONTENT -->
    <div id="emr-tab-0" class="tab-content active">${renderOverview(p,labs,rads,rxs)}</div>
    <div id="emr-tab-1" class="tab-content">${renderVitals(p)}</div>
    <div id="emr-tab-2" class="tab-content">${renderDiagnoses(p)}</div>
    <div id="emr-tab-3" class="tab-content">${renderMedications(rxs)}</div>
    <div id="emr-tab-4" class="tab-content">${renderLabs(labs)}</div>
    <div id="emr-tab-5" class="tab-content">${renderRadiology(rads)}</div>
    <div id="emr-tab-6" class="tab-content">${renderNotes(notes)}</div>
    <div id="emr-tab-7" class="tab-content">${renderTimeline(p,labs,rads,notes,rxs,refs)}</div>

  </div>`;

  Pages.switchEMRTab = function(btn, contentId) {
    document.querySelectorAll('#emr-tabs .tab-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(contentId).classList.add('active');
  };

  // ── DRAW VITAL CHART after tab switch ────────────────────
  setTimeout(drawVitalChart, 300);

  function drawVitalChart() {
    const ctx = document.getElementById('hb-trend');
    if (!ctx || !window.Chart) return;
    const data = [12.1,11.4,10.8,10.2];
    const labels = ['09 Sep','12 Sep','15 Sep','18 Sep'];
    new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[{
        label:'Haemoglobin (g/dL)', data,
        borderColor:'#1A6EB5', backgroundColor:'rgba(26,110,181,0.08)',
        tension:0.4, pointRadius:5, pointBackgroundColor:'#1A6EB5', fill:true,
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false } },
        scales:{
          y:{ min:8, max:14, grid:{ color:'#E2E8F0' }, ticks:{ font:{ size:11 } } },
          x:{ grid:{ display:false }, ticks:{ font:{ size:11 } } }
        }
      }
    });
  }

  function renderOverview(p, labs, rads, rxs) {
    const criticalLabs = labs.flatMap(l=>l.tests.filter(t=>t.flag==='critical'));
    return `
    <div class="content-grid-2">
      <!-- Clinical Summary -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        ${criticalLabs.length ? `
        <div class="critical-banner">
          <span style="font-size:20px;">🔴</span>
          <div>
            <div>Critical Values: ${criticalLabs.map(t=>`${t.name} ${t.result} ${t.unit}`).join(' • ')}</div>
            <div style="font-size:11px;opacity:0.8;">Requires immediate clinical attention</div>
          </div>
        </div>` : ''}

        <div class="card">
          <div class="card-header"><div class="card-title">🩺 Active Diagnoses</div></div>
          <div class="card-body">
            ${p.diagnoses.map((d,i)=>`
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
                <span class="badge ${i===0?'badge-primary':'badge-neutral'}">${i===0?'Primary':'Secondary'}</span>
                <span style="font-size:13px;font-weight:${i===0?'600':'400'};">${d}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">💊 Current Medications</div></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:8px;">
            ${p.medications.map(m=>`
              <div style="display:flex;align-items:center;gap:10px;padding:6px 0;">
                <span style="font-size:16px;">💊</span>
                <span style="font-size:13px;">${m}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">⚠ Allergies</div></div>
          <div class="card-body">
            ${p.allergies.length
              ? p.allergies.map(a=>`<span class="badge badge-critical" style="margin:4px;">${a}</span>`).join('')
              : '<span class="text-muted">No known allergies documented</span>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">👥 Emergency Contact</div></div>
          <div class="card-body">
            <div style="font-size:13px;">${p.nok}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Patient: ${p.phone}</div>
          </div>
        </div>
      </div>

      <!-- Right: Vitals snapshot + Recent Results -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="card">
          <div class="card-header"><div class="card-title">❤️ Latest Vitals</div><span style="font-size:11px;color:var(--text-muted);">Today</span></div>
          <div class="card-body">${C.vitalsGrid(p.vitals)}</div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">🧪 Recent Lab Results</div></div>
          <div class="card-body" style="padding:var(--space-3);">
            ${labs.length ? labs.map(l=>C.labResultCard(l)).join('') : C.emptyState('🧪','No Results','No lab results available.')}
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderVitals(p) {
    return `
    <div class="content-grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title">❤️ Current Vitals</div></div>
        <div class="card-body">${C.vitalsGrid(p.vitals)}</div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📈 Haemoglobin Trend</div><span class="badge badge-info">Trending ↓</span></div>
        <div class="card-body"><div style="height:200px;"><canvas id="hb-trend"></canvas></div></div>
      </div>
    </div>`;
  }

  Pages.showAddDxModal = function() {
    C.showModal('add-dx-modal','Add Diagnosis', `
      <div class="form-group">
        <label class="form-label">Diagnosis Type</label>
        <select class="form-control"><option>Primary Diagnosis</option><option>Secondary Diagnosis</option><option>Differential Diagnosis</option></select>
      </div>
      <div class="form-group">
        <label class="form-label">Diagnosis <span class="required">*</span></label>
        <input class="form-control" placeholder="Search ICD-10 or enter free text...">
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" rows="2" placeholder="Clinical notes for this diagnosis..."></textarea>
      </div>
    `, `
      <button class="btn btn-ghost" onclick="document.getElementById('add-dx-modal').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="alert('Diagnosis added (demo)');document.getElementById('add-dx-modal').remove();">Save Diagnosis</button>
    `);
  };

  function renderDiagnoses(p) {
    return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">🏷 Diagnoses</div>
        <button class="btn btn-primary btn-sm" onclick="Pages.showAddDxModal()">+ Add Diagnosis</button>
      </div>
      <div class="card-body">
        ${p.diagnoses.map((d,i)=>`
          <div style="display:flex;align-items:center;gap:16px;padding:12px;background:${i===0?'var(--primary-light)':'var(--surface)'};border-radius:var(--radius-md);margin-bottom:8px;border:1px solid var(--border);">
            <span class="badge ${i===0?'badge-primary':'badge-neutral'}" style="width:80px;justify-content:center;">${i===0?'Primary':'Secondary'}</span>
            <span style="font-size:14px;font-weight:${i===0?'600':'400'};flex:1;">${d}</span>
            <button class="btn btn-ghost btn-sm" onclick="alert('Edit diagnosis (demo)')">✏</button>
          </div>`).join('')}
        <div style="margin-top:16px;padding:12px;background:var(--warning-light);border-radius:var(--radius-md);border:1px solid rgba(245,158,11,0.3);">
          <div style="font-size:11px;font-weight:700;color:#92400E;margin-bottom:4px;">DIFFERENTIAL DIAGNOSES</div>
          <div style="font-size:13px;color:#92400E;">Rule out: Secondary hypertension, End-organ damage assessment pending</div>
        </div>
      </div>
    </div>
    `;
  }

  function renderMedications(rxs) {
    if (!rxs.length) return C.emptyState('💊','No Prescriptions','No active prescriptions for this patient.');
    return rxs.map(rx=>`
    <div class="card mb-4">
      <div class="card-header">
        <div class="card-title">Prescription ${rx.id}</div>
        <div class="flex gap-2 items-center">
          <span style="font-size:12px;color:var(--text-muted);">${rx.date} • ${rx.prescribedBy}</span>
          ${C.statusBadge(rx.status)}
        </div>
      </div>
      <div class="card-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
        ${rx.drugs.map(d=>C.drugRow(d)).join('')}
      </div>
    </div>`).join('');
  }

  function renderLabs(labs) {
    if (!labs.length) return C.emptyState('🧪','No Lab Results','No laboratory results available for this patient.');
    return `<div>${labs.map(l=>C.labResultCard(l)).join('')}</div>`;
  }

  function renderRadiology(rads) {
    if (!rads.length) return C.emptyState('🩻','No Radiology Reports','No imaging requests for this patient.');
    return rads.map(r=>`
    <div class="card mb-4">
      <div class="card-header">
        <div>
          <div class="card-title">🩻 ${r.study}</div>
          <div style="font-size:11px;color:var(--text-muted);">${r.modality} • ${r.requestDate} • ${r.radiologist||'Pending'}</div>
        </div>
        ${C.statusBadge(r.status)}
      </div>
      <div class="card-body">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">CLINICAL INDICATION</div>
        <div style="font-size:13px;margin-bottom:var(--space-4);">${r.indication}</div>
        ${r.report ? `
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">REPORT</div>
          <div style="font-size:13px;line-height:1.6;background:var(--surface);padding:12px;border-radius:var(--radius-md);margin-bottom:var(--space-3);">${r.report}</div>
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">IMPRESSION</div>
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${r.impression}</div>
        ` : `<div class="badge badge-warning">⏳ Report Pending</div>`}
      </div>
    </div>`).join('');
  }

  function renderNotes(notes) {
    if (!notes.length) return C.emptyState('📝','No Clinical Notes','No notes have been documented for this patient.');
    return notes.map(n=>`
    <div class="card mb-4">
      <div class="card-header">
        <div>
          <div class="card-title">${n.title}</div>
          <div style="font-size:11px;color:var(--text-muted);">${n.type} • ${n.date} • ${n.author}</div>
        </div>
        <span class="badge badge-primary">${n.type}</span>
      </div>
      <div class="card-body">
        <div style="font-size:13px;line-height:1.7;white-space:pre-wrap;">${n.content}</div>
      </div>
    </div>`).join('');
  }

  function renderTimeline(p, labs, rads, notes, rxs, refs) {
    const events = [
      ...labs.map(l=>({ date:l.resultDate, type:'lab', title:`Lab Result: ${l.tests.map(t=>t.name).join(', ')}`, desc:`${l.status==='critical'?'🔴 Critical result':'Result available'} • ${l.lab}` })),
      ...rads.map(r=>({ date:r.reportDate||r.requestDate, type:'radiology', title:`Radiology: ${r.study}`, desc:r.impression||'Pending report' })),
      ...notes.map(n=>({ date:n.date, type:'consultation', title:n.title, desc:`${n.type} • ${n.author}` })),
      ...rxs.map(rx=>({ date:rx.date, type:'medication', title:`Prescription ${rx.id}`, desc:rx.drugs.map(d=>d.name).join(', ') })),
      { date:p.admitDate||'2026-09-18', type:'admission', title:'Admission', desc:`Admitted to ${p.ward} Ward${p.bed!=='—'?`, Bed ${p.bed}`:''}` },
    ].sort((a,b)=>new Date(b.date)-new Date(a.date));

    return `
    <div class="card">
      <div class="card-header"><div class="card-title">📅 Patient Timeline</div></div>
      <div class="card-body">
        <div class="timeline">
          ${events.map(e=>C.timelineItem(e.type, e.date, e.title, e.desc)).join('')}
        </div>
      </div>
    </div>`;
  }
};
