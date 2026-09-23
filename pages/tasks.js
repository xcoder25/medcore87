/* ============================================================
   TASKS PAGE
   ============================================================ */
Pages.tasks = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  root.innerHTML = `
  <div class="page-enter">
    ${C.pageHeader('📋 Clinical Tasks','Personal task list and action items',`
      <button class="btn btn-primary" onclick="Pages.showNewTaskModal()">➕ New Task</button>
    `)}

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-5);">
      <!-- URGENT -->
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-3);">
          <div style="width:12px;height:12px;border-radius:50%;background:var(--critical);"></div>
          <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">🔴 Urgent</h3>
          <span class="badge badge-critical">${D.tasks.filter(t=>t.priority==='urgent'&&!t.done).length}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);" id="urgent-col">
          ${D.tasks.filter(t=>t.priority==='urgent'&&!t.done).map(t=>renderTaskCard(t)).join('')
            ||`<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">No urgent tasks ✅</div>`}
        </div>
      </div>

      <!-- PENDING -->
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-3);">
          <div style="width:12px;height:12px;border-radius:50%;background:var(--warning);"></div>
          <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">🟠 Pending</h3>
          <span class="badge badge-warning">${D.tasks.filter(t=>t.priority==='pending'&&!t.done).length}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);" id="pending-col">
          ${D.tasks.filter(t=>t.priority==='pending'&&!t.done).map(t=>renderTaskCard(t)).join('')
            ||`<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">No pending tasks</div>`}
        </div>
      </div>

      <!-- DONE -->
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-3);">
          <div style="width:12px;height:12px;border-radius:50%;background:var(--success);"></div>
          <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">🟢 Completed</h3>
          <span class="badge badge-success">${D.tasks.filter(t=>t.done).length}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);" id="done-col">
          ${D.tasks.filter(t=>t.done).map(t=>renderTaskCard(t)).join('')
            ||`<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">No completed tasks</div>`}
        </div>
      </div>
    </div>
  </div>`;

  function renderTaskCard(t) {
    const colors = {urgent:'var(--critical)',pending:'var(--warning)',done:'var(--success)'};
    const catIcons = {review:'👁',lab:'🧪',document:'📄',radiology:'🩻',ward:'🏥',prescription:'💊'};
    return `
    <div class="task-card ${t.priority}" style="border-left-color:${colors[t.priority]};opacity:${t.done?0.65:1};">
      <div class="flex items-start justify-between gap-2">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;margin-bottom:4px;">${catIcons[t.category]||'📋'} ${t.title}</div>
          <div style="font-size:11px;color:var(--text-muted);">
            ${t.patientName?`👤 ${t.patientName} • `:''}⏰ ${t.due}
          </div>
        </div>
        <div class="flex flex-col gap-1 items-end">
          ${!t.done ? `<button class="btn btn-success btn-sm" style="font-size:10px;" onclick="Pages.completeTask('${t.id}')">✓</button>` : ''}
          ${t.patient ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;" onclick="Router.navigate('/emr/${t.patient}')">📋</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  Pages.completeTask = function(id) {
    const t = D.tasks.find(x=>x.id===id);
    if (t) { t.done=true; t.priority='done'; }
    Pages.tasks();
  };

  Pages.showNewTaskModal = function() {
    C.showModal('new-task-modal','📋 New Task',`
      <div class="form-group">
        <label class="form-label">Task Description <span class="required">*</span></label>
        <input class="form-control" placeholder="e.g. Review lab result for patient...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Priority <span class="required">*</span></label>
          <select class="form-control"><option>Urgent</option><option>Pending</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-control"><option>Review</option><option>Lab</option><option>Radiology</option><option>Document</option><option>Prescription</option><option>Ward</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Patient</label>
          <select class="form-control">
            <option value="">None</option>
            ${D.patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Due Time / Date</label>
          <input class="form-control" placeholder="e.g. Now, Today, 14:00...">
        </div>
      </div>
    `,`
      <button class="btn btn-ghost" onclick="document.getElementById('new-task-modal').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="alert('Task added (demo)');document.getElementById('new-task-modal').remove();">✅ Add Task</button>
    `,'modal-sm');
  };
};

