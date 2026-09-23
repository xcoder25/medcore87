/* ============================================================
   RADIOLOGY PAGE
   ============================================================ */
Pages.radiology = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  root.innerHTML = `
  <div class="page-enter">
    ${C.pageHeader('🩻 Radiology','Request imaging and review reports')}

    <div class="content-cols-main">
      <!-- LEFT: Reports -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 Imaging Reports</div>
            <div class="filter-chips">
              ${['all','reported','pending'].map((f,i)=>`
                <button class="filter-chip ${i===0?'active':''}" onclick="Pages.filterRad('${f}',this)">${f.charAt(0).toUpperCase()+f.slice(1)}</button>`).join('')}
            </div>
          </div>
          <div class="card-body" style="padding:var(--space-3);" id="rad-list">
            ${D.radiologyReports.map(r=>renderRadCard(r)).join('')}
          </div>
        </div>
      </div>

      <!-- RIGHT: Request Form -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="card">
          <div class="card-header"><div class="card-title">🩻 New Imaging Request</div></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Patient <span class="required">*</span></label>
              <select class="form-control">
                ${D.patients.map(p=>`<option>${p.name} — ${p.mrn}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Modality / Category</label>
              <div class="filter-chips flex-wrap" id="rad-cat">
                ${Object.keys(D.radiologyTests).map((cat,i)=>`
                  <button class="filter-chip ${i===0?'active':''}" onclick="Pages.selectRadCat('${cat}',this)">${cat}</button>`).join('')}
              </div>
            </div>
            <div class="form-group" id="rad-study-list">
              <label class="form-label">Study</label>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${D.radiologyTests[Object.keys(D.radiologyTests)[0]].map(s=>`
                  <label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;">
                    <input type="radio" name="rad-study" style="accent-color:var(--primary);">
                    <span style="font-size:13px;">${s}</span>
                  </label>`).join('')}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Clinical Indication <span class="required">*</span></label>
              <textarea class="form-control" rows="3" placeholder="Reason for requesting imaging, relevant clinical history..."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Urgency</label>
                <select class="form-control"><option>Routine</option><option>Urgent</option><option>Emergency</option></select>
              </div>
              <div class="form-group">
                <label class="form-label">Contrast Required?</label>
                <select class="form-control"><option>No</option><option>IV Contrast</option><option>Oral Contrast</option><option>Both</option></select>
              </div>
            </div>
            <button class="btn btn-primary w-full" onclick="alert('Radiology request sent (demo)')">📤 Send Request</button>
          </div>
        </div>

        <!-- PACS Viewer Placeholder -->
        <div class="card">
          <div class="card-header"><div class="card-title">🖥 PACS Image Viewer</div><span class="badge badge-neutral">Integration Pending</span></div>
          <div class="card-body" style="text-align:center;padding:var(--space-8);background:var(--sidebar-bg);border-radius:0 0 var(--radius-lg) var(--radius-lg);">
            <div style="font-size:48px;margin-bottom:16px;opacity:0.4;">🩻</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.4);">DICOM image viewer will appear here</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.25);margin-top:4px;">PACS system integration required</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  function renderRadCard(r) {
    return `
    <div class="referral-card mb-3">
      <div class="flex items-start justify-between mb-2">
        <div>
          <div style="font-size:14px;font-weight:700;">${r.study}</div>
          <div style="font-size:11px;color:var(--text-muted);">${r.modality} • ${r.patient} • ${r.requestDate}</div>
        </div>
        ${C.statusBadge(r.status)}
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;"><strong>Indication:</strong> ${r.indication}</div>
      ${r.report ? `
        <div style="background:var(--surface);border-radius:var(--radius-md);padding:10px;margin-bottom:8px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Report — ${r.radiologist}</div>
          <div style="font-size:12px;line-height:1.6;">${r.report}</div>
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--primary);">✅ ${r.impression}</div>
      ` : `<div class="badge badge-warning">⏳ Report Pending</div>`}
      <div class="flex gap-2 mt-3">
        ${r.patient ? `<button class="btn btn-ghost btn-sm" onclick="Router.navigate('/emr/${r.patientId||''}')">👤 Patient Record</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="alert('Opening comparison (demo)')">↔ Compare</button>
      </div>
    </div>`;
  }

  Pages.selectRadCat = function(cat, btn) {
    document.querySelectorAll('#rad-cat .filter-chip').forEach(el=>el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('rad-study-list').innerHTML = `
      <label class="form-label">Study</label>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${D.radiologyTests[cat].map(s=>`
          <label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;">
            <input type="radio" name="rad-study" style="accent-color:var(--primary);">
            <span style="font-size:13px;">${s}</span>
          </label>`).join('')}
      </div>`;
  };

  Pages.filterRad = function(f, btn) {
    document.querySelectorAll('.filter-chip').forEach(el=>el.classList.remove('active'));
    btn.classList.add('active');
    const list = f==='all' ? D.radiologyReports : D.radiologyReports.filter(r=>r.status===f);
    document.getElementById('rad-list').innerHTML = list.map(r=>renderRadCard(r)).join('')||C.emptyState('🩻','No Reports','');
  };
};

/* ============================================================
   PRESCRIPTIONS PAGE
   ============================================================ */
Pages.prescriptions = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  let drugSearch = '';
  let selectedDrug = null;
  let basket = [];

  root.innerHTML = `
  <div class="page-enter">
    ${C.pageHeader('💊 Prescriptions','ePrescribing — search, prescribe, send to pharmacy')}

    <div class="content-cols-main">
      <!-- LEFT: Active Prescriptions -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 Active Prescriptions</div>
            <div class="flex gap-2 items-center">
              <select class="form-control form-control-sm" style="width:220px;" onchange="Pages.filterRxByPatient(this.value)">
                <option value="">All Patients</option>
                ${D.patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="card-body" style="padding:var(--space-3);" id="rx-list">
            ${D.prescriptions.map(rx=>`
              <div style="margin-bottom:16px;">
                <div class="flex items-center justify-between mb-2">
                  <div>
                    <div style="font-size:13px;font-weight:700;">${rx.patient}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${rx.id} • ${rx.date} • ${rx.prescribedBy}</div>
                  </div>
                  <div class="flex gap-2 items-center">
                    ${C.statusBadge(rx.status)}
                    <button class="btn btn-ghost btn-sm" onclick="alert('Sending to pharmacy (demo)')">📤 Send to Pharmacy</button>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                  ${rx.drugs.map(d=>C.drugRow(d)).join('')}
                </div>
              </div>
              <div class="divider"></div>`).join('')}
          </div>
        </div>
      </div>

      <!-- RIGHT: Prescribing Panel -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="card">
          <div class="card-header"><div class="card-title">✏ New Prescription</div></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Patient <span class="required">*</span></label>
              <select class="form-control">
                ${D.patients.map(p=>`<option>${p.name} — ${p.mrn}</option>`).join('')}
              </select>
            </div>

            <!-- Drug Search -->
            <div class="form-group">
              <label class="form-label">Search Drug <span class="required">*</span></label>
              <div class="flex gap-2 items-center mb-2">
                <label class="form-label" style="margin:0;white-space:nowrap;">Formulary</label>
                <select id="eml-population" class="form-control form-control-sm" style="max-width:160px;" onchange="Pages.searchDrug(document.getElementById('drug-search-input').value)">
                  <option value="">All (Adult + Child)</option>
                  <option value="adult">Adult EML 2026</option>
                  <option value="children">Children EML 2026</option>
                </select>
                <span style="font-size:11px;color:var(--text-muted);">AKS-EML · MOH</span>
              </div>
              <div class="search-input-wrap" style="margin-bottom:6px;">
                <span class="search-icon">🔍</span>
                <input id="drug-search-input" type="text" placeholder="Search AKS Essential Medicines List..." oninput="Pages.searchDrug(this.value)">
              </div>
              <div id="drug-suggestions" style="display:none;background:white;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;box-shadow:var(--shadow-md);max-height:180px;overflow-y:auto;z-index:100;position:relative;"></div>
            </div>

            <!-- Drug Details (shown after selection) -->
            <div id="drug-detail-form" class="hidden">
              <div id="allergy-warn"></div>
              <div id="interaction-warn"></div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Dose <span class="required">*</span></label>
                  <input class="form-control" id="rx-dose" placeholder="e.g. 500mg">
                </div>
                <div class="form-group">
                  <label class="form-label">Route <span class="required">*</span></label>
                  <select class="form-control" id="rx-route">
                    <option>Oral</option><option>IV</option><option>SC</option><option>IM</option><option>Inhaled</option><option>Topical</option><option>PR</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Frequency <span class="required">*</span></label>
                  <select class="form-control" id="rx-freq">
                    <option>Once daily</option><option>Twice daily</option><option>Three times daily</option><option>Four times daily</option>
                    <option>8 hourly</option><option>6 hourly</option><option>4 hourly</option><option>PRN</option><option>Stat</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Duration</label>
                  <input class="form-control" id="rx-duration" placeholder="e.g. 5 days, 1 week">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Quantity</label>
                  <input class="form-control" id="rx-qty" type="number" placeholder="e.g. 30">
                </div>
                <div class="form-group">
                  <label class="form-label">Start Date</label>
                  <input class="form-control" id="rx-start" type="date">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Instructions</label>
                <input class="form-control" id="rx-instructions" placeholder="e.g. Take with food">
              </div>
              <div class="flex items-center gap-2 mb-4">
                <input type="checkbox" id="rx-prn" style="accent-color:var(--primary);">
                <label for="rx-prn" style="font-size:13px;cursor:pointer;">PRN medication (as needed)</label>
              </div>
              <button class="btn btn-accent w-full" onclick="Pages.addToBasket()">➕ Add to Prescription</button>
            </div>

            <!-- Basket -->
            <div id="rx-basket" style="display:none;margin-top:16px;">
              <div class="divider-text mb-3">Prescription Basket</div>
              <div id="basket-items" style="display:flex;flex-direction:column;gap:8px;"></div>
              <div class="flex gap-2 mt-4">
                <button class="btn btn-outline flex-1" onclick="alert('Saved as draft (demo)')">💾 Save Draft</button>
                <button class="btn btn-primary flex-1" onclick="Pages.sendToPharma()">📤 Send to Pharmacy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  Pages.searchDrug = function(q) {
    const sug = document.getElementById('drug-suggestions');
    if (!q) { sug.style.display='none'; return; }
    const popEl = document.getElementById('eml-population');
    const pop = popEl ? popEl.value : '';
    const matches = (D.searchEML
      ? D.searchEML(q, { population: pop || undefined })
      : D.drugs.filter(d => d.name.toLowerCase().includes(q.toLowerCase()))
    ).slice(0, 10);
    if (!matches.length) { sug.style.display='none'; return; }
    sug.style.display='block';
        sug.innerHTML = matches.map(d=>`
      <div style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-light);font-size:13px;"
           onmousedown="Pages.selectDrug('${d.name.replace(/'/g,"\\'")}')"
           onmouseover="this.style.background='var(--bg-secondary)'"
           onmouseout="this.style.background=''">
        <strong>${d.name}</strong>
        <span style="color:var(--text-muted);font-size:11px;"> ${d.subcategory||d.class||d.category||''}</span>
        <span style="font-size:10px;margin-left:6px;padding:1px 6px;border-radius:4px;background:rgba(5,150,105,0.12);color:#059669;font-weight:600;">AKS-EML</span>
        ${d.aware ? `<span style="font-size:10px;margin-left:4px;padding:1px 6px;border-radius:4px;background:${d.aware==='Reserve'?'rgba(220,38,38,0.12)':d.aware==='Watch'?'rgba(245,158,11,0.15)':'rgba(14,165,233,0.12)'};color:${d.aware==='Reserve'?'#DC2626':d.aware==='Watch'?'#D97706':'#0284C7'};font-weight:600;">AWaRe ${d.aware}</span>` : ''}
      </div>`).join('');
  };

  Pages.selectDrug = function(name) {
    selectedDrug = D.drugs.find(d=>d.name===name) || (D.searchEML && D.searchEML(name)[0]);
    if (selectedDrug && !selectedDrug.commonDoses) selectedDrug.commonDoses = selectedDrug.strengths || selectedDrug.commonDoses || [];
    if (selectedDrug && !selectedDrug.routes) selectedDrug.routes = selectedDrug.routes || ['Oral'];
    document.getElementById('drug-search-input').value = name;
    document.getElementById('drug-suggestions').style.display='none';
    document.getElementById('drug-detail-form').classList.remove('hidden');

    // Allergy check
    const allergyWarn = document.getElementById('allergy-warn');
    const patient = D.patients[0]; // simplified — use selected patient
    const isAllergy = patient.allergies.some(a=>a.toLowerCase().includes(name.toLowerCase())||name.toLowerCase().includes(a.toLowerCase()));
    const emlOk = D.isOnEML ? D.isOnEML(name) : true;
    const emlBadge = emlOk
      ? '<div class="alert alert-success mb-2" style="padding:8px 12px;"><span class="alert-icon">✓</span><div><strong>AKS-EML:</strong> On Akwa Ibom Essential Medicines List (2026).</div></div>'
      : '<div class="alert alert-critical mb-2" style="padding:8px 12px;"><span class="alert-icon">⚠</span><div><strong>Not on AKS-EML:</strong> This medicine is outside the state Essential Medicines List. Justify clinically or choose an EML alternative.</div></div>';
    allergyWarn.innerHTML = emlBadge + (isAllergy ? `
      <div class="alert alert-critical mb-3">
        <span class="alert-icon">⚠</span>
        <div><strong>ALLERGY WARNING:</strong> Patient has a documented allergy to ${name}. Prescribing not advised.</div>
      </div>` : '');

    // Pre-fill common dose
    if (selectedDrug.commonDoses.length) {
      document.getElementById('rx-dose').value = selectedDrug.commonDoses[0];
    }
    if (selectedDrug.routes.length) {
      const routeSel = document.getElementById('rx-route');
      routeSel.value = selectedDrug.routes[0];
    }
  };

  Pages.addToBasket = function() {
    if (!selectedDrug) return;
    const drug = {
      name: selectedDrug.name,
      dose: document.getElementById('rx-dose').value,
      route: document.getElementById('rx-route').value,
      freq: document.getElementById('rx-freq').value,
      duration: document.getElementById('rx-duration').value||'—',
      qty: document.getElementById('rx-qty').value||'—',
      instructions: document.getElementById('rx-instructions').value||'',
    };
    basket.push(drug);
    renderBasket();
    document.getElementById('drug-search-input').value='';
    document.getElementById('drug-detail-form').classList.add('hidden');
    document.getElementById('drug-suggestions').style.display='none';
    selectedDrug = null;
  };

  function renderBasket() {
    if (!basket.length) { document.getElementById('rx-basket').style.display='none'; return; }
    document.getElementById('rx-basket').style.display='block';
    document.getElementById('basket-items').innerHTML = basket.map((d,i)=>`
      <div class="drug-card" style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="drug-name">💊 ${d.name} ${d.dose}</div>
          <div class="drug-dose">${d.route} • ${d.freq} • ${d.duration}</div>
          ${d.instructions?`<div class="drug-meta">📝 ${d.instructions}</div>`:''}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="Pages.removeFromBasket(${i})">✕</button>
      </div>`).join('');
  }

  Pages.removeFromBasket = function(i) {
    basket.splice(i,1);
    renderBasket();
  };

  Pages.sendToPharma = function() {
    C.showModal('pharma-modal','📤 Send to Pharmacy',`
      <div class="alert alert-success mb-4">
        <span class="alert-icon">✅</span>
        <div>Prescription ready to send to pharmacy. ${basket.length} drug(s) in basket.</div>
      </div>
      <div style="background:var(--surface);border-radius:var(--radius-md);padding:12px;">
        ${basket.map(d=>`<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--border);">💊 ${d.name} ${d.dose} — ${d.route} — ${d.freq}</div>`).join('')}
      </div>
    `,`
      <button class="btn btn-ghost" onclick="document.getElementById('pharma-modal').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="alert('Sent to pharmacy (demo)');basket=[];renderBasket();document.getElementById('pharma-modal').remove();">📤 Confirm & Send</button>
    `,'modal-sm');
  };

  Pages.filterRxByPatient = function(pid) {
    const list = pid ? D.prescriptions.filter(rx=>rx.patientId===pid) : D.prescriptions;
    const container = document.getElementById('rx-list');
    container.innerHTML = list.map(rx=>`
      <div style="margin-bottom:16px;">
        <div class="flex items-center justify-between mb-2">
          <div>
            <div style="font-size:13px;font-weight:700;">${rx.patient}</div>
            <div style="font-size:11px;color:var(--text-muted);">${rx.id} • ${rx.date}</div>
          </div>
          ${C.statusBadge(rx.status)}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${rx.drugs.map(d=>C.drugRow(d)).join('')}
        </div>
      </div><div class="divider"></div>`).join('')||C.emptyState('💊','No Prescriptions','');
  };
};
