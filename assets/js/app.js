/* ============================================================
   HOSPITAL OS — APP BOOTSTRAP (Multi-Role + Realtime)
   Splash → Auth (email + password) → Role Shell
   Role nav · Sidebar · Topbar · Search · Realtime · EML
   ============================================================ */

(function() {

  const ROLE_NAV = {
    doctor: [
      { section: 'Clinical' },
      { page: 'dashboard',     icon: '🏠', label: 'Dashboard',     path: '/dashboard' },
      { page: 'patients',      icon: '👥', label: 'My Patients',    path: '/patients' },
      { page: 'consultations', icon: '🩺', label: 'Consultations',  path: '/consultations' },
      { page: 'ward-rounds',   icon: '🏥', label: 'Ward Rounds',    path: '/ward-rounds' },
      { page: 'appointments',  icon: '📅', label: 'Appointments',   path: '/appointments' },
      { page: 'emr',           icon: '📑', label: 'EMR',            path: '/patients' },
      { page: 'radiology',     icon: '🖼',  label: 'Radiology',      path: '/radiology' },
      { page: 'referrals',     icon: '↗️', label: 'Referrals',      path: '/referrals' },
      { page: 'tasks',         icon: '📋', label: 'Tasks',           path: '/tasks', badge: 'urgentTasks' },
      { section: 'Communication' },
      { page: 'messages',      icon: '💬', label: 'Messages',        path: '/messages', badge: 'messages' },
      { section: 'System' },
      { page: 'notifications', icon: '🔔', label: 'Notifications',  path: '/notifications', badge: 'notifs' },
      { page: 'settings',      icon: '⚙',  label: 'Settings',        path: '/settings' },
    ],
    nurse: [
      { section: 'Nursing' },
      { page: 'dashboard',     icon: '🏠', label: 'Dashboard',      path: '/dashboard' },
      { page: 'patients',      icon: '👥', label: 'Ward Patients',   path: '/patients' },
      { page: 'tasks',         icon: '📋', label: 'Task Board',      path: '/tasks' },
      { page: 'ward-rounds',   icon: '🏥', label: 'Ward Rounds',     path: '/ward-rounds' },
      { page: 'emr',           icon: '📑', label: 'eMAR / Notes',    path: '/patients' },
      { section: 'Communication' },
      { page: 'messages',      icon: '💬', label: 'Team Chat',       path: '/messages' },
      { page: 'notifications', icon: '🔔', label: 'Alerts',          path: '/notifications', badge: 'notifs' },
      { page: 'settings',      icon: '⚙',  label: 'Settings',         path: '/settings' },
    ],
    pharmacist: [
      { section: 'Pharmacy' },
      { page: 'dashboard',     icon: '🏠', label: 'Dashboard',       path: '/dashboard' },
      { page: 'tasks',         icon: '💊', label: 'Dispense Queue',   path: '/tasks' },
      { page: 'patients',      icon: '👥', label: 'Patients',         path: '/patients' },
      { section: 'Clinical' },
      { page: 'messages',      icon: '💬', label: 'Messages',         path: '/messages' },
      { page: 'notifications', icon: '🔔', label: 'Alerts',           path: '/notifications', badge: 'notifs' },
      { page: 'settings',      icon: '⚙',  label: 'Settings',          path: '/settings' },
    ],
    lab: [
      { section: 'Laboratory' },
      { page: 'dashboard',     icon: '🏠', label: 'Dashboard',        path: '/dashboard' },
      { page: 'tasks',         icon: '🧪', label: 'Worklist',          path: '/tasks' },
      { page: 'patients',      icon: '👥', label: 'Patients',          path: '/patients' },
      { section: 'System' },
      { page: 'messages',      icon: '💬', label: 'Messages',          path: '/messages' },
      { page: 'notifications', icon: '🔔', label: 'Critical Values',   path: '/notifications', badge: 'notifs' },
      { page: 'settings',      icon: '⚙',  label: 'Settings',           path: '/settings' },
    ],
    reception: [
      { section: 'Front Desk' },
      { page: 'dashboard',     icon: '🏠', label: 'Dashboard',         path: '/dashboard' },
      { page: 'appointments',  icon: '📅', label: 'Appointments',       path: '/appointments' },
      { page: 'patients',      icon: '👥', label: 'Find Patient',        path: '/patients' },
      { section: 'System' },
      { page: 'messages',      icon: '💬', label: 'Messages',            path: '/messages' },
      { page: 'notifications', icon: '🔔', label: 'Notifications',       path: '/notifications', badge: 'notifs' },
      { page: 'settings',      icon: '⚙',  label: 'Settings',             path: '/settings' },
    ],
    admin: [
      { section: 'Operations' },
      { page: 'dashboard',     icon: '🏠', label: 'Command Centre',      path: '/dashboard' },
      { page: 'patients',      icon: '👥', label: 'Patient Census',       path: '/patients' },
      { page: 'tasks',         icon: '📋', label: 'Operations Tasks',      path: '/tasks' },
      { section: 'System' },
      { page: 'messages',      icon: '💬', label: 'Messages',              path: '/messages' },
      { page: 'notifications', icon: '🔔', label: 'Alerts',                path: '/notifications', badge: 'notifs' },
      { page: 'settings',      icon: '⚙',  label: 'Settings',               path: '/settings' },
    ],
  };

  /* ── Credential map (email → role key) mirrors gateway accounts ─ */
  const CREDENTIAL_MAP = {
    'a.bello@ibomspecialist.gov.ng':   { role: 'doctor',     password: 'doctor123' },
    'c.okeke@ibomspecialist.gov.ng':   { role: 'nurse',      password: 'nurse123' },
    'i.musa@ibomspecialist.gov.ng':    { role: 'pharmacist', password: 'pharm123' },
    'e.nwosu@ibomspecialist.gov.ng':   { role: 'lab',        password: 'lab123' },
    'f.adeyemi@ibomspecialist.gov.ng': { role: 'reception',  password: 'reception123' },
    'c.okoro@ibomspecialist.gov.ng':   { role: 'admin',      password: 'admin123' },
  };

  /* ════════════════════════════════════════════════════════════
     SPLASH SCREEN — Original Hospital OS branding
     ════════════════════════════════════════════════════════════ */
  function buildSplash() {
    return `
    <div id="hos-splash" style="
      position:fixed;inset:0;z-index:99999;
      background:linear-gradient(160deg,#0A1929 0%,#0D3060 50%,#092E52 100%);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      font-family:'Inter',sans-serif;overflow:hidden;">

      <!-- Ambient orbs -->
      <div style="position:absolute;width:500px;height:500px;border-radius:50%;
                  background:radial-gradient(circle,rgba(26,110,181,0.18) 0%,transparent 70%);
                  top:-100px;left:-100px;pointer-events:none;"></div>
      <div style="position:absolute;width:400px;height:400px;border-radius:50%;
                  background:radial-gradient(circle,rgba(0,180,166,0.12) 0%,transparent 70%);
                  bottom:-80px;right:-80px;pointer-events:none;"></div>

      <!-- Logo -->
      <div style="width:88px;height:88px;border-radius:24px;
                  background:linear-gradient(135deg,#1A6EB5,#00B4A6);
                  display:flex;align-items:center;justify-content:center;
                  font-size:42px;margin-bottom:24px;
                  box-shadow:0 16px 56px rgba(26,110,181,0.45),0 0 0 1px rgba(255,255,255,0.08);
                  animation:hosLogoPop 0.6s cubic-bezier(0.16,1,0.3,1) both;">🏥</div>

      <!-- Title -->
      <h1 style="font-size:36px;font-weight:800;color:#fff;letter-spacing:-0.5px;margin:0 0 8px;
                 animation:hosFadeUp 0.5s 0.15s ease both;">Hospital OS</h1>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 32px;letter-spacing:0.01em;
                animation:hosFadeUp 0.5s 0.25s ease both;">
        Ibom Specialist Hospital &amp; Medical Centre
      </p>

      <!-- Boot progress -->
      <div style="width:220px;height:4px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden;
                  animation:hosFadeUp 0.5s 0.35s ease both;">
        <div id="splash-progress-bar" style="height:100%;width:0%;border-radius:999px;
             background:linear-gradient(90deg,#1A6EB5,#00B4A6);
             transition:width 0.3s ease;"></div>
      </div>
      <div id="splash-status" style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:12px;
                                      font-family:monospace;letter-spacing:0.05em;
                                      animation:hosFadeUp 0.5s 0.4s ease both;">
        INITIALISING SYSTEM...
      </div>

      <style>
        @keyframes hosLogoPop  { from{opacity:0;transform:scale(0.7)} to{opacity:1;transform:scale(1)} }
        @keyframes hosFadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      </style>
    </div>`;
  }

  const SPLASH_STEPS = [
    { pct: 18, label: 'LOADING CLINICAL MODULES...' },
    { pct: 36, label: 'CONNECTING PATIENT REGISTRY...' },
    { pct: 54, label: 'SYNCING FORMULARY (AKS-EML)...' },
    { pct: 72, label: 'STARTING REALTIME HUB...' },
    { pct: 90, label: 'VERIFYING SECURITY CLEARANCE...' },
    { pct: 100, label: 'READY' },
  ];

  function animateSplash(onDone) {
    let i = 0;
    function tick() {
      if (i >= SPLASH_STEPS.length) { setTimeout(onDone, 400); return; }
      const step = SPLASH_STEPS[i++];
      const bar = document.getElementById('splash-progress-bar');
      const lbl = document.getElementById('splash-status');
      if (bar) bar.style.width = step.pct + '%';
      if (lbl) lbl.textContent = step.label;
      setTimeout(tick, i === SPLASH_STEPS.length ? 500 : 420);
    }
    setTimeout(tick, 300);
  }

  /* ════════════════════════════════════════════════════════════
     AUTH SCREEN — Email + password, no quick-click
     ════════════════════════════════════════════════════════════ */
  function buildAuth(errorMsg) {
    return `
    <div id="hos-auth" style="
      position:fixed;inset:0;z-index:9999;
      background:linear-gradient(160deg,#0A1929 0%,#0D3060 55%,#092E52 100%);
      display:flex;align-items:center;justify-content:center;
      padding:24px;font-family:'Inter',sans-serif;overflow:auto;">

      <!-- Ambient orbs -->
      <div style="position:absolute;width:460px;height:460px;border-radius:50%;
                  background:radial-gradient(circle,rgba(26,110,181,0.15) 0%,transparent 70%);
                  top:-80px;left:-80px;pointer-events:none;"></div>
      <div style="position:absolute;width:360px;height:360px;border-radius:50%;
                  background:radial-gradient(circle,rgba(0,180,166,0.10) 0%,transparent 70%);
                  bottom:-60px;right:-60px;pointer-events:none;"></div>

      <div style="width:100%;max-width:440px;
                  background:rgba(255,255,255,0.04);
                  border:1px solid rgba(255,255,255,0.09);
                  border-radius:20px;padding:44px 40px;
                  backdrop-filter:blur(20px);
                  box-shadow:0 32px 80px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.04);
                  animation:hosAuthSlide 0.5s cubic-bezier(0.16,1,0.3,1) both;">

        <!-- Logo + title -->
        <div style="text-align:center;margin-bottom:32px;">
          <div style="width:68px;height:68px;border-radius:18px;
                      background:linear-gradient(135deg,#1A6EB5,#00B4A6);
                      display:inline-flex;align-items:center;justify-content:center;
                      font-size:32px;margin-bottom:16px;
                      box-shadow:0 10px 36px rgba(26,110,181,0.4);">🏥</div>
          <h1 style="font-size:22px;font-weight:800;color:#fff;margin:0 0 4px;">Hospital OS</h1>
          <p style="font-size:13px;color:rgba(255,255,255,0.45);margin:0;">
            Ibom Specialist Hospital &amp; Medical Centre
          </p>
        </div>

        <!-- Error -->
        ${errorMsg ? `
        <div id="auth-error" style="background:rgba(229,57,53,0.12);border:1px solid rgba(229,57,53,0.35);
             border-radius:10px;padding:10px 14px;margin-bottom:20px;
             font-size:13px;color:#FF6B6B;display:flex;align-items:center;gap:8px;">
          ⚠️ ${errorMsg}
        </div>` : ''}

        <!-- Form -->
        <form id="auth-form" onsubmit="App.submitLogin(event)" autocomplete="on">
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;font-weight:600;color:rgba(255,255,255,0.55);
                          letter-spacing:0.05em;margin-bottom:6px;">STAFF EMAIL ADDRESS</label>
            <input id="auth-email" type="email" name="email" autocomplete="email"
                   placeholder="your.name@ibomspecialist.gov.ng" required
                   style="width:100%;box-sizing:border-box;padding:11px 14px;
                          background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
                          border-radius:10px;color:#fff;font-size:14px;outline:none;
                          font-family:'Inter',sans-serif;transition:border-color 0.2s;"
                   onfocus="this.style.borderColor='#1A6EB5'"
                   onblur="this.style.borderColor='rgba(255,255,255,0.12)'">
          </div>

          <div style="margin-bottom:24px;">
            <label style="display:block;font-size:12px;font-weight:600;color:rgba(255,255,255,0.55);
                          letter-spacing:0.05em;margin-bottom:6px;">PASSWORD</label>
            <div style="position:relative;">
              <input id="auth-password" type="password" name="password" autocomplete="current-password"
                     placeholder="Enter your password" required
                     style="width:100%;box-sizing:border-box;padding:11px 14px;
                            background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
                            border-radius:10px;color:#fff;font-size:14px;outline:none;
                            font-family:'Inter',sans-serif;transition:border-color 0.2s;"
                     onfocus="this.style.borderColor='#1A6EB5'"
                     onblur="this.style.borderColor='rgba(255,255,255,0.12)'">
              <button type="button" onclick="App.togglePasswordVisibility()"
                      style="position:absolute;right:12px;top:50%;transform:translateY(-50%);
                             background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;
                             font-size:16px;" id="pw-toggle-btn">👁</button>
            </div>
          </div>

          <button type="submit" id="auth-submit-btn" style="
            width:100%;padding:13px;border:none;border-radius:10px;
            background:linear-gradient(135deg,#1A6EB5,#00B4A6);
            color:#fff;font-size:15px;font-weight:700;cursor:pointer;
            font-family:'Inter',sans-serif;letter-spacing:0.01em;
            box-shadow:0 8px 24px rgba(26,110,181,0.35);
            transition:opacity 0.2s,transform 0.15s;"
            onmouseover="this.style.opacity='0.92';this.style.transform='translateY(-1px)'"
            onmouseout="this.style.opacity='1';this.style.transform='none'">
            Sign In to Hospital OS
          </button>
        </form>

        <!-- Footer hint -->
        <p style="text-align:center;margin-top:20px;font-size:11px;color:rgba(255,255,255,0.22);line-height:1.6;">
          Authorised staff only · Ibom Specialist Hospital<br>
          All access is audited and monitored
        </p>
      </div>

      <style>
        @keyframes hosAuthSlide { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        #auth-email::placeholder, #auth-password::placeholder { color:rgba(255,255,255,0.25); }
      </style>
    </div>`;
  }

  /* ════════════════════════════════════════════════════════════
     SIDEBAR
     ════════════════════════════════════════════════════════════ */
  function buildSidebar() {
    const D = window.HOS_DATA;
    const user = D.getCurrentUser();
    const role = user.role || 'doctor';
    const nav = ROLE_NAV[role] || ROLE_NAV.doctor;
    const unreadMsgs = D.unreadCount(D.messages);
    const unreadNotifs = D.unreadNotifs();

    function badge(type) {
      if (type === 'urgentTasks') { const n = D.urgentTasks().length; return n ? `<span class="nav-badge">${n}</span>` : ''; }
      if (type === 'messages') return unreadMsgs ? `<span class="nav-badge">${unreadMsgs}</span>` : '';
      if (type === 'notifs') return unreadNotifs ? `<span class="nav-badge">${unreadNotifs}</span>` : '';
      return '';
    }

    return `
    <nav id="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">H</div>
        <div class="sidebar-logo-text">
          <h1>Hospital OS</h1>
          <span>Better Care · Smarter Systems</span>
        </div>
      </div>

      <div class="sidebar-doctor">
        ${user.avatar
          ? `<img src="${user.avatar}" class="sidebar-doctor-avatar" onerror="this.style.display='none'" alt="">`
          : `<div class="sidebar-doctor-avatar" style="background:${user.color||'var(--primary)'};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">${user.firstName[0]}${user.lastName[0]}</div>`}
        <div class="sidebar-doctor-info">
          <div class="name">${user.name}</div>
          <div class="role">${user.specialty}</div>
        </div>
        <div class="sidebar-doctor-status pulse-success"></div>
      </div>

      <div class="sidebar-nav">
        ${nav.map(item => {
          if (item.section) return `<div class="sidebar-section-label">${item.section}</div>`;
          return `
            <button class="nav-item" data-page="${item.page}" data-tooltip="${item.label}" onclick="Router.navigate('${item.path}')">
              <span class="nav-item-icon">${item.icon}</span>
              <span class="nav-item-label">${item.label}</span>
              ${item.badge ? badge(item.badge) : ''}
            </button>`;
        }).join('')}
      </div>

      <div class="sidebar-footer">
        <div class="sidebar-footer-card">
          <p><strong>Hospital OS v2.0</strong><br>Multi-Role · Realtime<br>
          <button onclick="App.logout()" style="margin-top:8px;background:transparent;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.7);
            padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;">Sign Out</button></p>
        </div>
      </div>
    </nav>`;
  }

  /* ════════════════════════════════════════════════════════════
     TOPBAR
     ════════════════════════════════════════════════════════════ */
  function buildTopbar() {
    const D = window.HOS_DATA;
    const user = D.getCurrentUser();
    const unreadNotifs = D.unreadNotifs();
    return `
    <div id="topbar">
      <button class="topbar-toggle" onclick="App.toggleSidebar()" id="sidebar-toggle-btn" title="Toggle sidebar">☰</button>

      <div class="topbar-search">
        <span class="topbar-search-icon">🔍</span>
        <input type="text" id="topbar-search-input" placeholder="Search patient by name, MRN, or ward..." onclick="App.openSearch()" readonly>
        <span class="topbar-search-kbd">Ctrl+K</span>
      </div>

      <div class="topbar-actions">
        <div style="display:flex;align-items:center;gap:8px;margin-right:8px;padding:4px 12px;border-radius:999px;background:var(--success-light);">
          <div class="live-dot"></div>
          <span style="font-size:11px;font-weight:600;color:var(--success);" data-live-clock>—</span>
        </div>

        <button class="topbar-btn" onclick="App.toggleNotifPanel()" id="notif-btn" title="Notifications">
          🔔
          ${unreadNotifs > 0 ? `<span class="topbar-badge">${unreadNotifs}</span>` : ''}
        </button>

        <div class="topbar-user" style="display:flex;align-items:center;gap:10px;padding:4px 8px;border-radius:10px;cursor:default;">
          ${user.avatar
            ? `<img src="${user.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">`
            : `<div style="width:32px;height:32px;border-radius:50%;background:${user.color||'var(--primary)'};display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;">${user.firstName[0]}${user.lastName[0]}</div>`}
          <div style="line-height:1.2;">
            <div style="font-size:12px;font-weight:600;">${user.prefix} ${user.lastName}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:capitalize;">${user.role}</div>
          </div>
        </div>
      </div>
    </div>

    <div id="notif-panel" class="hidden" style="position:absolute;top:var(--topbar-height);right:16px;width:360px;max-height:420px;overflow:auto;
         background:var(--card);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-xl);z-index:100;">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <strong style="font-size:14px;">Notifications</strong>
        <button onclick="App.closeNotifPanel()" style="background:none;border:none;cursor:pointer;font-size:16px;">×</button>
      </div>
      <div id="notif-list">
        ${D.notifications.slice(0, 8).map(n => `
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);${n.read?'opacity:0.6;':''}">
            <div style="font-size:13px;font-weight:600;">${n.title || n.body || 'Alert'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${n.time || 'Just now'}</div>
          </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--text-muted);">No notifications</div>'}
      </div>
    </div>`;
  }

  /* ════════════════════════════════════════════════════════════
     SEARCH OVERLAY
     ════════════════════════════════════════════════════════════ */
  function buildSearchOverlay() {
    return `
    <div id="search-overlay" class="hidden" style="position:fixed;inset:0;background:rgba(10,25,41,0.6);z-index:500;display:none;align-items:flex-start;justify-content:center;padding-top:12vh;backdrop-filter:blur(4px);">
      <div style="width:560px;max-width:92vw;background:var(--card);border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);overflow:hidden;">
        <div style="padding:16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);">
          <span>🔍</span>
          <input id="search-modal-input" type="text" placeholder="Search patients by name, MRN, ward..."
                 style="flex:1;border:none;outline:none;font-size:15px;background:transparent;"
                 oninput="App.runSearch(this.value)">
          <kbd style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;color:var(--text-muted);">ESC</kbd>
        </div>
        <div id="search-modal-results" style="max-height:360px;overflow:auto;"></div>
      </div>
    </div>`;
  }

  /* ════════════════════════════════════════════════════════════
     APP SHELL
     ════════════════════════════════════════════════════════════ */
  function buildShell() {
    return `
    <div id="app-shell" style="display:flex;height:100vh;width:100%;overflow:hidden;">
      ${buildSidebar()}
      <div id="main-area" style="flex:1;display:flex;flex-direction:column;min-width:0;background:var(--surface);position:relative;">
        ${buildTopbar()}
        <main id="page-root" style="flex:1;overflow:auto;padding:var(--space-6);"></main>
      </div>
      ${buildSearchOverlay()}
    </div>`;
  }

  /* ════════════════════════════════════════════════════════════
     ROUTING
     ════════════════════════════════════════════════════════════ */
  function routeDashboard() {
    const role = window.HOS_DATA.getCurrentUser().role;
    const map = {
      doctor:     () => Pages.dashboard            && Pages.dashboard(),
      nurse:      () => Pages.nurseDashboard       && Pages.nurseDashboard(),
      pharmacist: () => Pages.pharmacistDashboard  && Pages.pharmacistDashboard(),
      lab:        () => Pages.labDashboard         && Pages.labDashboard(),
      reception:  () => Pages.receptionDashboard   && Pages.receptionDashboard(),
      admin:      () => Pages.adminDashboard       && Pages.adminDashboard(),
    };
    (map[role] || map.doctor)();
  }

  function registerRoutes() {
    Router.register('/dashboard',      () => routeDashboard());
    Router.register('/patients',       () => Pages.patients       && Pages.patients());
    Router.register('/emr/:id',        (p) => Pages.emr           && Pages.emr(p));
    Router.register('/consultations',  () => Pages.consultations   && Pages.consultations());
    Router.register('/ward-rounds',    () => Pages['ward-rounds']  && Pages['ward-rounds']());
    Router.register('/appointments',   () => Pages.appointments    && Pages.appointments());
    Router.register('/radiology',      () => Pages.radiology       && Pages.radiology());
    Router.register('/referrals',      () => Pages.referrals       && Pages.referrals());
    Router.register('/tasks',          () => Pages.tasks           && Pages.tasks());
    Router.register('/messages', () => {
      const root = document.getElementById('page-root');
      if (root) root.innerHTML = `<div class="page-enter"><div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">Messages module — clinical team communication</div></div></div>`;
    });
    Router.register('/notifications', () => {
      const D = window.HOS_DATA;
      const root = document.getElementById('page-root');
      if (root) root.innerHTML = `
        <div class="page-enter">
          <div class="card"><div class="card-header"><div class="card-title">🔔 Notifications</div></div>
          <div class="card-body">${D.notifications.map(n=>`<div style="padding:12px 0;border-bottom:1px solid var(--border);"><strong>${n.title||'Alert'}</strong><div style="font-size:12px;color:var(--text-muted);">${n.body||''} · ${n.time||''}</div></div>`).join('')||'<div style="color:var(--text-muted);">No notifications</div>'}</div></div>
        </div>`;
    });
    Router.register('/settings', () => {
      const root = document.getElementById('page-root');
      if (root) root.innerHTML = `<div class="page-enter"><div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">Settings — role preferences & display options</div></div></div>`;
    });
  }

  /* ════════════════════════════════════════════════════════════
     GLOBAL APP OBJECT
     ════════════════════════════════════════════════════════════ */
  window.App = {
    sidebarCollapsed: false,
    loggedIn: false,
    token: null,

    init() {
      /* 1 — Splash */
      document.getElementById('app').innerHTML = buildSplash();
      animateSplash(() => {
        /* 2 — Auth screen */
        document.getElementById('app').innerHTML = buildAuth();
        const emailInput = document.getElementById('auth-email');
        if (emailInput) setTimeout(() => emailInput.focus(), 80);
      });
      registerRoutes();
    },

    togglePasswordVisibility() {
      const pw = document.getElementById('auth-password');
      const btn = document.getElementById('pw-toggle-btn');
      if (!pw) return;
      if (pw.type === 'password') { pw.type = 'text'; if (btn) btn.textContent = '🙈'; }
      else                        { pw.type = 'password'; if (btn) btn.textContent = '👁'; }
    },

    async submitLogin(e) {
      e.preventDefault();
      const emailEl = document.getElementById('auth-email');
      const pwEl    = document.getElementById('auth-password');
      const btn     = document.getElementById('auth-submit-btn');
      if (!emailEl || !pwEl) return;

      const email = emailEl.value.trim().toLowerCase();
      const password = pwEl.value;

      if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; btn.style.opacity = '0.7'; }

      /* ── Try Gateway first ── */
      let token = null, apiUser = null, roleKey = null;
      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const body = await res.json();
        if (body.success && body.token) {
          token   = body.token;
          apiUser = body.user;
          roleKey = body.user?.role;
          sessionStorage.setItem('hos_token', token);
          sessionStorage.setItem('hos_role', roleKey);
        } else {
          throw new Error(body.error || body.message || 'Invalid credentials');
        }
      } catch (gatewayErr) {
        /* ── Offline fallback — check credential map ── */
        const cred = CREDENTIAL_MAP[email];
        if (cred && cred.password === password) {
          roleKey = cred.role;
          console.info('[Auth] Offline credential match — gateway unreachable');
        } else {
          /* Wrong credentials */
          document.getElementById('app').innerHTML = buildAuth('Invalid email or password. Please try again.');
          const emailInput = document.getElementById('auth-email');
          if (emailInput) { emailInput.value = email; emailInput.focus(); }
          return;
        }
      }

      await this._enterApp(roleKey, token, apiUser);
    },

    async _enterApp(roleKey, token, apiUser) {
      const D = window.HOS_DATA;
      D.setCurrentUser(roleKey);

      if (apiUser) {
        const u = D.getCurrentUser();
        Object.assign(u, {
          id: apiUser.id,
          name: apiUser.name,
          email: apiUser.email,
          scopes: apiUser.scopes,
          facilityName: apiUser.facilityName,
        });
      }

      this.loggedIn = true;
      this.token = token;
      document.getElementById('app').innerHTML = buildShell();

      // Start realtime
      if (window.Realtime) {
        Realtime.start(token);
        Realtime.on('badge-update', () => this.rebuildTopbar());
        Realtime.on('notification',  () => this.rebuildTopbar());
      }

      // Pull live snapshot
      if (token) {
        try {
          const snap = await fetch('/api/v1/hospital/snapshot', {
            headers: { Authorization: 'Bearer ' + token },
          });
          const snapBody = await snap.json();
          if (snapBody.success && snapBody.data) {
            const s = snapBody.data;
            if (s.queues)         Object.assign(D.queues, s.queues);
            if (s.pharmacyQueue)  D.pharmacyQueue.splice(0, D.pharmacyQueue.length, ...s.pharmacyQueue);
            if (s.labQueue)       D.labQueue.splice(0, D.labQueue.length, ...s.labQueue);
            if (s.bedBoard)       D.bedBoard.splice(0, D.bedBoard.length, ...s.bedBoard);
            if (s.nursingTasks)   D.nursingTasks.splice(0, D.nursingTasks.length, ...s.nursingTasks);
            if (s.receptionQueue) D.receptionQueue.splice(0, D.receptionQueue.length, ...s.receptionQueue);
            if (s.facilityMetrics) Object.assign(D.facilityMetrics, s.facilityMetrics);
            if (s.notifications)  { D.notifications.length = 0; s.notifications.forEach(n => D.notifications.push(n)); }
          }
        } catch (e) { console.warn('[Snapshot] offline fallback', e); }
      }

      document.addEventListener('keydown', (ev) => {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === 'k') { ev.preventDefault(); this.openSearch(); }
        if (ev.key === 'Escape') { this.closeSearch(); this.closeNotifPanel(); }
      });
      document.addEventListener('click', (ev) => {
        const panel = document.getElementById('notif-panel');
        const btn   = document.getElementById('notif-btn');
        if (panel && !panel.classList.contains('hidden') && !panel.contains(ev.target) && !btn?.contains(ev.target))
          panel.classList.add('hidden');
      });

      Router.navigate('/dashboard');
    },

    async logout() {
      const token = this.token || sessionStorage.getItem('hos_token');
      if (token) {
        try { await fetch('/api/v1/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }); }
        catch (_) {}
      }
      sessionStorage.removeItem('hos_token');
      sessionStorage.removeItem('hos_role');
      this.token   = null;
      this.loggedIn = false;
      if (window.Realtime) Realtime.stop();
      /* Return to splash → auth */
      document.getElementById('app').innerHTML = buildSplash();
      animateSplash(() => {
        document.getElementById('app').innerHTML = buildAuth();
        const emailInput = document.getElementById('auth-email');
        if (emailInput) setTimeout(() => emailInput.focus(), 80);
      });
    },

    toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;
      this.sidebarCollapsed = !this.sidebarCollapsed;
      sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
    },

    openSearch() {
      const overlay = document.getElementById('search-overlay');
      if (!overlay) return;
      overlay.classList.remove('hidden');
      overlay.style.display = 'flex';
      setTimeout(() => {
        const input = document.getElementById('search-modal-input');
        if (input) { input.focus(); input.value = ''; this.runSearch(''); }
      }, 50);
    },

    closeSearch() {
      const overlay = document.getElementById('search-overlay');
      if (overlay) { overlay.classList.add('hidden'); overlay.style.display = 'none'; }
    },

    runSearch(q) {
      const results = document.getElementById('search-modal-results');
      if (!results) return;
      const D = window.HOS_DATA;
      const C = window.Components;
      const list = D.searchPatients(q);
      if (!list.length) {
        results.innerHTML = `<div style="padding:var(--space-5);text-align:center;color:var(--text-muted);">No patients found${q ? ` for "${q}"` : ''}</div>`;
        return;
      }
      results.innerHTML = list.map(p => `
        <div class="search-result-item" style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--border);"
             onclick="App.closeSearch();Router.navigate('/emr/${p.id}')"
             onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background=''">
          ${C.avatar ? C.avatar(p, 40) : `<div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;">${(p.name||'').split(' ').map(x=>x[0]).join('').slice(0,2)}</div>`}
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;">${p.name}</div>
            <div style="font-size:11px;color:var(--text-muted);">${p.mrn} • ${p.age===0?'Neonatal':p.age+'y'} / ${p.sex} • ${p.ward} Ward</div>
          </div>
          ${C.statusBadge ? C.statusBadge(p.status) : ''}
        </div>`).join('');
    },

    toggleNotifPanel() {
      document.getElementById('notif-panel')?.classList.toggle('hidden');
    },

    closeNotifPanel() {
      document.getElementById('notif-panel')?.classList.add('hidden');
    },

    rebuildTopbar() {
      const topbar = document.getElementById('topbar');
      if (!topbar) return;
      const temp = document.createElement('div');
      temp.innerHTML = buildTopbar();
      const newTop = temp.querySelector('#topbar') || temp.firstElementChild;
      topbar.replaceWith(newTop);
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

})();
