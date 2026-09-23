/* ============================================================
   APPOINTMENTS PAGE
   ============================================================ */
Pages.appointments = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  const statuses = ['waiting','in-progress','completed','upcoming','no-show'];
  const statusLabels = { waiting:'Waiting', 'in-progress':'In Progress', completed:'Completed', upcoming:'Upcoming', 'no-show':'No Show' };

  root.innerHTML = `
  <div class="page-enter">
    ${C.pageHeader("📅 Appointments & Clinic","Today's clinic and upcoming appointments",`
      <button class="btn btn-primary" onclick="Pages.showNewAptModal()">➕ Book Appointment</button>
    `)}

    <!-- STAT STRIP -->
    <div class="content-grid-4 mb-5 stagger-children">
      ${[
        {icon:'⏳',bg:'var(--warning-light)',val:D.appointments.filter(a=>a.status==='waiting').length,lbl:'Waiting',color:'var(--warning)'},
        {icon:'🩺',bg:'var(--primary-light)',val:D.appointments.filter(a=>a.status==='in-progress').length,lbl:'In Progress',color:'var(--primary)'},
        {icon:'✅',bg:'var(--success-light)',val:D.appointments.filter(a=>a.status==='completed').length,lbl:'Completed',color:'var(--success)'},
        {icon:'❌',bg:'var(--surface)',val:D.appointments.filter(a=>a.status==='no-show').length,lbl:'No Show',color:'var(--text-muted)'},
      ].map(s=>`
        <div class="card" style="padding:var(--space-4);text-align:center;border-top:3px solid ${s.color};">
          <div style="font-size:28px;font-weight:800;color:${s.color};">${s.val}</div>
          <div style="font-size:12px;color:var(--text-muted);">${s.lbl}</div>
        </div>`).join('')}
    </div>

    <div class="content-cols-main">
      <!-- TODAY'S APPOINTMENTS TABLE -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 Today's Clinic — ${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</div>
          <div class="filter-chips" id="apt-filter">
            <button class="filter-chip active" onclick="Pages.filterApts('all',this)">All</button>
            <button class="filter-chip" onclick="Pages.filterApts('waiting',this)">Waiting</button>
            <button class="filter-chip" onclick="Pages.filterApts('in-progress',this)">In Progress</button>
            <button class="filter-chip" onclick="Pages.filterApts('completed',this)">Completed</button>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table" id="apt-table">
            <thead>
              <tr>
                <th>Time</th><th>Patient</th><th>Type</th><th>Notes</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody id="apt-tbody">
              ${renderAptRows(D.appointments)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- RIGHT: UPCOMING -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="card">
          <div class="card-header"><div class="card-title">📅 Upcoming</div></div>
          <div class="card-body" style="padding:var(--space-3);">
            ${D.appointments.filter(a=>a.status==='upcoming').map(a=>`
              <div style="padding:10px;border-radius:var(--radius-md);border:1px solid var(--border);margin-bottom:8px;">
                <div class="flex justify-between items-center">
                  <div>
                    <div style="font-size:13px;font-weight:600;">${a.name}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${a.time} • ${a.type}</div>
                    <div style="font-size:11px;color:var(--text-secondary);margin-top:3px;">${a.notes}</div>
                  </div>
                  ${C.statusBadge(a.status)}
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Patient Queue -->
        <div class="card">
          <div class="card-header"><div class="card-title">🏃 Patient Queue</div></div>
          <div class="card-body" style="padding:var(--space-3);">
            ${D.appointments.filter(a=>a.status==='waiting').map((a,i)=>`
              <div style="display:flex;align-items:center;gap:var(--space-3);padding:10px;border-radius:var(--radius-md);background:var(--surface);border:1px solid var(--border);margin-bottom:8px;">
                <div style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">${i+1}</div>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:600;">${a.name}</div>
                  <div style="font-size:11px;color:var(--text-muted);">${a.type} • ${a.time}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="Pages.callPatient('${a.id}')">Call In</button>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;

  function renderAptRows(list) {
    if (!list.length) return `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">No appointments found</td></tr>`;
    return list.map(a=>`
    <tr id="apt-row-${a.id}">
      <td><strong style="color:var(--primary);">${a.time}</strong></td>
      <td>
        <div style="font-size:13px;font-weight:600;">${a.name}</div>
        ${a.patient?`<div style="font-size:11px;color:var(--primary);cursor:pointer;" onclick="Router.navigate('/emr/${a.patient}')">View EMR →</div>`:''}
      </td>
      <td><span class="badge badge-neutral">${a.type}</span></td>
      <td style="font-size:12px;color:var(--text-muted);max-width:180px;">${a.notes}</td>
      <td>${C.statusBadge(a.status)}</td>
      <td>
        <div class="flex gap-1">
          ${a.status==='waiting'?`<button class="btn btn-primary btn-sm" onclick="Pages.updateAptStatus('${a.id}','in-progress')">▶ Start</button>`:''}
          ${a.status==='in-progress'?`<button class="btn btn-success btn-sm" onclick="Pages.updateAptStatus('${a.id}','completed')">✅ Complete</button>`:''}
          ${a.status!=='completed'&&a.status!=='no-show'?`<button class="btn btn-ghost btn-sm" onclick="Pages.updateAptStatus('${a.id}','no-show')">❌</button>`:''}
          ${a.patient?`<button class="btn btn-ghost btn-sm" onclick="Router.navigate('/consultations?patient=${a.patient}')">🩺</button>`:''}
        </div>
      </td>
    </tr>`).join('');
  }

  Pages.filterApts = function(status, btn) {
    document.querySelectorAll('#apt-filter .filter-chip').forEach(el=>el.classList.remove('active'));
    btn.classList.add('active');
    const list = status==='all' ? D.appointments : D.appointments.filter(a=>a.status===status);
    document.getElementById('apt-tbody').innerHTML = renderAptRows(list);
  };

  Pages.updateAptStatus = function(id, newStatus) {
    const apt = D.appointments.find(a=>a.id===id);
    if (apt) apt.status = newStatus;
    document.getElementById('apt-tbody').innerHTML = renderAptRows(D.appointments);
  };

  Pages.callPatient = function(id) {
    Pages.updateAptStatus(id,'in-progress');
    const apt = D.appointments.find(a=>a.id===id);
    if (apt) alert(`Calling patient: ${apt.name} (demo)`);
  };

  Pages.showNewAptModal = function() {
    C.showModal('new-apt-modal','📅 Book Appointment',`
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Patient <span class="required">*</span></label>
          <select class="form-control">
            <option value="">-- Select Patient --</option>
            ${D.patients.map(p=>`<option>${p.name} (${p.mrn})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Appointment Type <span class="required">*</span></label>
          <select class="form-control"><option>New Patient</option><option>Follow-up</option><option>Consultation</option><option>Review</option><option>Ward Round</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date <span class="required">*</span></label>
          <input class="form-control" type="date">
        </div>
        <div class="form-group">
          <label class="form-label">Time <span class="required">*</span></label>
          <input class="form-control" type="time">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes / Reason</label>
        <textarea class="form-control" rows="2" placeholder="Reason for appointment..."></textarea>
      </div>
    `,`
      <button class="btn btn-ghost" onclick="document.getElementById('new-apt-modal').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="alert('Appointment booked (demo)');document.getElementById('new-apt-modal').remove();">✅ Book Appointment</button>
    `);
  };
};

/* ============================================================
   LABORATORY PAGE
   ============================================================ */
Pages.laboratory = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');
  let activeCategory = Object.keys(D.labTests)[0];

  root.innerHTML = `
  <div class="page-enter">
    ${C.pageHeader('🧪 Laboratory','Order tests and view results')}

    <div class="content-cols-main">
      <!-- LEFT: Results -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="card">
          <div class="card-header">
            <div class="card-title">📊 Pending & Recent Results</div>
            <div class="filter-chips">
              <button class="filter-chip active" onclick="Pages.filterLabs('all',this)">All</button>
              <button class="filter-chip" onclick="Pages.filterLabs('critical',this)">🔴 Critical</button>
              <button class="filter-chip" onclick="Pages.filterLabs('available',this)">Available</button>
            </div>
          </div>
          <div class="card-body" style="padding:var(--space-3);" id="lab-results-list">
            ${D.labResults.map(l=>C.labResultCard(l)).join('')}
          </div>
        </div>

        <!-- TRENDING CHART -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">📈 Haemoglobin Trend — Mrs. Amaka Okafor</div>
            <span class="badge badge-info">Trending ↓</span>
          </div>
          <div class="card-body">
            <div style="height:200px;"><canvas id="hb-lab-trend"></canvas></div>
            <div style="display:flex;justify-content:center;gap:24px;margin-top:12px;">
              ${[{date:'09 Sep',val:12.1},{date:'12 Sep',val:11.4},{date:'15 Sep',val:10.8},{date:'18 Sep',val:10.2}].map(d=>`
                <div style="text-align:center;">
                  <div style="font-size:16px;font-weight:700;color:${d.val<11?'var(--critical)':'var(--text-primary)'};">${d.val}</div>
                  <div style="font-size:10px;color:var(--text-muted);">${d.date}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Order Panel -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="card">
          <div class="card-header"><div class="card-title">🧪 Order New Test</div></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Patient <span class="required">*</span></label>
              <select class="form-control">
                ${D.patients.map(p=>`<option>${p.name} — ${p.mrn}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <div class="filter-chips flex-wrap" id="lab-cat-filter">
                ${Object.keys(D.labTests).map((cat,i)=>`
                  <button class="filter-chip ${i===0?'active':''}" onclick="Pages.selectLabCat('${cat}',this)">${cat}</button>`).join('')}
              </div>
            </div>
            <div class="form-group" id="lab-test-list">
              <label class="form-label">Tests — ${activeCategory}</label>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${D.labTests[activeCategory].map(t=>`
                  <label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;">
                    <input type="checkbox" id="lt-${t.replace(/[^a-z0-9]/gi,'')}" style="accent-color:var(--primary);">
                    <span style="font-size:13px;">${t}</span>
                  </label>`).join('')}
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Urgency</label>
                <select class="form-control">
                  <option>Routine</option><option>Urgent</option><option>STAT</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Specimen</label>
                <select class="form-control">
                  <option>Blood — EDTA</option><option>Blood — SST</option><option>Urine</option><option>Sputum</option><option>Wound Swab</option><option>HVS</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Clinical Note / Indication</label>
              <textarea class="form-control" rows="2" placeholder="Reason for requesting test..."></textarea>
            </div>
            <button class="btn btn-primary w-full" onclick="alert('Lab order sent (demo)')">📤 Send to Laboratory</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  setTimeout(() => {
    const ctx = document.getElementById('hb-lab-trend');
    if (ctx && window.Chart) {
      new Chart(ctx, {
        type:'line',
        data:{
          labels:['09 Sep','12 Sep','15 Sep','18 Sep'],
          datasets:[{
            label:'Hb (g/dL)', data:[12.1,11.4,10.8,10.2],
            borderColor:'#1A6EB5', backgroundColor:'rgba(26,110,181,0.08)',
            tension:0.4, pointRadius:5, pointBackgroundColor:'#1A6EB5', fill:true,
          }]
        },
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{legend:{display:false}},
          scales:{
            y:{min:8,max:14,grid:{color:'#E2E8F0'},ticks:{font:{size:11}}},
            x:{grid:{display:false},ticks:{font:{size:11}}}
          }
        }
      });
    }
  }, 100);

  Pages.selectLabCat = function(cat, btn) {
    activeCategory = cat;
    document.querySelectorAll('#lab-cat-filter .filter-chip').forEach(el=>el.classList.remove('active'));
    btn.classList.add('active');
    const container = document.getElementById('lab-test-list');
    container.innerHTML = `
      <label class="form-label">Tests — ${cat}</label>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${D.labTests[cat].map(t=>`
          <label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;">
            <input type="checkbox" style="accent-color:var(--primary);">
            <span style="font-size:13px;">${t}</span>
          </label>`).join('')}
      </div>`;
  };

  Pages.filterLabs = function(filter, btn) {
    document.querySelectorAll('.filter-chips .filter-chip').forEach(el=>el.classList.remove('active'));
    btn.classList.add('active');
    const list = filter==='all' ? D.labResults : D.labResults.filter(l=>l.status===filter);
    document.getElementById('lab-results-list').innerHTML = list.map(l=>C.labResultCard(l)).join('')||C.emptyState('🧪','No Results','No results match this filter.');
  };
};
