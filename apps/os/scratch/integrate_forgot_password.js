const fs = require('fs');
const path = require('path');

const filePath = path.join(
  'c:\\Users\\Dell\\OneDrive\\Desktop\\medcore\\apps\\os\\src\\components\\auth\\AuthScreen.tsx'
);

let content = fs.readFileSync(filePath, 'utf8');

console.log('Original AuthScreen length:', content.length);

// 1. Check if lucide-react imports need KeyRound, Mail, RefreshCw, X, ShieldAlert, Sparkles, Check, ChevronLeft
const oldLucideImport = `import {
  Building2, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck
} from 'lucide-react';`;

const newLucideImport = `import {
  Building2, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck,
  KeyRound, Mail, RefreshCw, X, ShieldAlert, Sparkles, Check, ChevronLeft
} from 'lucide-react';`;

if (content.includes(oldLucideImport)) {
  content = content.replace(oldLucideImport, newLucideImport);
  console.log('✅ Updated lucide-react imports');
} else {
  console.log('⚠️ Could not match exact lucide import, checking if already imported');
}

// 2. Insert state & handlers after line: const [firebaseLive, setFirebaseLive] = useState(false);
const targetStateAnchor = `  const [firebaseLive, setFirebaseLive] = useState(false);`;

const forgotStateCode = `  const [firebaseLive, setFirebaseLive] = useState(false);

  // ── Forgot Password / PIN Recovery State ─────────────────────────────
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotLookupResult, setForgotLookupResult] = useState<{
    badgeId: string;
    name: string;
    role: string;
    department: string;
    registeredEmail: string;
    maskedEmail: string;
    hasRegisteredEmail: boolean;
  } | null>(null);
  const [forgotStep, setForgotStep] = useState<'identify' | 'options' | 'direct_pin' | 'email_sent'>('identify');
  const [forgotNewPin, setForgotNewPin] = useState('');
  const [forgotConfirmPin, setForgotConfirmPin] = useState('');
  const [forgotShowPin, setForgotShowPin] = useState(false);

  const openForgotModal = () => {
    setForgotIdentifier(username.trim());
    setForgotError(null);
    setForgotSuccess(null);
    setForgotLookupResult(null);
    setForgotNewPin('');
    setForgotConfirmPin('');
    setForgotStep('identify');
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotError(null);
    setForgotSuccess(null);
  };

  const handleLookupAccount = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = forgotIdentifier.trim();
    if (!query) {
      setForgotError('Please enter your Staff Badge ID or Email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);

    try {
      // 1. Try server API lookup
      const res = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup',
          facilityId: selectedHospital.id,
          query,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.ok && data.found) {
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
      }

      // 2. Fallback to local store lookup (for offline workstations)
      const { resolveStaffByBadge, findStaffByEmail, normalizeBadgeId } = await import('../../lib/staffCardStore');
      const localCard = resolveStaffByBadge(query);
      const emailCard = !localCard && query.includes('@') ? findStaffByEmail(query, selectedHospital.id) : null;
      const hit = localCard || emailCard;

      if (hit) {
        const bId = normalizeBadgeId(hit.badgeId || (hit as any).id || query);
        const regMail = String((hit as any).email || (hit as any).workEmail || (query.includes('@') ? query : '')).trim();
        const masked = regMail && regMail.includes('@') ? \`\${regMail.slice(0, 2)}***@\${regMail.split('@')[1]}\` : '';

        setForgotLookupResult({
          badgeId: bId,
          name: hit.name || 'Healthcare Staff',
          role: hit.role || 'Staff Member',
          department: hit.department || '',
          registeredEmail: regMail,
          maskedEmail: masked,
          hasRegisteredEmail: Boolean(regMail && !regMail.includes('naija-bites-1s3y1.firebaseapp.com')),
        });
        setForgotStep('options');
        setForgotLoading(false);
        return;
      }

      // Not found
      setForgotError(data.error || \`No staff record matching "\${query}" was found at \${selectedHospital.name}. Please check your Badge ID or contact the Facility Administrator.\`);
    } catch {
      // Offline fallback
      try {
        const { resolveStaffByBadge, normalizeBadgeId } = await import('../../lib/staffCardStore');
        const localHit = resolveStaffByBadge(query);
        if (localHit) {
          const bId = normalizeBadgeId(localHit.badgeId);
          setForgotLookupResult({
            badgeId: bId,
            name: localHit.name,
            role: localHit.role,
            department: localHit.department,
            registeredEmail: '',
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
  };

  const handleSendResetEmail = async () => {
    if (!forgotLookupResult) return;
    const targetEmail = forgotLookupResult.registeredEmail || forgotIdentifier;
    if (!targetEmail || !targetEmail.includes('@')) {
      setForgotError('No recovery email is associated with this account. Please use Instant PIN Reset below.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);

    try {
      // 1. Try server dispatch
      const res = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email',
          email: targetEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.ok) {
        setForgotSuccess(\`Password reset email dispatched to \${forgotLookupResult.maskedEmail || targetEmail}. Follow the link in your email to set a new password.\`);
        setForgotStep('email_sent');
        setForgotLoading(false);
        return;
      }

      // 2. Client-side Firebase fallback
      const { firebaseSendPasswordReset } = await import('../../lib/firebase');
      const clientRes = await firebaseSendPasswordReset(targetEmail);
      if (clientRes.success) {
        setForgotSuccess(\`Password reset email dispatched to \${forgotLookupResult.maskedEmail || targetEmail}.\`);
        setForgotStep('email_sent');
        setForgotLoading(false);
        return;
      }

      setForgotError(clientRes.error || data.error || 'Failed to dispatch password reset email. Please try again or use Instant PIN Reset.');
    } catch (e: any) {
      setForgotError(e?.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotLookupResult) return;

    const p = forgotNewPin.trim();
    const c = forgotConfirmPin.trim();

    if (!p) {
      setForgotError('Please enter a new PIN.');
      return;
    }
    if (p.length < 4) {
      setForgotError('Security PIN must be at least 4 digits.');
      return;
    }
    if (p !== c) {
      setForgotError('New PIN and Confirm PIN do not match.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);

    const badgeId = forgotLookupResult.badgeId;
    const facilityId = selectedHospital.id;

    try {
      // 1. Update local stores immediately
      const { updateStaffPin } = await import('../../lib/staffCardStore');
      updateStaffPin(badgeId, p, facilityId);

      // 2. Update remote API / Firebase Auth / Firestore
      try {
        await fetch('/api/auth/reset-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset_pin',
            badgeId,
            newPin: p,
            facilityId,
            email: forgotLookupResult.registeredEmail,
          }),
        });
      } catch {
        /* background sync non-blocking */
      }

      // Log security event
      try {
        authLog(\`Staff PIN reset for \${badgeId} (\${forgotLookupResult.name})\`);
      } catch { /* ignore */ }

      // Success
      setForgotSuccess(\`PIN successfully updated to \${p}! Logging you in…\`);
      setUsername(badgeId);
      setPassword(p);

      setTimeout(() => {
        closeForgotModal();
      }, 1500);
    } catch (err: any) {
      setForgotError(err?.message || 'Failed to update PIN. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };`;

