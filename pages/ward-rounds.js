/* ============================================================
   WARD ROUNDS PAGE
   ============================================================ */
Pages['ward-rounds'] = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  let selectedWard = D.wards[0];
  let expandedPatient = null;

  const wardPatients = {};
  D.wards.forEach(w => {
    wardPatients[w.code] = D.patients.filter(p => p.ward === w.code || (p.ward === 'OPD' && w.code === 'MMW'));
  });

  function render() {
    const wp = wardPatients[selectedWard.code] || [];
    root.innerHTML = `
    <div class="page-enter">
      ${C.pageHeader('🏥 Ward Rounds',`${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}`)}

      <!-- WARD SELECTOR -->
      <div class="card mb-5">
        <div class="card-body" style="padding:var(--space-4);">
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-3);" id="ward-selector">
            ${D.wards.map(w=>`
              <div class="ward-card ${w.code===selectedWard.code?'selected':''}" onclick="Pages.selectWard('${w.code}')"
                   style="${w.code===selectedWard.code?'border-color:var(--primary);background:var(--primary-light);':''}">>
                <div class="flex justify-between items-center mb-1">
                  <div class="ward-card-name">${w.code}</div>
                  <span class="badge" style="font-size:9px;background:${w.status==='critical'?'var(--critical-light)':w.status==='high'?'var(--warning-light)':w.status==='surge'?'var(--critical-light)':'var(--success-light)'};color:${w.status==='critical'||w.status==='surge'?'var(--critical)':w.status==='high'?'#92400E':'var(--success)'};">${w.status.toUpperCase()}</span>
                </div>
                <div style="font-size:11px;color:var(--text-muted);">${w.occupancy}/${w.capacity}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- WARD DETAIL + PATIENTS -->
      <div class="content-cols-main">

        <!-- LEFT: Patient Bed Cards -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 style="font-size:16px;font-weight:700;">${selectedWard.name} (${selectedWard.code})</h2>
              <div style="font-size:12px;color:var(--text-muted);">${selectedWard.occupancy} patients • ${selectedWard.doctors} doctors • ${selectedWard.nurses} nurses</div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-outline btn-sm" onclick="Router.navigate('/clinical-notes')">📝 Add Note</button>
              <button class="btn btn-primary btn-sm" onclick="Pages.startWardRound()">▶ Start Round</button>
            </div>
          </div>

          ${wp.length ? `
          <div style="display:flex;flex-direction:column;gap:var(--space-4);" id="ward-patient-list">
            ${wp.map(p => renderPatientBedCard(p)).join('')}
          </div>` : `
          <div class="card">${C.emptyState('🛏','No Patients',`No patients currently in ${selectedWard.code} Ward.`)}</div>`}
        </div>

        <!-- RIGHT: Ward Summary -->
        <div style="display:flex;flex-direction:column;gap:var(--space-4);">
          <div class="card">
            <div class="card-header"><div class="card-title">📊 Ward Summary</div></div>
            <div class="card-body">
              <div style="display:flex;flex-direction:column;gap:var(--space-3);">
                ${[
                  {label:'Total Beds', value:`${selectedWard.capacity}`, icon:'🛏'},
                  {label:'Occupied', value:`${selectedWard.occupancy}`, icon:'👤'},
                  {label:'Available', value:`${selectedWard.capacity-selectedWard.occupancy}`, icon:'✅'},
                  {label:'Doctors On Ward', value:`${selectedWard.doctors}`, icon:'👨‍⚕️'},
                  {label:'Nurses On Ward', value:`${selectedWard.nurses}`, icon:'👩‍⚕️'},
                ].map(r=>`
                  <div class="flex items-center justify-between p-3" style="background:var(--surface);border-radius:var(--radius-md);border:1px solid var(--border);">
                    <div class="flex items-center gap-2">
                      <span>${r.icon}</span>
                      <span style="font-size:13px;color:var(--text-secondary);">${r.label}</span>
                    </div>
                    <strong style="font-size:14px;">${r.value}</strong>
                  </div>`).join('')}
              </div>
              <div class="progress-bar" style="margin-top:16px;">
                <div class="progress-fill ${selectedWard.status==='critical'||selectedWard.status==='surge'?'critical':selectedWard.status==='high'?'warning':'success'}"
                     style="width:${Math.round((selectedWard.occupancy/selectedWard.capacity)*100)}%;"></div>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px;text-align:center;">${Math.round((selectedWard.occupancy/selectedWard.capacity)*100)}% occupancy</div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">📋 Pending Tasks</div></div>
            <div class="card-body" style="padding:var(--space-3);display:flex;flex-direction:column;gap:8px;">
              ${D.tasks.filter(t=>!t.done).slice(0,4).map(t=>C.taskCard(t)).join('')}
            </div>
          </div>

          <div class="card" style="border-left:3px solid var(--critical);">
            <div class="card-header" style="background:var(--critical-light);"><div class="card-title" style="color:var(--critical);">🔴 Alerts</div></div>
            <div class="card-body" style="padding:var(--space-3);">
              ${D.alerts.filter(a=>a.level==='critical').map(a=>C.alertItem(a)).join('')}
            </div>
          </div>
        </div>

      </div>
    </div>`;
  }

  function renderPatientBedCard(p) {
    const isExpanded = expandedPatient === p.id;
    return `
    <div class="card" id="bed-card-${p.id}" style="border-left:4px solid ${p.status==='critical'?'var(--critical)':p.status==='stable'?'var(--success)':'var(--warning)'};">
      <div style="padding:var(--space-4);">
        <div class="flex items-start gap-4">
          ${C.avatar(p, 44)}
          <div style="flex:1;">
            <div class="flex items-center gap-2 flex-wrap">
              <span style="font-size:15px;font-weight:700;">${p.name}</span>
              ${C.statusBadge(p.status)}
              ${p.status==='critical'?'<span class="badge badge-critical heartbeat">CRITICAL</span>':''}
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              ${p.mrn} • Bed ${p.bed!=='—'?p.bed:'OPD'} • ${p.age===0?'Neonatal':p.age+'y'} / ${p.sex}
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
              🏷 ${p.diagnoses[0]}
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="Pages.toggleBedCard('${p.id}')">
            ${isExpanded?'▲ Collapse':'▼ Expand'}
          </button>
        </div>

        <!-- Quick Vitals -->
        <div class="flex gap-4 mt-3 flex-wrap">
          ${[
            {l:'BP',v:p.vitals.bp,u:'mmHg',bad:()=>{const[s,d]=(p.vitals.bp||'').split('/').map(Number);return s>140||d>90;}},
            {l:'HR',v:p.vitals.pulse,u:'bpm',bad:()=>p.vitals.pulse>100||p.vitals.pulse<60},
            {l:'Temp',v:p.vitals.temp+'°C',u:'',bad:()=>p.vitals.temp>37.5},
            {l:'SpO₂',v:p.vitals.spo2+'%',u:'',bad:()=>p.vitals.spo2<95},
          ].map(v=>`
            <div style="text-align:center;padding:6px 10px;background:${v.bad()?'var(--critical-light)':'var(--surface)'};border-radius:var(--radius-md);border:1px solid ${v.bad()?'rgba(229,57,53,0.3)':'var(--border)'};">
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--text-muted);">${v.l}</div>
              <div style="font-size:14px;font-weight:800;color:${v.bad()?'var(--critical)':'var(--text-primary)'};">${v.v}</div>
              ${v.u?`<div style="font-size:9px;color:var(--text-muted);">${v.u}</div>`:''}
            </div>`).join('')}
        </div>

        <!-- EXPANDED SECTION -->
        ${isExpanded ? `
        <div style="margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--border);">
          <div class="content-grid-2" style="gap:var(--space-3);">
            <div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;">Current Medications</div>
              ${p.medications.map(m=>`<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);">💊 ${m}</div>`).join('')}
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;">Today's Actions</div>
              <div class="flex flex-col gap-2">
                <button class="btn btn-primary btn-sm w-full" onclick="Router.navigate('/consultations?patient=${p.id}')">📝 Add Progress Note</button>
                <button class="btn btn-outline btn-sm w-full" onclick="Router.navigate('/laboratory?patient=${p.id}')">🧪 Order Investigation</button>
                <button class="btn btn-outline btn-sm w-full" onclick="Router.navigate('/prescriptions?patient=${p.id}')">💊 Change Medication</button>
                <button class="btn btn-outline btn-sm w-full" onclick="Router.navigate('/referrals')">↗ Request Referral</button>
                <button class="btn btn-ghost btn-sm w-full" onclick="Pages.showDischargeModal('${p.id}')">🚪 Initiate Discharge</button>
              </div>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>`;
  }

  Pages.selectWard = function(code) {
    selectedWard = D.wards.find(w=>w.code===code) || D.wards[0];
    expandedPatient = null;
    render();
  };

  Pages.toggleBedCard = function(pid) {
    expandedPatient = expandedPatient === pid ? null : pid;
    render();
  };

  Pages.startWardRound = function() {
    alert('Ward round started — progress notes will be auto-timestamped (demo)');
  };

  Pages.showDischargeModal = function(pid) {
    const p = D.getPatient(pid);
    if (!p) return;
    C.showModal('discharge-modal',`🚪 Discharge — ${p.name}`,`
      <div class="form-group">
        <label class="form-label">Final Diagnosis</label>
        <input class="form-control" value="${p.diagnoses[0]}">
      </div>
      <div class="form-group">
        <label class="form-label">Condition at Discharge</label>
        <select class="form-control"><option>Improved</option><option>Stable</option><option>Unchanged</option><option>Deteriorated</option><option>Deceased</option></select>
      </div>
      <div class="form-group">
        <label class="form-label">Discharge Medications</label>
        <textarea class="form-control" rows="3" placeholder="List take-home medications...">${p.medications.join('\n')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Follow-up Date</label>
        <input class="form-control" type="date">
      </div>
      <div class="form-group">
        <label class="form-label">Discharge Instructions</label>
        <textarea class="form-control" rows="3" placeholder="Patient instructions, dietary advice, warning signs..."></textarea>
      </div>
    `,`
      <button class="btn btn-ghost" onclick="document.getElementById('discharge-modal').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="alert('Discharge summary generated (demo)');document.getElementById('discharge-modal').remove();">📄 Generate Discharge Summary</button>
    `,'modal-lg');
  };

  render();
};
