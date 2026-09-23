/* ============================================================
   PATIENTS PAGE
   ============================================================ */
Pages.patients = function({ id } = {}) {
  if (id) { Pages.emr({ id }); return; }

  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  let filtered = [...D.patients];
  let activeTab = 'all';

  function render() {
    root.innerHTML = `
    <div class="page-enter">
      ${C.pageHeader('👥 My Patients',`${D.patients.length} patients under your care`,`
        <button class="btn btn-primary" onclick="Pages.showAdmitModal()">➕ Admit Patient</button>
        <button class="btn btn-outline" onclick="Router.navigate('/consultations')">🩺 New Consultation</button>
      `)}

      <!-- SEARCH + FILTERS -->
      <div class="card mb-6">
        <div class="card-body" style="padding:var(--space-4);">
          <div class="flex gap-4 items-center flex-wrap">
            <div class="search-input-wrap" style="flex:1;min-width:240px;">
              <span class="search-icon">🔍</span>
              <input id="patient-search" type="text" placeholder="Search by name, MRN, phone, ward, bed..." oninput="Pages.filterPatients(this.value)">
            </div>
            <div class="filter-chips" id="patient-tabs">
              ${['all','inpatient','outpatient','critical'].map(tab=>`
                <button class="filter-chip ${activeTab===tab?'active':''}" onclick="Pages.switchPatientTab('${tab}')">${
                  {all:'All Patients',inpatient:'Inpatients',outpatient:'Outpatients',critical:'Critical'}[tab]
                }</button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- PATIENT LIST -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Patient List</div>
          <div style="font-size:12px;color:var(--text-muted);" id="patient-count">${filtered.length} patients</div>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table" id="patient-table">
            <thead>
              <tr>
                <th>Patient</th><th>Ward / Bed</th><th>Age / Sex</th><th>Blood</th><th>Primary Diagnosis</th><th>Status</th><th>Admitted</th><th>Actions</th>
              </tr>
            </thead>
            <tbody id="patient-tbody">
              ${renderRows(filtered)}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  function renderRows(list) {
    if (!list.length) return `<tr><td colspan="8">${C.emptyState('🔍','No patients found','Try a different search term or filter.')}</td></tr>`;
    return list.map(p => `
      <tr onclick="Router.navigate('/emr/${p.id}')" style="cursor:pointer;">
        <td>
          <div class="patient-row-avatar">
            ${C.avatar(p, 36)}
            <div>
              <div class="patient-name">${p.name}</div>
              <div class="patient-mrn">${p.mrn}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-primary">${p.ward}</span> ${p.bed!=='—'?`Bed ${p.bed}`:''}</td>
        <td>${p.age===0?'Neonatal':p.age+'y'} / ${p.sex}</td>
        <td><span class="badge badge-neutral">${p.blood}</span></td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.diagnoses[0]}</td>
        <td>${C.statusBadge(p.status)}</td>
        <td style="font-size:12px;color:var(--text-muted);">${p.admitDate||'OPD'}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();Router.navigate('/emr/${p.id}')" data-tip="View EMR">📋</button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();Router.navigate('/consultations?patient=${p.id}')" data-tip="Consult">🩺</button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();Router.navigate('/prescriptions?patient=${p.id}')" data-tip="Prescribe">💊</button>
          </div>
        </td>
      </tr>`).join('');
  }

  Pages.filterPatients = function(q) {
    const tab = window._patientTab || 'all';
    let list = D.searchPatients(q);
    if (tab !== 'all') {
      if (tab === 'critical') list = list.filter(p => p.status === 'critical');
      else list = list.filter(p => p.type === tab);
    }
    document.getElementById('patient-tbody').innerHTML = renderRows(list);
    document.getElementById('patient-count').textContent = list.length + ' patients';
  };

  Pages.switchPatientTab = function(tab) {
    window._patientTab = tab;
    document.querySelectorAll('#patient-tabs .filter-chip').forEach(el => el.classList.remove('active'));
    document.querySelector(`#patient-tabs .filter-chip[onclick*="${tab}"]`).classList.add('active');
    let list = [...D.patients];
    if (tab === 'critical') list = list.filter(p => p.status === 'critical');
    else if (tab !== 'all') list = list.filter(p => p.type === tab);
    const q = document.getElementById('patient-search')?.value || '';
    if (q) list = list.filter(p =>
      p.name.toLowerCase().includes(q.toLowerCase()) || p.mrn.toLowerCase().includes(q.toLowerCase())
    );
    document.getElementById('patient-tbody').innerHTML = renderRows(list);
    document.getElementById('patient-count').textContent = list.length + ' patients';
  };

  Pages.showAdmitModal = function() {
    C.showModal('admit-modal','➕ Admit New Patient', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Full Name <span class="required">*</span></label>
          <input class="form-control" placeholder="e.g. Mrs. Amaka Okafor">
        </div>
        <div class="form-group">
          <label class="form-label">MRN / Hospital Number</label>
          <input class="form-control" placeholder="Auto-generated if blank">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date of Birth <span class="required">*</span></label>
          <input class="form-control" type="date">
        </div>
        <div class="form-group">
          <label class="form-label">Sex <span class="required">*</span></label>
          <select class="form-control"><option>Male</option><option>Female</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Blood Group</label>
          <select class="form-control"><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Ward <span class="required">*</span></label>
          <select class="form-control">${D.wards.map(w=>`<option>${w.code} — ${w.name}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Bed Number</label>
          <input class="form-control" placeholder="e.g. 12">
        </div>
        <div class="form-group">
          <label class="form-label">Phone Number</label>
          <input class="form-control" placeholder="+234-...">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Primary Diagnosis / Admission Reason <span class="required">*</span></label>
        <textarea class="form-control" rows="2" placeholder="e.g. Acute exacerbation of COPD..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Known Allergies</label>
        <input class="form-control" placeholder="e.g. Penicillin, Aspirin">
      </div>
    `, `
      <button class="btn btn-ghost" onclick="document.getElementById('admit-modal').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="alert('Patient admitted successfully (demo)');document.getElementById('admit-modal').remove();">✅ Admit Patient</button>
    `, 'modal-lg');
  };

  render();
};