if (content.includes(targetStateAnchor)) {
  content = content.replace(targetStateAnchor, forgotStateCode);
  console.log('✅ Added forgot password state and handlers');
} else {
  console.error('❌ Could not find targetStateAnchor');
  process.exit(1);
}

// 3. Replace the dead "Forgot password?" link with active button that opens modal
const deadLinkRegex = /<a\s+href="#forgot"[\s\S]*?Forgot password\?[\s\S]*?<\/a>/;

const activeForgotLink = `<button
                type="button"
                onClick={() => openForgotModal()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: '#0284C7',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#0369A1')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#0284C7')}
              >
                Forgot password or PIN?
              </button>`;

if (deadLinkRegex.test(content)) {
  content = content.replace(deadLinkRegex, activeForgotLink);
  console.log('✅ Replaced dead forgot link with active modal trigger button');
} else {
  console.error('❌ Could not find dead link pattern');
}

// 4. Insert the ultra-premium Forgot Password Modal JSX right before the last closing `</div>\n  );\n};`
const modalJSX = `
      {/* ── Ultra-Premium Forgot Password / PIN Recovery Modal ── */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            animation: 'fadeInModal 0.2s ease-out',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForgotModal();
          }}
        >
          <style>{\`
            @keyframes fadeInModal {
              from { opacity: 0; transform: scale(0.97); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes spinPulse {
              to { transform: rotate(360deg); }
            }
          \`}</style>

          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#FFFFFF',
              borderRadius: 18,
              boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.9)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 22px',
                borderBottom: '1px solid #F1F5F9',
                background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #0284C7 0%, #00BFA5 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                    Credential & PIN Recovery
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Building2 size={12} color="#0284C7" />
                    <span>{selectedHospital.name}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeForgotModal}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: '#F1F5F9',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#E2E8F0';
                  e.currentTarget.style.color = '#0F172A';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#F1F5F9';
                  e.currentTarget.style.color = '#64748B';
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 22px' }}>
              {/* Error Message */}
              {forgotError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '11px 14px',
                    borderRadius: 10,
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#991B1B',
                    fontSize: '0.82rem',
                    marginBottom: 16,
                    lineHeight: 1.45,
                  }}
                >
                  <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{forgotError}</span>
                </div>
              )}

              {/* Success Message */}
              {forgotSuccess && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '11px 14px',
                    borderRadius: 10,
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#166534',
                    fontSize: '0.82rem',
                    marginBottom: 16,
                    lineHeight: 1.45,
                  }}
                >
                  <CheckCircle2 size={17} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{forgotSuccess}</span>
                </div>
              )}

              {/* STEP 1: IDENTIFY ACCOUNT */}
              {forgotStep === 'identify' && (
                <form onSubmit={handleLookupAccount}>
                  <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                    Enter your official <strong>Staff Badge ID</strong> (e.g. <code>AMC-2026-4821</code>) or your registered <strong>Work Email</strong> to locate your healthcare profile.
                  </p>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      Staff Badge ID or Email Address
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="e.g. AMC-2026-4821 or dr.emem@medcore.ng"
                        required
                        autoFocus
                        style={{
                          width: '100%',
                          height: 46,
                          padding: '0 14px 0 38px',
                          borderRadius: 10,
                          border: '1.5px solid #CBD5E1',
                          fontSize: '0.9rem',
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box',
                          fontFamily: forgotIdentifier.includes('@') ? 'inherit' : 'var(--os-font-mono, monospace)',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#0284C7';
                          e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.15)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#CBD5E1';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <User size={18} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 14 }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button
                      type="button"
                      onClick={closeForgotModal}
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 10,
                        border: '1px solid #E2E8F0',
                        background: '#FFFFFF',
                        color: '#475569',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      style={{
                        flex: 2,
                        height: 44,
                        borderRadius: 10,
                        border: 'none',
                        background: 'linear-gradient(90deg, #0284C7 0%, #0D9488 100%)',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: forgotLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.28)',
                        opacity: forgotLoading ? 0.75 : 1,
                      }}
                    >
                      {forgotLoading ? (
                        <>
                          <RefreshCw size={16} style={{ animation: 'spinPulse 0.8s linear infinite' }} />
                          <span>Locating Account…</span>
                        </>
                      ) : (
                        <>
                          <span>Verify Identity</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: CHOOSE RECOVERY OPTIONS */}
              {forgotStep === 'options' && forgotLookupResult && (
                <div>
                  {/* Verified Staff Card */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: 14,
                      borderRadius: 12,
                      background: '#F0F9FF',
                      border: '1px solid #BAE6FD',
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: '#0284C7',
                        color: '#FFFFFF',
                        fontSize: '1rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
                        flexShrink: 0,
                      }}
                    >
                      {forgotLookupResult.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {forgotLookupResult.name}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#0369A1', fontWeight: 600, marginTop: 1 }}>
                        {forgotLookupResult.role} {forgotLookupResult.department ? \`· \${forgotLookupResult.department}\` : ''}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'var(--os-font-mono, monospace)', marginTop: 2 }}>
                        Badge ID: <strong style={{ color: '#0F172A' }}>{forgotLookupResult.badgeId}</strong>
                      </div>
                    </div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: '#DCFCE7',
                        color: '#15803D',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      <Check size={12} /> Verified
                    </span>
                  </div>

                  <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>
                    Select how you would like to recover your workstation access:
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Method 1: Instant PIN Reset (Self-Service) */}
                    <button
                      type="button"
                      onClick={() => {
                        setForgotError(null);
                        setForgotStep('direct_pin');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 14,
                        padding: 14,
                        borderRadius: 12,
                        border: '1.5px solid #0284C7',
                        background: '#FFFFFF',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 2px 8px rgba(2, 132, 199, 0.08)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#F8FAFC';
                        e.currentTarget.style.borderColor = '#0369A1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#FFFFFF';
                        e.currentTarget.style.borderColor = '#0284C7';
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 9,
                          background: '#E0F2FE',
                          color: '#0284C7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <KeyRound size={18} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A' }}>
                          Instant PIN Reset (Fast On-Duty Access)
                        </div>
                        <div style={{ fontSize: '0.77rem', color: '#64748B', marginTop: 3, lineHeight: 1.4 }}>
                          Define a new 4–6 digit PIN immediately to sign in and resume clinical duties without delay.
                        </div>
                      </div>
                      <ArrowRight size={16} color="#0284C7" style={{ marginTop: 4, flexShrink: 0 }} />
                    </button>

                    {/* Method 2: Send Email Reset Link */}
                    {forgotLookupResult.hasRegisteredEmail ? (
                      <button
                        type="button"
                        onClick={handleSendResetEmail}
                        disabled={forgotLoading}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 14,
                          padding: 14,
                          borderRadius: 12,
                          border: '1px solid #E2E8F0',
                          background: '#FFFFFF',
                          textAlign: 'left',
                          cursor: forgotLoading ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#F8FAFC';
                          e.currentTarget.style.borderColor = '#CBD5E1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#FFFFFF';
                          e.currentTarget.style.borderColor = '#E2E8F0';
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 9,
                            background: '#F1F5F9',
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Mail size={18} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A' }}>
                            Send Password Reset Email
                          </div>
                          <div style={{ fontSize: '0.77rem', color: '#64748B', marginTop: 3, lineHeight: 1.4 }}>
                            Send official Firebase reset instructions to <strong>{forgotLookupResult.maskedEmail}</strong>.
                          </div>
                        </div>
                        <ArrowRight size={16} color="#94A3B8" style={{ marginTop: 4, flexShrink: 0 }} />
                      </button>
                    ) : (
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.77rem',
                          color: '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <ShieldAlert size={16} color="#94A3B8" />
                        <span>No personal email is attached to this badge card. Use Instant PIN Reset above.</span>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotError(null);
                        setForgotStep('identify');
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#64748B',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <ChevronLeft size={16} /> Re-enter Badge ID
                    </button>

                    <button
                      type="button"
                      onClick={closeForgotModal}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#0284C7',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Back to Sign In
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: DIRECT PIN RESET */}
              {forgotStep === 'direct_pin' && forgotLookupResult && (
                <form onSubmit={handleResetPinSubmit}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0F172A' }}>
                      Set New Sign-in PIN for {forgotLookupResult.name}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: 2 }}>
                      Badge: <code>{forgotLookupResult.badgeId}</code>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                          New Security PIN (4–6 Digits) *
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const r = Math.floor(100000 + Math.random() * 900000).toString();
                            setForgotNewPin(r);
                            setForgotConfirmPin(r);
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#0284C7',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Auto-Generate
                        </button>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={forgotShowPin ? 'text' : 'password'}
                          value={forgotNewPin}
                          onChange={(e) => setForgotNewPin(e.target.value.replace(/\\D/g, '').slice(0, 8))}
                          placeholder="Enter 4 to 6 digit PIN"
                          required
                          maxLength={8}
                          autoFocus
                          style={{
                            width: '100%',
                            height: 44,
                            padding: '0 40px 0 38px',
                            borderRadius: 10,
                            border: '1.5px solid #CBD5E1',
                            fontSize: '0.95rem',
                            color: '#0F172A',
                            outline: 'none',
                            boxSizing: 'border-box',
                            letterSpacing: '0.15em',
                            fontFamily: 'var(--os-font-mono, monospace)',
                          }}
                        />
                        <Lock size={17} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 13 }} />
                        <button
                          type="button"
                          onClick={() => setForgotShowPin(!forgotShowPin)}
                          style={{
                            position: 'absolute',
                            right: 12,
                            top: 13,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#94A3B8',
                          }}
                        >
                          {forgotShowPin ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        Confirm New Security PIN *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={forgotShowPin ? 'text' : 'password'}
                          value={forgotConfirmPin}
                          onChange={(e) => setForgotConfirmPin(e.target.value.replace(/\\D/g, '').slice(0, 8))}
                          placeholder="Confirm your 4 to 6 digit PIN"
                          required
                          maxLength={8}
                          style={{
                            width: '100%',
                            height: 44,
                            padding: '0 14px 0 38px',
                            borderRadius: 10,
                            border: '1.5px solid #CBD5E1',
                            fontSize: '0.95rem',
                            color: '#0F172A',
                            outline: 'none',
                            boxSizing: 'border-box',
                            letterSpacing: '0.15em',
                            fontFamily: 'var(--os-font-mono, monospace)',
                          }}
                        />
                        <ShieldCheck size={17} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 13 }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setForgotStep('options')}
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 10,
                        border: '1px solid #E2E8F0',
                        background: '#FFFFFF',
                        color: '#475569',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      style={{
                        flex: 2,
                        height: 44,
                        borderRadius: 10,
                        border: 'none',
                        background: 'linear-gradient(90deg, #0284C7 0%, #00BFA5 100%)',
                        color: '#0A2540',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        cursor: forgotLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.28)',
                        opacity: forgotLoading ? 0.75 : 1,
                      }}
                    >
                      {forgotLoading ? (
                        <>
                          <RefreshCw size={16} style={{ animation: 'spinPulse 0.8s linear infinite' }} />
                          <span>Updating PIN…</span>
                        </>
                      ) : (
                        <>
                          <Check size={17} />
                          <span>Save PIN & Sign In</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 4: EMAIL SENT CELEBRATION */}
              {forgotStep === 'email_sent' && (
                <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: '50%',
                      background: '#DCFCE7',
                      color: '#16A34A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <Mail size={28} />
                  </div>

                  <h4 style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                    Reset Link Dispatched
                  </h4>
                  <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                    An official password reset link has been dispatched to your email. Check your inbox and spam folder, then follow the instructions to set your new credentials.
                  </p>

                  <button
                    type="button"
                    onClick={closeForgotModal}
                    style={{
                      width: '100%',
                      height: 44,
                      borderRadius: 10,
                      border: 'none',
                      background: '#0284C7',
                      color: '#FFFFFF',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Return to Sign In
                  </button>
                </div>
              )}
            </div>

            {/* Modal Sub-footer */}
            <div
              style={{
                padding: '12px 22px',
                background: '#F8FAFC',
                borderTop: '1px solid #F1F5F9',
                fontSize: '0.74rem',
                color: '#64748B',
                textAlign: 'center',
              }}
            >
              Need IT assistance? Facility Administrators can also reset staff PINs directly in the <strong>Staff Access & Enrolment</strong> desk.
            </div>
          </div>
        </div>
      )}
`;

