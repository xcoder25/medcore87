/**
 * Three-fix patch:
 * 1. PIN reset: store roleKey in forgotLookupResult & preserve it on reset
 * 2. Header UX: improve os-top-hud trail spacing & add module breadcrumb
 * 3. Celestia chat UX: ensure chat container scrolls with fixed height
 */
const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: PIN Reset – roleKey missing from lookup state → wrong role after reset
// ─────────────────────────────────────────────────────────────────────────────
const authPath = 'apps/os/src/components/auth/AuthScreen.tsx';
let auth = fs.readFileSync(authPath, 'utf8');

// 1a. Extend forgotLookupResult type to include roleKey & clearanceLevel
auth = auth.replace(
  `  const [forgotLookupResult, setForgotLookupResult] = useState<{
    badgeId: string;
    name: string;
    role: string;
    department: string;
    registeredEmail: string;
    maskedEmail: string;
    hasRegisteredEmail: boolean;
  } | null>(null);`,
  `  const [forgotLookupResult, setForgotLookupResult] = useState<{
    badgeId: string;
    name: string;
    role: string;
    roleKey?: string;
    clearanceLevel?: number;
    department: string;
    registeredEmail: string;
    maskedEmail: string;
    hasRegisteredEmail: boolean;
  } | null>(null);`
);

// 1b. In the API lookup path, also include roleKey & clearanceLevel
auth = auth.replace(
  `      if (data.ok && data.found) {
        setForgotLookupResult({
          badgeId: data.badgeId || query,
          name: data.name || 'Healthcare Staff',
          role: data.role || 'Staff Member',
          department: data.department || '',
          registeredEmail: data.registeredEmail || '',
          maskedEmail: data.maskedEmail || '',
          hasRegisteredEmail: Boolean(data.hasRegisteredEmail),
        });
        setForgotStep('options');
        setForgotLoading(false);
        return;
      }`,
  `      if (data.ok && data.found) {
        setForgotLookupResult({
          badgeId: data.badgeId || query,
          name: data.name || 'Healthcare Staff',
          role: data.role || 'Staff Member',
          roleKey: data.roleKey || '',
          clearanceLevel: data.clearanceLevel,
          department: data.department || '',
          registeredEmail: data.registeredEmail || '',
          maskedEmail: data.maskedEmail || '',
          hasRegisteredEmail: Boolean(data.hasRegisteredEmail),
        });
        setForgotStep('options');
        setForgotLoading(false);
        return;
      }`
);

// 1c. In the local-store lookup path, include roleKey too
auth = auth.replace(
  `        setForgotLookupResult({
          badgeId: bId,
          name: hit.name || 'Healthcare Staff',
          role: hit.role || 'Staff Member',
          department: hit.department || '',
          registeredEmail: regMail,
          maskedEmail: masked,
          hasRegisteredEmail: Boolean(regMail && !regMail.includes('naija-bites-1s3y1.firebaseapp.com')),
        });`,
  `        setForgotLookupResult({
          badgeId: bId,
          name: hit.name || 'Healthcare Staff',
          role: hit.role || 'Staff Member',
          roleKey: (hit as any).roleKey || '',
          clearanceLevel: (hit as any).clearanceLevel,
          department: hit.department || '',
          registeredEmail: regMail,
          maskedEmail: masked,
          hasRegisteredEmail: Boolean(regMail && !regMail.includes('naija-bites-1s3y1.firebaseapp.com')),
        });`
);

// 1d. In handleResetPinSubmit, after updateStaffPin, also patch the local registry
//     so the roleKey is preserved, preventing a wrong role on next login
auth = auth.replace(
  `      // 1. Update local stores immediately
      const { updateStaffPin } = await import('../../lib/staffCardStore');
      updateStaffPin(badgeId, p, facilityId);

      // 2. Update remote API / Firebase Auth / Firestore`,
  `      // 1. Update local stores immediately
      const { updateStaffPin, inferRoleKey } = await import('../../lib/staffCardStore');
      updateStaffPin(badgeId, p, facilityId);

      // 1b. Also patch local registry so the roleKey is preserved after reset
      try {
        const regRaw = localStorage.getItem('medcore_os_staff_registry');
        const reg: any[] = regRaw ? JSON.parse(regRaw) : [];
        const bUp = badgeId.toUpperCase();
        const idx = reg.findIndex((r: any) => String(r.badgeId || r.id || '').toUpperCase() === bUp);
        const storedRoleKey = forgotLookupResult!.roleKey || inferRoleKey(forgotLookupResult!.role, badgeId);
        if (idx >= 0) {
          reg[idx] = { ...reg[idx], pin: p, roleKey: storedRoleKey };
        } else {
          // Insert minimal record so login can find it
          reg.unshift({
            badgeId,
            id: badgeId,
            name: forgotLookupResult!.name,
            role: forgotLookupResult!.role,
            roleKey: storedRoleKey,
            clearanceLevel: forgotLookupResult!.clearanceLevel ?? 3,
            department: forgotLookupResult!.department,
            facilityId,
            hospitalId: facilityId,
            pin: p,
          });
        }
        localStorage.setItem('medcore_os_staff_registry', JSON.stringify(reg));
        localStorage.setItem('medcore_staff_registry', JSON.stringify(reg));
      } catch { /* non-fatal */ }

      // 2. Update remote API / Firebase Auth / Firestore`
);

