/* ============================================================
   HOSPITAL OS — SHARED COMPONENTS
   Reusable render helpers used across all pages
   ============================================================ */
window.Components = (() => {
  const D = window.HOS_DATA;

  // ── AVATAR ────────────────────────────────────────────────
  function avatar(patient, size = 34) {
    const s = `width:${size}px;height:${size}px;font-size:${Math.round(size*0.35)}px;`;
    return `<div class="patient-avatar-initials" style="${s}background:${patient._color};">${patient._initials}</div>`;
  }

  // ── STATUS BADGE ──────────────────────────────────────────
  const STATUS_MAP = {
    stable:      { cls:'status-stable',     label:'Stable',      dot:'#10B981' },
    critical:    { cls:'status-critical',   label:'Critical',    dot:'#E53935' },
    review:      { cls:'status-review',     label:'Under Review',dot:'#3B82F6' },
    waiting:     { cls:'status-waiting',    label:'Waiting',     dot:'#F59E0B' },
    'in-progress':{ cls:'status-inprogress',label:'In Progress', dot:'#1A6EB5' },
    completed:   { cls:'status-completed',  label:'Completed',   dot:'#10B981' },
    'post-op':   { cls:'status-discharge',  label:'Post-Op',     dot:'#00B4A6' },
    discharge:   { cls:'status-discharge',  label:'Discharge',   dot:'#00B4A6' },
    upcoming:    { cls:'status-neutral',    label:'Upcoming',    dot:'#94A3B8' },
    'no-show':   { cls:'status-noshow',     label:'No Show',     dot:'#94A3B8' },
    pending:     { cls:'status-warning',    label:'Pending',     dot:'#F59E0B' },
    accepted:    { cls:'status-stable',     label:'Accepted',    dot:'#10B981' },
    emergency:   { cls:'status-critical',   label:'Emergency',   dot:'#E53935' },
    reported:    { cls:'status-completed',  label:'Reported',    dot:'#10B981' },
    available:   { cls:'status-stable',     label:'Available',   dot:'#10B981' },
    'no-show':   { cls:'status-noshow',     label:'No Show',     dot:'#94A3B8' },
  };

  function statusBadge(status) {
    const s = STATUS_MAP[status] || { cls:'status-neutral', label: status, dot:'#94A3B8' };
    return `<span class="status-badge ${s.cls}">
      <span style="width:6px;height:6px;border-radius:50%;background:${s.dot};display:inline-block;"></span>
      ${s.label}
    </span>`;
  }

  // ── FLAG BADGE ────────────────────────────────────────────
  function labFlag(flag) {
    const cls = { normal:'lab-flag normal', high:'lab-flag high', low:'lab-flag low', critical:'lab-flag critical' };
    const lbl = { normal:'Normal', high:'High', low:'Low', critical:'CRITICAL' };
    return `<span class="${cls[flag]||'lab-flag normal'}">${lbl[flag]||flag}</span>`;
  }

  // ── STAT CARD ─────────────────────────────────────────────
  function statCard({ icon, iconBg, value, label, change, changeDir, extraClass, page }) {
    return `
    <div class="stat-card ${extraClass||''}" onclick="Router.navigate('${page||'#/dashboard'}')">
      <div class="stat-card-icon" style="background:${iconBg||'var(--primary-light)'};">${icon}</div>
      <div class="stat-card-value">${value}</div>
      <div class="stat-card-label">${label}</div>
      ${change ? `<div class="stat-card-change ${changeDir||'up'}">
        ${changeDir==='up'?'↑':changeDir==='down'?'↓':'⚠'} ${change}
      </div>` : ''}
    </div>`;
  }

  // ── PATIENT ROW ───────────────────────────────────────────
  function patientRow(p, showWard = true) {
    return `
    <tr onclick="Router.navigate('/patients/${p.id}')" style="cursor:pointer;">
      <td>
        <div class="patient-row-avatar">
          ${avatar(p, 34)}
          <div>
            <div class="patient-name">${p.name}</div>
            <div class="patient-mrn">${p.mrn}</div>
          </div>
        </div>
      </td>
      ${showWard ? `<td><span class="badge badge-primary">${p.ward}</span>${p.bed !== '—' ? ` Bed ${p.bed}` : ''}</td>` : ''}
      <td class="text-secondary">${p.age}${p.age===0?'d':'y'} / ${p.sex}</td>
      <td class="text-secondary" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.diagnoses[0]}</td>
      <td>${statusBadge(p.status)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();Router.navigate('/emr/${p.id}')">📋 View</button>
      </td>
    </tr>`;
  }

  // ── VITAL ITEM ────────────────────────────────────────────
  function vitalItem({ label, value, unit, status }) {
    return `
    <div class="vital-item">
      <div class="vital-label">${label}</div>
      <div class="vital-value" style="color:${status==='abnormal'?'var(--critical)':status==='border-line'?'var(--warning)':'var(--text-primary)'}">${value}</div>
      <div class="vital-unit">${unit}</div>
      ${status ? `<div class="vital-status ${status}">${status==='normal'?'Normal':status==='abnormal'?'Abnormal':'Borderline'}</div>` : ''}
    </div>`;
  }

  // ── VITALS GRID FROM PATIENT ──────────────────────────────
  function vitalsGrid(v) {
    function bpStatus(bp) {
      const [s,d] = (bp||'').split('/').map(Number);
      if(s>140||d>90) return 'abnormal'; if(s>120||d>80) return 'border-line'; return 'normal';
    }
    function spo2Status(v) { if(v<90) return 'abnormal'; if(v<95) return 'border-line'; return 'normal'; }
    function hrStatus(v) { if(v>100||v<60) return 'abnormal'; return 'normal'; }
    function tempStatus(v) { if(v>37.5) return 'abnormal'; if(v<36.0) return 'border-line'; return 'normal'; }

    return `<div class="vitals-grid">
      ${vitalItem({label:'Blood Pressure', value:v.bp, unit:'mmHg', status:bpStatus(v.bp)})}
      ${vitalItem({label:'Heart Rate', value:v.pulse, unit:'bpm', status:hrStatus(v.pulse)})}
      ${vitalItem({label:'Temperature', value:v.temp, unit:'°C', status:tempStatus(v.temp)})}
      ${vitalItem({label:'SpO₂', value:v.spo2+'%', unit:'Oxygen Sat.', status:spo2Status(v.spo2)})}
      ${vitalItem({label:'Resp. Rate', value:v.rr, unit:'breaths/min', status:v.rr>20?'border-line':'normal'})}
      ${vitalItem({label:'Weight', value:v.weight, unit:'kg', status:'normal'})}
    </div>`;
  }

  // ── ALERT ITEM ────────────────────────────────────────────
  function alertItem(a) {
    return `
    <div class="alert-item" onclick="Router.navigate('/patients/${a.patient||''}')">
      <div class="alert-item-dot ${a.level}"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.title}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${a.desc}</div>
      </div>
      <div style="font-size:10px;color:var(--text-muted);white-space:nowrap;">${a.time}</div>
    </div>`;
  }

  // ── SCHEDULE ITEM ─────────────────────────────────────────
  const DOT_COLORS = {
    waiting:'var(--warning)', 'in-progress':'var(--primary)',
    completed:'var(--success)', upcoming:'var(--border-dark)'
  };

  function scheduleItem(apt) {
    const dot = DOT_COLORS[apt.status] || 'var(--border-dark)';
    return `
    <div class="schedule-item" onclick="Router.navigate('/appointments')">
      <div class="schedule-time">${apt.time}</div>
      <div class="schedule-dot" style="background:${dot};"></div>
      <div class="schedule-info">
        <div class="schedule-patient">${apt.name}</div>
        <div class="schedule-type">${apt.type}</div>
      </div>
      ${statusBadge(apt.status)}
    </div>`;
  }

  // ── WARD CARD ─────────────────────────────────────────────
  const WARD_STATUS_COLORS = {
    normal:'var(--success)', high:'var(--warning)', surge:'var(--critical)', critical:'var(--critical)'
  };

  const WARD_BADGE = {
    normal: 'badge-success', high: 'badge-warning', surge: 'badge-critical', critical: 'badge-critical'
  };

  function wardCard(w) {
    const pct = Math.round((w.occupancy / w.capacity) * 100);
    const color = WARD_STATUS_COLORS[w.status] || 'var(--success)';
    const progressClass = w.status === 'critical' || w.status === 'surge' ? 'critical' : w.status === 'high' ? 'warning' : 'success';
    return `
    <div class="ward-card" onclick="Router.navigate('/ward-rounds?ward=${w.code}')">
      <div class="flex items-center justify-between mb-2">
        <div class="ward-card-name">${w.code}</div>
        <span class="badge ${WARD_BADGE[w.status]||'badge-neutral'}" style="font-size:9px;">${w.status.toUpperCase()}</span>
      </div>
      <div class="ward-occupancy"><strong>${w.occupancy}</strong> / ${w.capacity} beds</div>
      <div class="progress-bar" style="margin-bottom:8px;">
        <div class="progress-fill ${progressClass}" style="width:${pct}%;"></div>
      </div>
      <div class="ward-meta">
        <span>👨‍⚕️ ${w.doctors} Docs</span>
        <span>👩‍⚕️ ${w.nurses} Nurses</span>
      </div>
    </div>`;
  }

  // ── LAB RESULT ROW ────────────────────────────────────────
  function labResultCard(lr) {
    const hasCritical = lr.tests.some(t => t.flag === 'critical');
    return `
    <div class="lab-result-card ${hasCritical ? 'pulse-critical' : ''}" style="margin-bottom:12px;border:1px solid ${hasCritical ? 'rgba(229,57,53,0.4)' : 'var(--border)'};">
      <div class="lab-result-header">
        <div>
          <div style="font-size:13px;font-weight:700;">${lr.patient}</div>
          <div style="font-size:11px;color:var(--text-muted);">${lr.study || lr.tests.map(t=>t.name).join(', ')} • ${lr.resultDate || lr.orderedDate}</div>
        </div>
        <div class="flex gap-2 items-center">
          ${hasCritical ? `<span class="badge badge-critical">CRITICAL</span>` : ''}
          ${statusBadge(lr.status)}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">
        ${lr.tests.map(t => `
          <div style="background:${t.flag==='critical'?'#FEECEC':t.flag==='high'?'#FEF3C7':'var(--surface)'};border-radius:6px;padding:8px;border:1px solid ${t.flag==='critical'?'rgba(229,57,53,0.3)':t.flag==='high'?'rgba(245,158,11,0.3)':'var(--border)'};">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:3px;">${t.name}</div>
            <div style="font-size:16px;font-weight:800;color:${t.flag==='critical'?'var(--critical)':t.flag==='high'?'var(--warning)':t.flag==='low'?'var(--info)':'var(--text-primary)'};">${t.result} <span style="font-size:11px;font-weight:400;color:var(--text-muted);">${t.unit}</span></div>
            <div style="font-size:10px;color:var(--text-muted);">Ref: ${t.refMin}–${t.refMax}</div>
            ${labFlag(t.flag)}
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  // ── TASK CARD ─────────────────────────────────────────────
  function taskCard(t) {
    const colors = { urgent:'var(--critical)', pending:'var(--warning)', done:'var(--success)' };
    const icons  = { review:'👁', lab:'🧪', document:'📄', radiology:'🩻', ward:'🏥', prescription:'💊' };
    return `
    <div class="task-card ${t.priority}" onclick="Router.navigate('/tasks')">
      <div class="flex items-center justify-between mb-1">
        <div class="task-title">${icons[t.category]||'📋'} ${t.title}</div>
        ${t.done ? `<span class="badge badge-success">Done</span>` : `<span class="badge" style="background:${colors[t.priority]}20;color:${colors[t.priority]};">${t.priority.toUpperCase()}</span>`}
      </div>
      <div class="task-meta">${t.patientName ? `👤 ${t.patientName} • ` : ''}⏰ ${t.due}</div>
    </div>`;
  }

  // ── DRUG ROW (prescription list) ──────────────────────────
  function drugRow(drug) {
    return `
    <div class="drug-card">
      <div class="flex items-center justify-between">
        <div>
          <div class="drug-name">💊 ${drug.name} ${drug.dose}</div>
          <div class="drug-dose">${drug.route} • ${drug.freq} • ${drug.duration}</div>
          ${drug.instructions ? `<div class="drug-meta" style="margin-top:4px;">📝 ${drug.instructions}</div>` : ''}
        </div>
        <span class="badge badge-success">Active</span>
      </div>
    </div>`;
  }

  // ── TIMELINE ITEM ─────────────────────────────────────────
  const TL_ICONS = {
    consultation:'🩺', lab:'🧪', radiology:'🩻', medication:'💊',
    admission:'🏥', discharge:'🚪', note:'📝', referral:'↗️', procedure:'⚕️'
  };
  const TL_COLORS = {
    consultation:'var(--primary-light)', lab:'var(--info-light)', radiology:'var(--purple-light)',
    medication:'var(--success-light)', admission:'var(--warning-light)', discharge:'var(--accent-light)',
    note:'var(--surface)', referral:'var(--primary-light)', procedure:'var(--critical-light)'
  };

  function timelineItem(type, date, title, desc) {
    return `
    <div class="timeline-item">
      <div class="timeline-line"></div>
      <div class="timeline-dot" style="background:${TL_COLORS[type]||'var(--surface)'};">${TL_ICONS[type]||'📌'}</div>
      <div class="timeline-content">
        <div class="timeline-date">${date}</div>
        <div class="timeline-title">${title}</div>
        ${desc ? `<div class="timeline-desc">${desc}</div>` : ''}
      </div>
    </div>`;
  }

  // ── MODAL WRAPPER ─────────────────────────────────────────
  function showModal(id, title, bodyHTML, footerHTML, size = '') {
    let overlay = document.getElementById(id);
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${size}">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" onclick="document.getElementById('${id}').remove()">✕</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
      </div>`;
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  // ── PAGE HEADER ───────────────────────────────────────────
  function pageHeader(title, subtitle, actions = '') {
    return `
    <div class="page-header page-enter">
      <div>
        <h1 class="page-title">${title}</h1>
        ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}
      </div>
      ${actions ? `<div class="flex gap-3 items-center">${actions}</div>` : ''}
    </div>`;
  }

  // ── SECTION CARD ──────────────────────────────────────────
  function sectionCard(title, bodyHTML, actionsHTML = '', icon = '') {
    return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${icon} ${title}</div>
        ${actionsHTML ? `<div class="flex gap-2 items-center">${actionsHTML}</div>` : ''}
      </div>
      <div class="card-body">${bodyHTML}</div>
    </div>`;
  }

  // ── EMPTY STATE ───────────────────────────────────────────
  function emptyState(icon, title, desc) {
    return `<div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-title">${title}</div>
      <div class="empty-state-desc">${desc}</div>
    </div>`;
  }

  return {
    avatar, statusBadge, labFlag, statCard,
    patientRow, vitalItem, vitalsGrid,
    alertItem, scheduleItem, wardCard,
    labResultCard, taskCard, drugRow,
    timelineItem, showModal, pageHeader,
    sectionCard, emptyState,
  };
})();
