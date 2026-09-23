/* ============================================================
   HOSPITAL OS — ROLE DASHBOARDS
   Nurse · Pharmacist · Lab · Reception · Admin
   Same design system, live indicators, hospital standards
   ============================================================ */
window.Pages = window.Pages || {};

// ── Shared helpers ──────────────────────────────────────────
function roleGreeting(user) {
  const hour = new Date().getHours();
  const g = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  return `${g}, ${user.prefix} ${user.lastName}`;
}

function liveBanner(user, subtitle) {
  const now = new Date();
  return `
  <div style="background:linear-gradient(135deg,var(--sidebar-bg) 0%,#0D3060 60%,#0A4080 100%);
              border-radius:var(--radius-xl);padding:var(--space-6);margin-bottom:var(--space-6);
              position:relative;overflow:hidden;color:white;">
    <div style="position:absolute;top:-40px;right:60px;width:200px;height:200px;
                background:radial-gradient(circle,rgba(26,110,181,0.5) 0%,transparent 70%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-30px;right:200px;width:120px;height:120px;
                background:radial-gradient(circle,rgba(0,180,166,0.3) 0%,transparent 70%);pointer-events:none;"></div>
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-5">
        <div style="width:72px;height:72px;border-radius:50%;background:${user.color||'var(--primary)'};
                    display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;
                    border:3px solid rgba(255,255,255,0.25);color:white;">
          ${user.avatar ? `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${user.firstName[0]}${user.lastName[0]}'">` : (user.firstName[0]+user.lastName[0])}
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">${roleGreeting(user)} 👋</div>
          <div style="font-size:13px;opacity:0.7;margin-top:3px;">${user.specialty} — ${user.department}</div>
          <div class="flex items-center gap-3 mt-2">
            <div class="live-dot"></div>
            <span style="font-size:12px;opacity:0.85;">On duty · Shift ${user.shift}</span>
            <span style="font-size:12px;opacity:0.5;">|</span>
            <span style="font-size:12px;opacity:0.85;" data-live-clock>${now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
          </div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;opacity:0.6;text-transform:uppercase;letter-spacing:1px;">Live Facility</div>
        <div style="font-size:13px;font-weight:600;margin-top:2px;" data-live-date>${now.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</div>
        <div style="font-size:12px;opacity:0.7;margin-top:4px;">${subtitle||''}</div>
      </div>
    </div>
  </div>`;
}

function priorityBadge(p) {
  const map = { urgent:'critical', critical:'critical', high:'warning', routine:'info', pending:'info' };
  const cls = map[p] || 'info';
  return `<span class="badge badge-${cls}">${p}</span>`;
}

function statusPill(s) {
  const colors = {
    pending:'#F59E0B', dispensing:'#3B82F6', ready:'#10B981', processing:'#8B5CF6',
    received:'#64748B', completed:'#10B981', waiting:'#F59E0B', called:'#3B82F6',
  };
  const c = colors[s] || '#94A3B8';
  return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;background:${c}18;color:${c};">
    <span style="width:6px;height:6px;border-radius:50%;background:${c};"></span>${s}</span>`;
}

/* ============================================================
   NURSE DASHBOARD
   ============================================================ */
Pages.nurseDashboard = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const user = D.getCurrentUser();
  const root = document.getElementById('page-root');
  const openTasks = D.nursingTasks.filter(t => !t.done);
  const critical = D.patients.filter(p => p.status === 'critical');
  const inpatients = D.patients.filter(p => p.type === 'inpatient');

  root.innerHTML = `
  <div class="page-enter">
    ${liveBanner(user, 'Ward Nursing Console · Real-time')}

    <div class="content-grid-4" style="margin-bottom:var(--space-6);">
      ${C.statCard({icon:'🛏',iconBg:'rgba(0,180,166,0.12)',value:inpatients.length,label:'My Ward Patients',change:'Live census',changeDir:'up'})}
      ${C.statCard({icon:'🔴',iconBg:'var(--critical-light)',value:critical.length,label:'Critical / Unstable',change:'Requires close monitoring',changeDir:'down',extraClass:'critical-card'})}
      ${C.statCard({icon:'📋',iconBg:'rgba(245,158,11,0.12)',value:openTasks.length,label:'Open Nursing Tasks',change:`${openTasks.filter(t=>t.priority==='urgent').length} urgent`,changeDir:'warn'})}
      ${C.statCard({icon:'💊',iconBg:'rgba(139,92,246,0.12)',value:D.nursingTasks.filter(t=>t.task.toLowerCase().includes('administer')&&!t.done).length,label:'Meds Due',change:'eMAR pending',changeDir:'warn'})}
    </div>

    <div class="content-grid-2" style="margin-bottom:var(--space-6);">
      <!-- Nursing Task List -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 Nursing Task Board</div>
          <div class="live-dot" title="Realtime"></div>
        </div>
        <div class="card-body" style="padding:0;">
          ${D.nursingTasks.map(t => `
            <div class="list-row" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);${t.done?'opacity:0.55;':''}">
              <div style="width:8px;height:8px;border-radius:50%;background:${t.priority==='urgent'?'var(--critical)':t.priority==='high'?'var(--warning)':'var(--info)'};flex-shrink:0;"></div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;">${t.task}</div>
                <div style="font-size:11px;color:var(--text-muted);">${t.patient} · ${t.ward}</div>
              </div>
              <div style="font-size:11px;font-weight:600;color:var(--text-secondary);">${t.due}</div>
              ${priorityBadge(t.priority)}
              ${t.done ? '<span style="color:var(--success);font-size:16px;">✓</span>' : '<button class="btn btn-sm btn-primary" style="padding:4px 10px;font-size:11px;">Done</button>'}
            </div>`).join('')}
        </div>
      </div>

      <!-- Critical Patients Live Vitals -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔴 Critical Patients — Live Vitals</div>
          <div class="live-dot"></div>
        </div>
        <div class="card-body">
          ${critical.length ? critical.map(p => `
            <div style="padding:12px;border-radius:var(--radius-md);background:var(--critical-light);margin-bottom:10px;border-left:3px solid var(--critical);">
              <div class="flex items-center justify-between mb-2">
                <div style="font-weight:700;font-size:14px;">${p.name}</div>
                <span class="badge badge-critical">${p.ward} · Bed ${p.bed}</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:12px;">
                <div><span style="color:var(--text-muted);">BP</span><br><strong data-vital-bp="${p.id}">${p.vitals?.bp||'—'}</strong></div>
                <div><span style="color:var(--text-muted);">Pulse</span><br><strong data-vital-pulse="${p.id}">${p.vitals?.pulse||'—'}</strong></div>
                <div><span style="color:var(--text-muted);">SpO₂</span><br><strong data-vital-spo2="${p.id}">${p.vitals?.spo2||'—'}%</strong></div>
                <div><span style="color:var(--text-muted);">Temp</span><br><strong>${p.vitals?.temp||'—'}°C</strong></div>
              </div>
            </div>`).join('') : '<div style="text-align:center;color:var(--text-muted);padding:24px;">No critical patients</div>'}
        </div>
      </div>
    </div>

    <!-- Bed Board -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">🛏 Live Bed Board</div>
        <div style="font-size:12px;color:var(--text-muted);">Hospital-wide occupancy</div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;">
          ${D.bedBoard.map(b => {
            const pct = Math.round((b.occupied/b.total)*100);
            return `
            <div style="padding:14px;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--card);">
              <div style="font-weight:700;font-size:14px;margin-bottom:6px;">${b.ward}</div>
              <div style="font-size:22px;font-weight:800;">${b.occupied}<span style="font-size:13px;font-weight:500;color:var(--text-muted);">/${b.total}</span></div>
              <div style="height:6px;background:var(--border);border-radius:3px;margin:8px 0;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${pct>90?"var(--critical)":pct>75?"var(--warning)":"var(--accent)"};border-radius:3px;"></div>
              </div>
              <div style="font-size:11px;color:var(--text-muted);">${b.available} free · ${b.critical} critical</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  </div>`;

  // Live vital updates
  if (window.Realtime) {
    Realtime.on('vitals', ({ patientId, vitals }) => {
      const pulseEl = document.querySelector(`[data-vital-pulse="${patientId}"]`);
      const spo2El = document.querySelector(`[data-vital-spo2="${patientId}"]`);
      if (pulseEl) { pulseEl.textContent = Math.round(vitals.pulse); pulseEl.style.color = vitals.pulse > 110 ? 'var(--critical)' : ''; }
      if (spo2El) { spo2El.textContent = Math.round(vitals.spo2) + '%'; spo2El.style.color = vitals.spo2 < 92 ? 'var(--critical)' : ''; }
    });
  }
};

/* ============================================================
   PHARMACIST DASHBOARD
   ============================================================ */
Pages.pharmacistDashboard = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const user = D.getCurrentUser();
  const root = document.getElementById('page-root');
  const pending = D.pharmacyQueue.filter(q => q.status === 'pending' || q.status === 'dispensing').length;
  const ready = D.pharmacyQueue.filter(q => q.status === 'ready').length;
  const urgent = D.pharmacyQueue.filter(q => q.priority === 'urgent' || q.priority === 'high').length;

  root.innerHTML = `
  <div class="page-enter">
    ${liveBanner(user, 'Clinical Pharmacy · Dispensing Console')}

    <div class="content-grid-4" style="margin-bottom:var(--space-6);">
      ${C.statCard({icon:'💊',iconBg:'rgba(139,92,246,0.12)',value:pending,label:'Prescriptions in Queue',change:'Live queue',changeDir:'warn'})}
      ${C.statCard({icon:'✅',iconBg:'var(--success-light)',value:ready,label:'Ready for Collection',change:'Patient waiting',changeDir:'up'})}
      ${C.statCard({icon:'⚡',iconBg:'var(--critical-light)',value:urgent,label:'Urgent / High Priority',change:'Prioritise these',changeDir:'down',extraClass:'critical-card'})}
      ${C.statCard({icon:'📦',iconBg:'rgba(0,180,166,0.12)',value:D.queues.pharmacy,label:'Patients at Counter',change:'Queue length',changeDir:'warn'})}
    </div>

    <div class="card" style="margin-bottom:var(--space-6);">
      <div class="card-header">
        <div class="card-title">💊 Dispensing Queue</div>
        <div class="flex items-center gap-2"><div class="live-dot"></div><span style="font-size:12px;color:var(--text-muted);">Realtime</span></div>
      </div>
      <div class="card-body" style="padding:0;" id="pharmacy-queue-body">
        ${D.pharmacyQueue.map(q => `
          <div class="list-row" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid var(--border);">
            <div style="width:40px;height:40px;border-radius:10px;background:rgba(139,92,246,0.12);display:flex;align-items:center;justify-content:center;font-size:18px;">💊</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;">${q.patient}</div>
              <div style="font-size:11px;color:var(--text-muted);">${q.mrn} · ${q.drugs}</div>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);">${q.time}</div>
            ${priorityBadge(q.priority)}
            ${statusPill(q.status)}
            ${q.status !== 'ready' ? `<button class="btn btn-sm btn-primary" style="padding:4px 12px;font-size:11px;" onclick="this.textContent='✓';this.disabled=true;">${q.status==='pending'?'Start':'Complete'}</button>` : '<span style="color:var(--success);font-weight:600;font-size:12px;">Ready</span>'}
          </div>`).join('')}
      </div>
    </div>

    <div class="content-grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title">⚠️ Clinical Alerts</div></div>
        <div class="card-body">
          <div style="padding:10px;border-radius:var(--radius-md);background:var(--warning-light);margin-bottom:8px;font-size:13px;">
            <strong>Allergy check:</strong> Patient P-001 has Penicillin allergy — verify antibiotic orders.
          </div>
          <div style="padding:10px;border-radius:var(--radius-md);background:var(--critical-light);margin-bottom:8px;font-size:13px;">
            <strong>High-alert med:</strong> Noradrenaline infusion for ICU patient — double-check concentration.
          </div>
          <div style="padding:10px;border-radius:var(--radius-md);background:var(--info-light);font-size:13px;">
            <strong>Stock:</strong> Meropenem 1g — 14 vials remaining. Reorder recommended.
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📊 Today’s Summary</div></div>
        <div class="card-body">
          <div class="flex items-center justify-between mb-3"><span style="color:var(--text-secondary);">Prescriptions dispensed</span><strong>47</strong></div>
          <div class="flex items-center justify-between mb-3"><span style="color:var(--text-secondary);">Clinical interventions</span><strong>6</strong></div>
          <div class="flex items-center justify-between mb-3"><span style="color:var(--text-secondary);">Controlled drugs issued</span><strong>3</strong></div>
          <div class="flex items-center justify-between mb-3"><span style="color:var(--text-secondary);">AKS-EML items in formulary</span><strong>${(window.AKS_EML&&AKS_EML.count)||D.drugs.length}</strong></div>
          <div class="flex items-center justify-between mb-3"><span style="color:var(--text-secondary);">AWaRe Reserve on hand</span><strong style="color:#DC2626;">Meropenem, Vancomycin, Linezolid</strong></div>
          <div style="margin-top:8px;padding:10px;border-radius:8px;background:rgba(5,150,105,0.08);font-size:12px;color:#065F46;">
            <strong>AKS-EML 2026</strong> — Dispense preferentially from the Akwa Ibom Essential Medicines List. Flag non-EML orders for clinical justification.
          </div>
          <div class="flex items-center justify-between mb-3 hidden"><span></span><strong>3</strong></div>
          <div class="flex items-center justify-between"><span style="color:var(--text-secondary);">Average wait time</span><strong>12 min</strong></div>
        </div>
      </div>
    </div>
  </div>`;
};

/* ============================================================
   LAB TECHNICIAN DASHBOARD
   ============================================================ */
Pages.labDashboard = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const user = D.getCurrentUser();
  const root = document.getElementById('page-root');
  const processing = D.labQueue.filter(q => q.status === 'processing' || q.status === 'received').length;
  const criticalLabs = D.labQueue.filter(q => q.priority === 'critical' || q.priority === 'urgent').length;
  const completed = D.labQueue.filter(q => q.status === 'completed').length;

  root.innerHTML = `
  <div class="page-enter">
    ${liveBanner(user, 'Pathology Laboratory · Sample Tracking')}

    <div class="content-grid-4" style="margin-bottom:var(--space-6);">
      ${C.statCard({icon:'🧪',iconBg:'rgba(245,158,11,0.12)',value:processing,label:'Samples in Process',change:'Live bench load',changeDir:'warn'})}
      ${C.statCard({icon:'🔴',iconBg:'var(--critical-light)',value:criticalLabs,label:'Critical / Urgent',change:'TAT priority',changeDir:'down',extraClass:'critical-card'})}
      ${C.statCard({icon:'✅',iconBg:'var(--success-light)',value:completed,label:'Completed Today',change:'Results released',changeDir:'up'})}
      ${C.statCard({icon:'📥',iconBg:'rgba(59,130,246,0.12)',value:D.queues.lab,label:'Samples Received',change:'Queue length',changeDir:'warn'})}
    </div>

    <div class="card" style="margin-bottom:var(--space-6);">
      <div class="card-header">
        <div class="card-title">🧪 Laboratory Worklist</div>
        <div class="flex items-center gap-2"><div class="live-dot"></div><span style="font-size:12px;color:var(--text-muted);">Realtime TAT</span></div>
      </div>
      <div class="card-body" style="padding:0;">
        ${D.labQueue.map(q => `
          <div class="list-row" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid var(--border);">
            <div style="width:40px;height:40px;border-radius:10px;background:rgba(245,158,11,0.12);display:flex;align-items:center;justify-content:center;font-size:18px;">🧪</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;">${q.patient}</div>
              <div style="font-size:11px;color:var(--text-muted);">${q.mrn} · ${q.tests}</div>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);">${q.time}</div>
            ${priorityBadge(q.priority)}
            ${statusPill(q.status)}
          </div>`).join('')}
      </div>
    </div>

    <div class="content-grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title">⏱ Turnaround Targets</div></div>
        <div class="card-body">
          <div class="flex items-center justify-between mb-3"><span>Critical (Troponin, ABG)</span><strong style="color:var(--critical);">&lt; 30 min</strong></div>
          <div class="flex items-center justify-between mb-3"><span>Urgent (FBC, U&E)</span><strong style="color:var(--warning);">&lt; 60 min</strong></div>
          <div class="flex items-center justify-between mb-3"><span>Routine Chemistry</span><strong>&lt; 4 hrs</strong></div>
          <div class="flex items-center justify-between"><span>Culture / Special</span><strong>&lt; 48–72 hrs</strong></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📢 Critical Value Protocol</div></div>
        <div class="card-body" style="font-size:13px;line-height:1.6;">
          All critical results must be telephoned to the requesting clinician within <strong>15 minutes</strong> of verification and documented in the LIS with read-back confirmation.
        </div>
      </div>
    </div>
  </div>`;
};

/* ============================================================
   RECEPTION / FRONT DESK DASHBOARD
   ============================================================ */
Pages.receptionDashboard = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const user = D.getCurrentUser();
  const root = document.getElementById('page-root');
  const waiting = D.receptionQueue.filter(q => q.status === 'waiting').length;

  root.innerHTML = `
  <div class="page-enter">
    ${liveBanner(user, 'Patient Access · Registration & Check-in')}

    <div class="content-grid-4" style="margin-bottom:var(--space-6);">
      ${C.statCard({icon:'👥',iconBg:'rgba(236,72,153,0.12)',value:D.queues.opdWaiting,label:'OPD Waiting',change:'Live queue',changeDir:'warn'})}
      ${C.statCard({icon:'📋',iconBg:'rgba(59,130,246,0.12)',value:waiting,label:'At Front Desk',change:'Registration queue',changeDir:'warn'})}
      ${C.statCard({icon:'🆕',iconBg:'var(--success-light)',value:D.facilityMetrics.todayAdmissions,label:"Today's Admissions",change:'Inpatient',changeDir:'up'})}
      ${C.statCard({icon:'⏱',iconBg:'rgba(245,158,11,0.12)',value:D.facilityMetrics.averageWaitMins+'m',label:'Avg Wait Time',change:'Target &lt; 20 min',changeDir:'warn'})}
    </div>

    <div class="content-grid-2" style="margin-bottom:var(--space-6);">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🎫 Front Desk Queue</div>
          <div class="live-dot"></div>
        </div>
        <div class="card-body" style="padding:0;">
          ${D.receptionQueue.map(q => `
            <div class="list-row" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid var(--border);">
              <div style="width:40px;height:40px;border-radius:50%;background:rgba(236,72,153,0.15);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#EC4899;">
                ${q.name.split(' ').map(p=>p[0]).join('').slice(0,2)}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;">${q.name}</div>
                <div style="font-size:11px;color:var(--text-muted);">${q.type}</div>
              </div>
              <div style="font-size:12px;color:var(--text-secondary);">${q.time}</div>
              ${priorityBadge(q.priority)}
              ${statusPill(q.status)}
              ${q.status==='waiting'?`<button class="btn btn-sm btn-primary" style="padding:4px 12px;font-size:11px;">Call</button>`:''}
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">⚡ Quick Actions</div></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${[
              {icon:'🆕',label:'New Registration',bg:'rgba(16,185,129,0.12)'},
              {icon:'📅',label:'Check-in Appointment',bg:'rgba(26,110,181,0.12)'},
              {icon:'🚑',label:'Emergency Arrival',bg:'rgba(229,57,53,0.12)'},
              {icon:'💳',label:'Billing / Payment',bg:'rgba(139,92,246,0.12)'},
              {icon:'🔍',label:'Find Patient',bg:'rgba(245,158,11,0.12)'},
              {icon:'🖨',label:'Print Card / Label',bg:'rgba(0,180,166,0.12)'},
            ].map(a=>`
              <div class="quick-action-card" style="cursor:pointer;">
                <div class="quick-action-icon" style="background:${a.bg};">${a.icon}</div>
                <div class="quick-action-label">${a.label}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;
};

/* ============================================================
   HOSPITAL ADMIN / OPERATIONS DASHBOARD
   ============================================================ */
Pages.adminDashboard = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const user = D.getCurrentUser();
  const root = document.getElementById('page-root');
  const m = D.facilityMetrics;

  root.innerHTML = `
  <div class="page-enter">
    ${liveBanner(user, 'Hospital Command · Operations Overview')}

    <div class="content-grid-4" style="margin-bottom:var(--space-6);">
      ${C.statCard({icon:'🛏',iconBg:'rgba(26,110,181,0.12)',value:m.occupancyRate+'%',label:'Bed Occupancy',change:`${m.occupiedBeds}/${m.totalBeds} beds`,changeDir:m.occupancyRate>85?'down':'up'})}
      ${C.statCard({icon:'🔴',iconBg:'var(--critical-light)',value:m.criticalPatients,label:'Critical Patients',change:'Hospital-wide',changeDir:'down',extraClass:'critical-card'})}
      ${C.statCard({icon:'👨‍⚕️',iconBg:'rgba(0,180,166,0.12)',value:m.staffOnDuty,label:'Staff On Duty',change:'All departments',changeDir:'up'})}
      ${C.statCard({icon:'💰',iconBg:'rgba(139,92,246,0.12)',value:m.revenueToday,label:"Today's Revenue",change:'Cash + HMO',changeDir:'up'})}
    </div>

    <div class="content-grid-2" style="margin-bottom:var(--space-6);">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🛏 Live Bed Board</div>
          <div class="live-dot"></div>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
            ${D.bedBoard.map(b => {
              const pct = Math.round((b.occupied/b.total)*100);
              return `
              <div style="padding:14px;border-radius:var(--radius-md);border:1px solid var(--border);">
                <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${b.ward}</div>
                <div style="font-size:20px;font-weight:800;">${b.occupied}<span style="font-size:12px;color:var(--text-muted);">/${b.total}</span></div>
                <div style="height:5px;background:var(--border);border-radius:3px;margin:6px 0;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;background:${pct>90?"var(--critical)":pct>75?"var(--warning)":"var(--accent)"};"></div>
                </div>
                <div style="font-size:11px;color:var(--text-muted);">${b.available} free</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">📊 Operational Snapshot</div></div>
        <div class="card-body">
          <div class="flex items-center justify-between mb-3"><span style="color:var(--text-secondary);">Today’s Admissions</span><strong>${m.todayAdmissions}</strong></div>
          <div class="flex items-center justify-between mb-3"><span style="color:var(--text-secondary);">Today’s Discharges</span><strong>${m.todayDischarges}</strong></div>
          <div class="flex items-center justify-between mb-3"><span style="color:var(--text-secondary);">OPD Attendance</span><strong>${m.todayOPD}</strong></div>
          <div class="flex items-center justify-between mb-3"><span style="color:var(--text-secondary);">Theatre Cases</span><strong>${m.theatreCasesToday}</strong></div>
          <div class="flex items-center justify-between mb-3"><span style="color:var(--text-secondary);">Avg Wait (OPD)</span><strong>${m.averageWaitMins} min</strong></div>
          <div class="flex items-center justify-between"><span style="color:var(--text-secondary);">Available Beds</span><strong style="color:var(--success);">${m.availableBeds}</strong></div>
        </div>
      </div>
    </div>

    <div class="content-grid-3">
      <div class="card">
        <div class="card-header"><div class="card-title">🏥 Department Queues</div></div>
        <div class="card-body">
          ${Object.entries(D.queues).map(([k,v]) => `
            <div class="flex items-center justify-between mb-2">
              <span style="font-size:13px;text-transform:capitalize;">${k.replace(/([A-Z])/g,' $1')}</span>
              <strong style="font-size:14px;">${v}</strong>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">🔔 System Alerts</div></div>
        <div class="card-body" style="font-size:13px;">
          <div style="padding:8px;background:var(--critical-light);border-radius:8px;margin-bottom:8px;">ICU occupancy 87% — consider step-down transfers</div>
          <div style="padding:8px;background:var(--warning-light);border-radius:8px;margin-bottom:8px;">Pharmacy Meropenem stock low</div>
          <div style="padding:8px;background:var(--info-light);border-radius:8px;">Theatre list: 6 cases scheduled today</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">⚡ Command Actions</div></div>
        <div class="card-body">
          <div style="display:grid;gap:8px;">
            <button class="btn btn-primary w-full" style="justify-content:center;">Broadcast Alert</button>
            <button class="btn btn-secondary w-full" style="justify-content:center;">View Staff Roster</button>
            <button class="btn btn-secondary w-full" style="justify-content:center;">Incident Log</button>
            <button class="btn btn-secondary w-full" style="justify-content:center;">Capacity Report</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
};