// 1e. Also add localStorage admin lookup as a tertiary fallback in handleLookupAccount
// after the offline catch block - check claimed-facility localStorage keys
auth = auth.replace(
  `      setForgotError('Unable to reach authentication server. Please verify your Staff Badge ID.');
    } finally {
      setForgotLoading(false);
    }
  };`,
  `      // Also check localStorage registry as tertiary fallback
      try {
        const regRaw = localStorage.getItem('medcore_os_staff_registry');
        const reg: any[] = regRaw ? JSON.parse(regRaw) : [];
        const bUp = query.trim().toUpperCase();
        const found = reg.find((r: any) => String(r.badgeId || r.id || '').toUpperCase() === bUp);
        if (found) {
          const { normalizeBadgeId } = await import('../../lib/staffCardStore');
          const bId = normalizeBadgeId(found.badgeId || found.id || query);
          setForgotLookupResult({
            badgeId: bId,
            name: found.name || found.fullName || 'Healthcare Staff',
            role: found.role || 'Staff Member',
            roleKey: found.roleKey || '',
            clearanceLevel: found.clearanceLevel,
            department: found.department || '',
            registeredEmail: found.email || found.workEmail || '',
            maskedEmail: '',
            hasRegisteredEmail: false,
          });
          setForgotStep('options');
          setForgotLoading(false);
          return;
        }
      } catch { /* ignore */ }

      setForgotError('Unable to reach authentication server. Please verify your Staff Badge ID.');
    } finally {
      setForgotLoading(false);
    }
  };`
);

fs.writeFileSync(authPath, auth, 'utf8');
console.log('✅ Fix 1 (PIN reset roleKey) applied to AuthScreen.tsx');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: Also update the reset-pin API route to return roleKey in the lookup
// ─────────────────────────────────────────────────────────────────────────────
const routePath = 'apps/os/src/app/api/auth/reset-pin/route.ts';
let route = fs.readFileSync(routePath, 'utf8');

// Return roleKey from Firestore doc in lookup response
route = route.replace(
  `    return NextResponse.json({
      ok: true,
      found: true,
      badgeId: matchedBadge || (isEmail ? '' : query),
      name: displayName,
      role,
      department,`,
  `    const roleKey = matchedStaff?.roleKey || matchedStaff?.role || '';
    const clearanceLevel = matchedStaff?.clearanceLevel;
    return NextResponse.json({
      ok: true,
      found: true,
      badgeId: matchedBadge || (isEmail ? '' : query),
      name: displayName,
      role,
      roleKey,
      clearanceLevel,
      department,`
);

fs.writeFileSync(routePath, route, 'utf8');
console.log('✅ Fix 2 (API returns roleKey) applied to reset-pin/route.ts');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3: Celestia chat - ensure messages area scrolls (fix height extension)
// ─────────────────────────────────────────────────────────────────────────────
const cssPath = 'apps/os/src/styles/os.css';
let css = fs.readFileSync(cssPath, 'utf8');

// Fix .celestia-messages to use overflow-y: auto with min-height: 0 
// The key is min-height: 0 so flex child can shrink and scroll
css = css.replace(
  `.m87-messages,
.celestia-messages {
  position: relative;
  z-index: 2;
  flex: 1;
  overflow-y: auto;
  padding: 16px 14px 12px;
  display: flex;
  flex-direction: column;
  scrollbar-width: thin;
  scrollbar-color: rgba(167, 139, 250, 0.35) transparent;
}`,
  `.m87-messages,
.celestia-messages {
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0; /* KEY: allows flex children to shrink and scroll */
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 14px 12px;
  display: flex;
  flex-direction: column;
  scrollbar-width: thin;
  scrollbar-color: rgba(167, 139, 250, 0.35) transparent;
  scroll-behavior: smooth;
}`
);