/* ============================================================
   MESSAGES PAGE
   ============================================================ */
Pages.messages = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  let selectedMsg = D.messages[0];

  function render() {
    root.innerHTML = `
    <div class="page-enter">
      ${C.pageHeader('💬 Clinical Messages','Secure clinical communication',`
        <button class="btn btn-primary" onclick="Pages.showNewMessageModal()">✏ New Message</button>
      `)}

      <div style="display:grid;grid-template-columns:300px 1fr;gap:var(--space-5);height:calc(100vh - 200px);">

        <!-- Left: Contact list -->
        <div class="card" style="display:flex;flex-direction:column;overflow:hidden;">
          <div class="card-header">
            <div class="card-title">📬 Inbox
              <span class="badge badge-critical" style="margin-left:8px;">${D.unreadCount(D.messages)}</span>
            </div>
          </div>
          <div style="padding:10px;">
            <div class="search-input-wrap">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Search messages...">
            </div>
          </div>
          <div style="flex:1;overflow-y:auto;">
            ${D.messages.map(m=>`
              <div class="message-item ${m.unread?'unread':''} ${m.id===selectedMsg.id?'selected':''}"
                   onclick="Pages.selectMessage('${m.id}')"
                   style="${m.id===selectedMsg.id?'background:var(--primary-light);':''};border-left:3px solid ${m.id===selectedMsg.id?'var(--primary)':'transparent'};">
                <div class="message-avatar" style="font-size:14px;">${m.from.charAt(0)}</div>
                <div class="message-body">
                  <div class="flex justify-between items-center">
                    <div class="message-name" style="${m.unread?'font-weight:700;':'font-weight:500;'}">${m.from}</div>
                    <div class="message-time">${m.time}</div>
                  </div>
                  <div class="message-preview">${m.thread[0].text}</div>
                </div>
                ${m.unread?`<div style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;"></div>`:''}
              </div>`).join('')}
          </div>
        </div>

        <!-- Right: Chat view -->
        <div class="card" style="display:flex;flex-direction:column;overflow:hidden;">
          <div class="card-header" style="border-bottom:1px solid var(--border);">
            <div class="flex items-center gap-3">
              <div class="message-avatar">${selectedMsg.from.charAt(0)}</div>
              <div>
                <div style="font-size:14px;font-weight:700;">${selectedMsg.from}</div>
                <div style="font-size:11px;color:var(--text-muted);">${selectedMsg.dept} • ${selectedMsg.role}</div>
              </div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm">📎 Attach</button>
              <button class="btn btn-ghost btn-sm">📋 Patient Record</button>
            </div>
          </div>

          <!-- Thread -->
          <div style="flex:1;overflow-y:auto;padding:var(--space-5);display:flex;flex-direction:column;gap:var(--space-4);">
            ${selectedMsg.thread.map(msg=>`
              <div style="display:flex;justify-content:${msg.sender==='me'?'flex-end':'flex-start'};">
                <div style="max-width:70%;padding:12px 16px;border-radius:${msg.sender==='me'?'18px 18px 4px 18px':'18px 18px 18px 4px'};background:${msg.sender==='me'?'var(--primary)':'var(--surface)'};color:${msg.sender==='me'?'white':'var(--text-primary)'};font-size:13px;line-height:1.5;box-shadow:var(--shadow-sm);">
                  ${msg.text}
                  <div style="font-size:10px;opacity:0.6;margin-top:4px;text-align:right;">${msg.time}</div>
                </div>
              </div>`).join('')}
          </div>

          <!-- Compose -->
          <div style="padding:var(--space-4);border-top:1px solid var(--border);background:var(--surface);">
            <div style="display:flex;gap:var(--space-3);align-items:flex-end;">
              <textarea id="msg-compose" class="form-control" rows="2" style="flex:1;" placeholder="Type a clinical message..." onkeydown="if(event.ctrlKey&&event.key==='Enter'){Pages.sendMessage()}"></textarea>
              <div class="flex flex-col gap-2">
                <button class="btn btn-ghost btn-sm">📎</button>
                <button class="btn btn-primary" onclick="Pages.sendMessage()">Send ↑</button>
              </div>
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:6px;">Clinical messages are logged for audit purposes • Ctrl+Enter to send</div>
          </div>
        </div>

      </div>
    </div>`;
  }

  Pages.selectMessage = function(id) {
    selectedMsg = D.messages.find(m=>m.id===id);
    if (selectedMsg) selectedMsg.unread = false;
    render();
  };

  Pages.sendMessage = function() {
    const txt = document.getElementById('msg-compose')?.value;
    if (!txt?.trim()) return;
    selectedMsg.thread.push({ sender:'me', text:txt, time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) });
    render();
  };

  Pages.showNewMessageModal = function() {
    C.showModal('new-msg-modal','✏ New Clinical Message',`
      <div class="form-group">
        <label class="form-label">To <span class="required">*</span></label>
        <select class="form-control">
          <option>Nurse Station — FMW</option><option>Nurse Station — ICU</option><option>Dr. Emeka Nwosu (Cardiology)</option>
          <option>Pharmacy Department</option><option>Laboratory</option><option>Radiology</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Related Patient</label>
        <select class="form-control"><option>None</option>${D.patients.map(p=>`<option>${p.name}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Message <span class="required">*</span></label>
        <textarea class="form-control" rows="4" placeholder="Type your clinical message..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Priority</label>
        <select class="form-control"><option>Routine</option><option>Urgent</option><option>Critical</option></select>
      </div>
    `,`
      <button class="btn btn-ghost" onclick="document.getElementById('new-msg-modal').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="alert('Message sent (demo)');document.getElementById('new-msg-modal').remove();">📤 Send Message</button>
    `);
  };

  render();
};

/* ============================================================
   REPORTS / ANALYTICS PAGE
   ============================================================ */
Pages.reports = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  root.innerHTML = `
  <div class="page-enter">
    ${C.pageHeader('📊 Clinical Analytics','Personal and department performance insights')}

    <!-- TODAY STATS -->
    <div class="content-grid-4 mb-5 stagger-children">
      ${[
        {icon:'👥',val:D.analytics.today.patientsSeen,lbl:"Patients Seen Today",color:'var(--primary)'},
        {icon:'🏥',val:D.analytics.today.admissions,lbl:"Admissions",color:'var(--accent)'},
        {icon:'🚪',val:D.analytics.today.discharges,lbl:"Discharges",color:'var(--success)'},
        {icon:'🧪',val:D.analytics.today.pendingInvestigations,lbl:"Pending Investigations",color:'var(--warning)'},
      ].map(s=>C.statCard({icon:s.icon,iconBg:s.color+'20',value:s.val,label:s.lbl,page:'/reports'})).join('')}
    </div>

    <div class="content-grid-2 mb-5">
      <!-- Weekly Patient Volume -->
      <div class="card">
        <div class="card-header"><div class="card-title">📈 Weekly Patient Volume</div></div>
        <div class="card-body"><div style="height:220px;"><canvas id="weekly-chart"></canvas></div></div>
      </div>

      <!-- Diagnosis Distribution -->
      <div class="card">
        <div class="card-header"><div class="card-title">🏷 Diagnosis Distribution</div></div>
        <div class="card-body">
          <div style="height:220px;display:flex;gap:var(--space-5);align-items:center;">
            <canvas id="dx-chart" style="max-width:180px;max-height:180px;"></canvas>
            <div style="flex:1;">
              ${D.analytics.diagnosisDistribution.map((d,i)=>{
                const colors=['#1A6EB5','#00B4A6','#8B5CF6','#F59E0B','#94A3B8'];
                return `<div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <div style="width:10px;height:10px;border-radius:50%;background:${colors[i]};"></div>
                    <span style="font-size:12px;color:var(--text-secondary);">${d.dx}</span>
                  </div>
                  <strong style="font-size:13px;">${d.n}</strong>
                </div>`;}).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AUDIT TRAIL -->
    <div class="card">
      <div class="card-header"><div class="card-title">🔐 Recent Clinical Activity — Audit Trail</div></div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>Timestamp</th><th>Doctor</th><th>Action</th><th>Patient</th><th>Record</th></tr></thead>
          <tbody>
            ${[
              {time:'18 Sep 2026 — 08:30',doc:'Dr. Adewale Bello',action:'Progress Note Signed',patient:'Mrs. Amaka Okafor',record:'CN-001'},
              {time:'18 Sep 2026 — 07:45',doc:'Dr. Adewale Bello',action:'Ward Round Note Signed',patient:'Chief Emmanuel Okoro',record:'CN-003'},
              {time:'17 Sep 2026 — 16:20',doc:'Dr. Adewale Bello',action:'Prescription Signed',patient:'Mrs. Amaka Okafor',record:'RX-001'},
              {time:'17 Sep 2026 — 14:15',doc:'Dr. Adewale Bello',action:'Referral Sent to Cardiology',patient:'Chief Emmanuel Okoro',record:'REF-001'},
              {time:'16 Sep 2026 — 14:15',doc:'Dr. Adewale Bello',action:'Admission Note Signed',patient:'Mr. Tunde Yusuf',record:'CN-002'},
            ].map(r=>`
              <tr>
                <td style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${r.time}</td>
                <td style="font-size:13px;font-weight:600;">${r.doc}</td>
                <td><span class="badge badge-primary">${r.action}</span></td>
                <td style="font-size:13px;">${r.patient}</td>
                <td><span style="font-size:11px;color:var(--primary);font-family:monospace;">${r.record}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;

  setTimeout(() => {
    const wCtx = document.getElementById('weekly-chart');
    if (wCtx && window.Chart) {
      new Chart(wCtx, {
        type:'bar',
        data:{
          labels:D.analytics.weekLabels,
          datasets:[{
            label:'Patients', data:D.analytics.weeklyPatients,
            backgroundColor:D.analytics.weeklyPatients.map((_,i)=>i===6?'#1A6EB5':'rgba(26,110,181,0.3)'),
            borderRadius:6, borderSkipped:false,
          }]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#E2E8F0'}},x:{grid:{display:false}}}}
      });
    }

    const dxCtx = document.getElementById('dx-chart');
    if (dxCtx && window.Chart) {
      new Chart(dxCtx, {
        type:'doughnut',
        data:{
          labels:D.analytics.diagnosisDistribution.map(d=>d.dx),
          datasets:[{data:D.analytics.diagnosisDistribution.map(d=>d.n),
            backgroundColor:['#1A6EB5','#00B4A6','#8B5CF6','#F59E0B','#94A3B8'],borderWidth:0}]
        },
        options:{cutout:'60%',plugins:{legend:{display:false}}}
      });
    }
  }, 100);
};

/* ============================================================
   NOTIFICATIONS PAGE
   ============================================================ */
Pages.notifications = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  root.innerHTML = `
  <div class="page-enter">
    ${C.pageHeader('🔔 Notifications',`${D.notifications.filter(n=>!n.read).length} unread notifications`,`
      <button class="btn btn-ghost" onclick="D.notifications.forEach(n=>n.read=true);Pages.notifications();">Mark All Read</button>
    `)}

    <div class="content-cols-main">
      <div style="display:flex;flex-direction:column;gap:var(--space-3);">
        ${['critical','warning','info'].map(type=>{
          const list = D.notifications.filter(n=>n.type===type);
          if (!list.length) return '';
          const typeLabel = {critical:'🔴 Critical',warning:'🟠 Clinical',info:'🔵 Information'}[type];
          const typeColor = {critical:'var(--critical)',warning:'var(--warning)',info:'var(--info)'}[type];
          return `
          <div>
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${typeColor};margin-bottom:var(--space-2);">${typeLabel}</div>
            ${list.map(n=>`
              <div class="card" style="margin-bottom:8px;opacity:${n.read?0.7:1};border-left:3px solid ${typeColor};" onclick="Pages.readNotif('${n.id}');Router.navigate('/patients')">
                <div style="padding:var(--space-4);display:flex;align-items:center;gap:var(--space-4);cursor:pointer;">
                  <span style="font-size:24px;">${n.icon}</span>
                  <div style="flex:1;">
                    <div style="font-size:13px;font-weight:${n.read?'500':'700'};">${n.title}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${n.desc}</div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">${n.time}</div>
                  </div>
                  ${!n.read?`<div style="width:10px;height:10px;border-radius:50%;background:${typeColor};flex-shrink:0;"></div>`:''}
                </div>
              </div>`).join('')}
          </div>`;}).join('')}
      </div>

      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="card">
          <div class="card-header"><div class="card-title">🔔 Notification Preferences</div></div>
          <div class="card-body">
            ${[
              {label:'Critical Lab Results', enabled:true},
              {label:'Patient Deterioration', enabled:true},
              {label:'New Referrals', enabled:true},
              {label:'Appointment Reminders', enabled:true},
              {label:'Lab Results (Routine)', enabled:false},
              {label:'New Messages', enabled:true},
            ].map(p=>`
              <div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid var(--border);">
                <span style="font-size:13px;">${p.label}</span>
                <label style="position:relative;display:inline-block;width:40px;height:22px;cursor:pointer;">
                  <input type="checkbox" ${p.enabled?'checked':''} style="opacity:0;width:0;height:0;position:absolute;">
                  <span onclick="this.parentElement.querySelector('input').click();this.style.background=this.parentElement.querySelector('input').checked?'var(--primary)':'var(--border)'" style="position:absolute;inset:0;background:${p.enabled?'var(--primary)':'var(--border)'};border-radius:22px;transition:0.2s;"></span>
                  <span style="position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:white;border-radius:50%;transition:0.2s;${p.enabled?'transform:translateX(18px)':''}"></span>
                </label>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;

  Pages.readNotif = function(id) {
    const n = D.notifications.find(x=>x.id===id);
    if (n) n.read=true;
  };
};

/* ============================================================
   SETTINGS PAGE
   ============================================================ */
Pages.settings = function() {
  const D = window.HOS_DATA;
  const C = window.Components;
  const root = document.getElementById('page-root');

  root.innerHTML = `
  <div class="page-enter">
    ${C.pageHeader('⚙ Settings','Account, preferences, and security')}

    <div class="content-cols-sidebar">
      <!-- LEFT: Settings Nav -->
      <div class="card" style="padding:var(--space-3);">
        ${[
          {id:'profile',icon:'👤',label:'Doctor Profile'},
          {id:'notifs',icon:'🔔',label:'Notifications'},
          {id:'templates',icon:'📋',label:'Note Templates'},
          {id:'security',icon:'🔐',label:'Security & Audit'},
          {id:'display',icon:'🎨',label:'Display Preferences'},
        ].map((item,i)=>`
          <button class="nav-item ${i===0?'active':''}" onclick="Pages.switchSettingTab('${item.id}',this)" style="width:100%;border-radius:var(--radius-md);margin-bottom:4px;">
            <span class="nav-item-icon">${item.icon}</span>
            <span class="nav-item-label">${item.label}</span>
          </button>`).join('')}
      </div>

      <!-- RIGHT: Content -->
      <div>
        <!-- Profile -->
        <div id="settings-profile" class="card">
          <div class="card-header"><div class="card-title">👤 Doctor Profile</div></div>
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:var(--space-6);margin-bottom:var(--space-5);">
              <div style="position:relative;">
                <img src="${D.doctor.avatar}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid var(--primary);" onerror="this.style.display='none'">
                <button class="btn btn-primary btn-sm" style="position:absolute;bottom:0;right:0;width:28px;height:28px;padding:0;border-radius:50%;">✏</button>
              </div>
              <div>
                <div style="font-size:18px;font-weight:700;">${D.doctor.name}</div>
                <div style="font-size:13px;color:var(--text-muted);">${D.doctor.specialty} • ${D.doctor.department}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${D.doctor.id}</div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">First Name</label>
                <input class="form-control" value="${D.doctor.firstName}">
              </div>
              <div class="form-group">
                <label class="form-label">Last Name</label>
                <input class="form-control" value="${D.doctor.lastName}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Specialty</label>
                <input class="form-control" value="${D.doctor.specialty}">
              </div>
              <div class="form-group">
                <label class="form-label">Department</label>
                <input class="form-control" value="${D.doctor.department}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Phone</label>
                <input class="form-control" value="${D.doctor.phone}">
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-control" type="email" value="${D.doctor.email}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">MDCN License No.</label>
                <input class="form-control" value="${D.doctor.license}">
              </div>
              <div class="form-group">
                <label class="form-label">Working Hours</label>
                <input class="form-control" value="${D.doctor.shift}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Digital Signature</label>
              <div style="border:2px dashed var(--border);border-radius:var(--radius-md);padding:var(--space-5);text-align:center;cursor:pointer;" onclick="alert('Upload signature (demo)')">
                <div style="font-size:24px;font-style:italic;font-weight:700;color:var(--primary);font-family:serif;">Dr. Adewale Bello</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Click to upload signature image</div>
              </div>
            </div>
            <div class="flex justify-end gap-3 mt-4">
              <button class="btn btn-ghost">Discard</button>
              <button class="btn btn-primary" onclick="alert('Profile saved (demo)')">💾 Save Changes</button>
            </div>
          </div>
        </div>

        <div id="settings-notifs" class="card hidden">
          <div class="card-header"><div class="card-title">🔔 Notification Preferences</div></div>
          <div class="card-body">
            ${[
              {g:'Clinical Alerts',items:['Critical Lab Results','Patient Deterioration Alerts','Missed Medication Alerts','Critical Vital Signs']},
              {g:'Communication',items:['New Clinical Messages','New Referrals Received','Consultation Requests']},
              {g:'Administrative',items:['Appointment Reminders','Discharge Pending','Lab Results (Routine)']},
            ].map(g=>`
              <div style="margin-bottom:var(--space-5);">
                <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:var(--space-3);">${g.g}</div>
                ${g.items.map(item=>`
                  <div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid var(--border);">
                    <span style="font-size:13px;">${item}</span>
                    <input type="checkbox" checked style="accent-color:var(--primary);width:16px;height:16px;cursor:pointer;">
                  </div>`).join('')}
              </div>`).join('')}
          </div>
        </div>

        <div id="settings-security" class="card hidden">
          <div class="card-header"><div class="card-title">🔐 Security</div></div>
          <div class="card-body">
            <div class="alert alert-info mb-4"><span class="alert-icon">ℹ</span><div>All clinical actions are logged and auditable per hospital policy.</div></div>
            <div class="form-group">
              <label class="form-label">Change Password</label>
              <input class="form-control" type="password" placeholder="Current password">
              <input class="form-control" type="password" placeholder="New password" style="margin-top:8px;">
              <input class="form-control" type="password" placeholder="Confirm new password" style="margin-top:8px;">
            </div>
            <div class="flex items-center justify-between mb-4" style="padding:12px;background:var(--surface);border-radius:var(--radius-md);">
              <div>
                <div style="font-size:13px;font-weight:600;">Multi-Factor Authentication (MFA)</div>
                <div style="font-size:11px;color:var(--text-muted);">Adds extra security to your login</div>
              </div>
              <span class="badge badge-success">Enabled</span>
            </div>
            <div style="padding:12px;background:var(--surface);border-radius:var(--radius-md);">
              <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">SESSION TIMEOUT</div>
              <select class="form-control"><option>15 minutes</option><option>30 minutes</option><option>1 hour</option></select>
            </div>
          </div>
        </div>

        <div id="settings-templates" class="card hidden">
          <div class="card-header"><div class="card-title">📋 Default Note Templates</div><button class="btn btn-primary btn-sm">+ New Template</button></div>
          <div class="card-body">${C.emptyState('📝','Coming Soon','Custom note templates will be available in the next release.')}</div>
        </div>

        <div id="settings-display" class="card hidden">
          <div class="card-header"><div class="card-title">🎨 Display Preferences</div></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Default Landing Page</label>
              <select class="form-control"><option>Dashboard</option><option>Ward Rounds</option><option>My Patients</option><option>Appointments</option></select>
            </div>
            <div class="form-group">
              <label class="form-label">Date Format</label>
              <select class="form-control"><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select>
            </div>
            <div class="form-group">
              <label class="form-label">Language</label>
              <select class="form-control"><option>English</option><option>Hausa</option><option>Yoruba</option><option>Igbo</option></select>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  Pages.switchSettingTab = function(id, btn) {
    document.querySelectorAll('#settings-profile,#settings-notifs,#settings-security,#settings-templates,#settings-display').forEach(el=>el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
    document.getElementById('settings-'+id).classList.remove('hidden');
    btn.classList.add('active');
  };
};