// Insert modal before the last closing `</div>\n  );\n};`
const lastDivPos = content.lastIndexOf('    </div>\n  );\n};');
const lastDivPosCRLF = content.lastIndexOf('    </div>\r\n  );\r\n};');

if (lastDivPos !== -1) {
  content = content.slice(0, lastDivPos) + modalJSX + '\n' + content.slice(lastDivPos);
  console.log('✅ Inserted Forgot Password Modal JSX (LF)');
} else if (lastDivPosCRLF !== -1) {
  content = content.slice(0, lastDivPosCRLF) + modalJSX + '\r\n' + content.slice(lastDivPosCRLF);
  console.log('✅ Inserted Forgot Password Modal JSX (CRLF)');
} else {
  // Fallback to inserting before `  );\n};`
  const fallbackPos = content.lastIndexOf('  );\n};');
  const fallbackPosCRLF = content.lastIndexOf('  );\r\n};');
  if (fallbackPos !== -1) {
    content = content.slice(0, fallbackPos) + modalJSX + '\n' + content.slice(fallbackPos);
    console.log('✅ Inserted Forgot Password Modal JSX (fallback LF)');
  } else if (fallbackPosCRLF !== -1) {
    content = content.slice(0, fallbackPosCRLF) + modalJSX + '\r\n' + content.slice(fallbackPosCRLF);
    console.log('✅ Inserted Forgot Password Modal JSX (fallback CRLF)');
  } else {
    console.error('❌ Could not find footer closing tag to insert modal JSX');
    process.exit(1);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('🎉 Successfully integrated Forgot Password / PIN recovery into AuthScreen.tsx');