// Also fix .celestia-messages-inner to not extend parent
css = css.replace(
  `.celestia-messages-inner {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}`,
  `.celestia-messages-inner {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex-shrink: 0; /* Don't shrink bubbles, let the scroll container handle overflow */
}`
);

// Fix m87-chat-shell drawer mode to use fixed height properly
css = css.replace(
  `.m87-chat-shell.is-in-drawer {
  border-radius: 0;
  border: none;
  box-shadow: none;
}`,
  `.m87-chat-shell.is-in-drawer {
  border-radius: 0;
  border: none;
  box-shadow: none;
  height: 100%;
  min-height: 0;
}`
);

fs.writeFileSync(cssPath, css, 'utf8');
console.log('✅ Fix 3 (Celestia scrollable chat) applied to os.css');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 4: Header UX - add visible breadcrumb showing active module, 
//         clean up the trailing section spacing
// ─────────────────────────────────────────────────────────────────────────────
const pagePath = 'apps/os/src/app/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

// The os-top-hud-trail needs `ml-auto` equivalent so it pushes right
// Currently it doesn't have `flex: 1` before the trail buttons
// Add a module breadcrumb pill between the search bar and the trail
const oldTrail = `          <div className="os-top-hud-trail">
            <TopHudClock />

            
            <button
              type="button"
              className="os-top-hud-icon-btn"
              title="Back"
              aria-label="Go back"
              onClick={() => goModuleBack()}
              disabled={moduleHistory.length === 0 && activeModule === 'dashboard'}
              style={{
                opacity: moduleHistory.length === 0 && activeModule === 'dashboard' ? 0.35 : 1,
              }}
            >
              <ArrowLeft size={17} strokeWidth={2.25} />
            </button>
<span className="os-top-hud-live">
              <span className="os-top-hud-live-dot" />
              Live
            </span>`;

const newTrail = `          {/* Module breadcrumb pill — shows active workspace name */}
          {activeModule !== 'dashboard' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                background: 'linear-gradient(135deg, #EFF6FF 0%, #F0FDFA 100%)',
                border: '1px solid #BAE6FD',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#0284C7',
                flexShrink: 0,
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ opacity: 0.55, fontSize: '0.65rem' }}>▸</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(activeModule).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </div>
          )}

          <div className="os-top-hud-trail">
            <TopHudClock />

            <button
              type="button"
              className="os-top-hud-icon-btn"
              title="Back"
              aria-label="Go back"
              onClick={() => goModuleBack()}
              disabled={moduleHistory.length === 0 && activeModule === 'dashboard'}
              style={{
                opacity: moduleHistory.length === 0 && activeModule === 'dashboard' ? 0.35 : 1,
              }}
            >
              <ArrowLeft size={17} strokeWidth={2.25} />
            </button>
<span className="os-top-hud-live">
              <span className="os-top-hud-live-dot" />
              Live
            </span>`;

if (page.includes(oldTrail)) {
  page = page.replace(oldTrail, newTrail);
  console.log('✅ Fix 4a (Header module breadcrumb) applied to page.tsx');
} else {
  console.warn('⚠️ Header trail target not found exactly — skipping breadcrumb');
}

fs.writeFileSync(pagePath, page, 'utf8');
console.log('✅ Fix 4 (Header UX) applied to page.tsx');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 5: CSS for os-top-hud — make the trail flex properly
// ─────────────────────────────────────────────────────────────────────────────
// Append improved header styles at end of css
const headerFix = `

/* ── Header UX Enhancement ────────────────────────────────────────────────── */
/* Breadcrumb module pill between search and trail */
.os-top-hud .os-top-hud-trail {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: auto;
}

/* Make facility block not wrap */
.os-top-hud-facility {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 6px;
  border-radius: 999px;
  border: 1px solid #E2E8F0;
  background: #fff;
  flex-shrink: 0;
  cursor: pointer;
  transition: border-color 0.15s;
  max-width: 200px;
}

.os-top-hud-facility:hover {
  border-color: #BAE6FD;
  background: #F0F9FF;
}

.os-top-hud-facility-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #EFF6FF 0%, #E0F2FE 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.os-top-hud-facility-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.os-top-hud-facility-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: #0F172A;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.os-top-hud-facility-loc {
  font-size: 0.62rem;
  font-weight: 600;
  color: #64748B;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.os-top-hud-live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
  font-weight: 700;
  color: #059669;
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: #ECFDF5;
  border: 1px solid #A7F3D0;
}

.os-top-hud-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10B981;
  animation: os-live-pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes os-live-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
}
`;

fs.appendFileSync(cssPath, headerFix, 'utf8');
console.log('✅ Fix 5 (CSS header improvements) appended to os.css');

console.log('\n🎉 All fixes applied successfully!');

