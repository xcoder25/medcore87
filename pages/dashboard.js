/* ============================================================
   DASHBOARD PAGE
   ============================================================ */
window.Pages = window.Pages || {};

Pages.dashboard = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const dateStr = now.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});

  const inpatients = D.patients.filter(p=>p.type==='inpatient');
  const critical   = D.patients.filter(p=>p.status==='critical');
  const todayApts  = D.appointments.filter(a=>a.status!=='completed');
  const pendingLabs= D.labResults.filter(l=>l.status==='available'||l.status==='critical');
  const unread     = D.unreadNotifs();

  // Greeting
  const hour = now.getHours();
  const greeting = hour<12 ? 'Good Morning' : hour<17 ? 'Good Afternoon' : 'Good Evening';

  root.innerHTML = `
  <div class="page-enter">

    <!-- GREETING BANNER -->
    <div style="background:linear-gradient(135deg,var(--sidebar-bg) 0%,#0D3060 60%,#0A4080 100%);
                border-radius:var(--radius-xl);padding:var(--space-6);margin-bottom:var(--space-6);
                position:relative;overflow:hidden;color:white;">
      <div style="position:absolute;top:-40px;right:60px;width:200px;height:200px;
                  background:radial-gradient(circle,rgba(26,110,181,0.5) 0%,transparent 70%);pointer-events:none;"></div>
      <div style="position:absolute;bottom:-30px;right:200px;width:120px;height:120px;
                  background:radial-gradient(circle,rgba(0,180,166,0.3) 0%,transparent 70%);pointer-events:none;"></div>
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-5">
          <img src="${D.doctor.avatar}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.25);" onerror="this.style.display='none'">
          <div>
            <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">${greeting}, ${D.doctor.prefix} ${D.doctor.lastName} 👋</div>
            <div style="font-size:13px;opacity:0.7;margin-top:3px;">${D.doctor.specialty} — ${D.doctor.department}</div>
            <div class="flex items-center gap-3 mt-2">
              <div class="live-dot"></div>
              <span style="font-size:12px;opacity:0.8;">On duty: ${D.doctor.shift}</span>
              <span style="font-size:12px;opacity:0.6;">•</span>
              <span style="font-size:12px;opacity:0.8;">${dateStr}</span>
              <span style="font-size:12px;opacity:0.6;">•</span>
              <span style="font-size:12px;font-weight:700;">${timeStr}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-3 flex-wrap">
          <button class="btn btn-accent" onclick="Router.navigate('/patients/new')">➕ Admit Patient</button>
          <button class="btn" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);" onclick="Router.navigate('/consultations')">🩺 Start Consultation</button>
          <button class="btn" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);" onclick="Router.navigate('/ward-rounds')">📋 Ward Round</button>
        </div>
      </div>
    </div>

    <!-- STAT CARDS -->
    <div class="content-grid-4 stagger-children mb-6">
      ${C.statCard({icon:'👥',iconBg:'var(--primary-light)',value:D.patients.length,label:'My Patients',change:`${inpatients.length} inpatients`,changeDir:'up',page:'/patients'})}
      ${C.statCard({icon:'🛏',iconBg:'rgba(139,92,246,0.12)',value:inpatients.length,label:'Admitted Patients',change:'2 since yesterday',changeDir:'up',page:'/patients'})}
      ${C.statCard({icon:'🔴',iconBg:'var(--critical-light)',value:critical.length,label:'Critical Patients',change:`Needs immediate attention`,changeDir:'down',extraClass:'critical-card',page:'/patients'})}
      ${C.statCard({icon:'📅',iconBg:'rgba(0,180,166,0.12)',value:todayApts.length,label:"Today's Appointments",change:`${pendingLabs.length} pending labs`,changeDir:'warn',page:'/appointments'})}
    </div>

    <!-- MAIN 2-COLUMN LAYOUT -->
    <div style="display:grid;grid-template-columns:1fr 340px;gap:var(--space-5);margin-bottom:var(--space-5);">

      <!-- LEFT: WARD OVERVIEW + RECENT PATIENTS -->
      <div style="display:flex;flex-direction:column;gap:var(--space-5);">

        <!-- WARD OVERVIEW -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🏥 Ward Overview</div>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/ward-rounds')">View All Wards →</button>
          </div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-3);">
              ${D.wards.map(w => C.wardCard(w)).join('')}
            </div>
          </div>
        </div>

        <!-- RECENT PATIENTS -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">👤 Recent Patients</div>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/patients')">View All →</button>
          </div>
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Patient</th><th>Ward / Bed</th><th>Age / Sex</th><th>Primary Diagnosis</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${D.patients.slice(0,6).map(p => C.patientRow(p)).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- RIGHT COLUMN -->
      <div style="display:flex;flex-direction:column;gap:var(--space-5);">

        <!-- TODAY'S SCHEDULE -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">📅 Today's Schedule</div>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/appointments')">View All →</button>
          </div>
          <div class="card-body" style="padding-top:8px;">
            ${D.appointments.slice(0,5).map(a => C.scheduleItem(a)).join('')}
          </div>
        </div>

        <!-- ALERTS & NOTIFICATIONS -->
        <div class="card" style="border-left:3px solid var(--critical);">
          <div class="card-header" style="background:var(--critical-light);border-radius:var(--radius-lg) var(--radius-lg) 0 0;">
            <div class="card-title" style="color:var(--critical);">🔔 Alerts & Notifications
              <span class="badge badge-critical" style="margin-left:8px;">${D.alerts.length}</span>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/notifications')">View All →</button>
          </div>
          <div class="card-body" style="padding:var(--space-3);">
            ${D.alerts.map(a => C.alertItem(a)).join('')}
          </div>
        </div>

      </div>
    </div>

    <!-- BOTTOM ROW: QUICK ACTIONS + PATIENT SUMMARY + PENDING TASKS -->
    <div style="display:grid;grid-template-columns:1fr 1fr 320px;gap:var(--space-5);">

      <!-- QUICK ACTIONS -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">⚡ Quick Actions</div>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-3);">
            ${[
              {icon:'👤',label:'Find Patient',bg:'var(--primary-light)',page:'/patients'},
              {icon:'🩺',label:'Consult',bg:'rgba(0,180,166,0.12)',page:'/consultations'},
              {icon:'📋',label:'Ward Round',bg:'rgba(139,92,246,0.12)',page:'/ward-rounds'},
              {icon:'💊',label:'Prescribe',bg:'rgba(16,185,129,0.12)',page:'/prescriptions'},
              {icon:'🧪',label:'Order Lab',bg:'rgba(245,158,11,0.12)',page:'/laboratory'},
              {icon:'🩻',label:'Radiology',bg:'rgba(59,130,246,0.12)',page:'/radiology'},
              {icon:'📝',label:'Clinical Note',bg:'rgba(236,72,153,0.12)',page:'/clinical-notes'},
              {icon:'↗',label:'Referral',bg:'rgba(14,165,233,0.12)',page:'/referrals'},
            ].map(a=>`
              <div class="quick-action-card" onclick="Router.navigate('${a.page}')">
                <div class="quick-action-icon" style="background:${a.bg};">${a.icon}</div>
                <div class="quick-action-label">${a.label}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- PATIENT SUMMARY CHART -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 Patient Summary</div>
          <div style="font-size:12px;color:var(--text-muted);">Today</div>
        </div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:var(--space-6);">
            <div style="position:relative;width:130px;height:130px;flex-shrink:0;">
              <canvas id="patient-donut" width="130" height="130"></canvas>
              <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="font-size:28px;font-weight:800;line-height:1;">${D.patients.length}</div>
                <div style="font-size:10px;color:var(--text-muted);">Total</div>
              </div>
            </div>
            <div style="flex:1;">
              ${[
                {label:'Inpatients',n:inpatients.length,color:'#1A6EB5'},
                {label:'Outpatients',n:D.patients.filter(p=>p.type==='outpatient').length,color:'#00B4A6'},
                {label:'Critical',n:critical.length,color:'#E53935'},
                {label:'Under Review',n:D.patients.filter(p=>p.status==='review').length,color:'#F59E0B'},
              ].map(item=>`
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <div style="width:10px;height:10px;border-radius:50%;background:${item.color};flex-shrink:0;"></div>
                    <span style="font-size:12px;color:var(--text-secondary);">${item.label}</span>
                  </div>
                  <strong style="font-size:13px;">${item.n}</strong>
                </div>`).join('')}
            </div>
          </div>
          <div style="margin-top:var(--space-4);">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">This Week — Patients Seen</div>
            <canvas id="week-bar" height="60"></canvas>
          </div>
        </div>
      </div>

      <!-- PENDING TASKS -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 My Tasks
            <span class="badge badge-critical" style="margin-left:8px;">${D.urgentTasks().length}</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/tasks')">View All →</button>
        </div>
        <div class="card-body" style="padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2);">
          ${D.tasks.slice(0,5).map(t => C.taskCard(t)).join('')}
        </div>
      </div>

    </div>

  </div>`;

  // ── CHARTS ────────────────────────────────────────────────
  setTimeout(() => {
    // Donut chart
    const donutCtx = document.getElementById('patient-donut');
    if (donutCtx && window.Chart) {
      new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: ['Inpatients','Outpatients','Critical','Review'],
          datasets:[{ data:[inpatients.length,2,critical.length,1],
            backgroundColor:['#1A6EB5','#00B4A6','#E53935','#F59E0B'],
            borderWidth:0, hoverOffset:4 }]
        },
        options: { cutout:'72%', plugins:{ legend:{ display:false } }, animation:{ duration:800 } }
      });
    }

    // Weekly bar chart
    const barCtx = document.getElementById('week-bar');
    if (barCtx && window.Chart) {
      new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: D.analytics.weekLabels,
          datasets:[{ data:D.analytics.weeklyPatients,
            backgroundColor:'rgba(26,110,181,0.15)',
            borderColor:'#1A6EB5', borderWidth:1.5, borderRadius:4 }]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ display:false } },
          scales:{
            y:{ display:false, beginAtZero:true },
            x:{ grid:{ display:false }, ticks:{ font:{ size:10 } } }
          }
        }
      });
    }
  }, 100);
};
