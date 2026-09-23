'use client';

import React, { useState } from 'react';
import { 
  User, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, 
  CheckCircle2, AlertCircle, Sparkles, Building2, ChevronRight
} from 'lucide-react';

export interface MOHOfficerSession {
  id: string;
  name: string;
  role: string;
  department: string;
  badgeId: string;
  clearanceLevel: number;
  jurisdiction: string;
  avatarInitials: string;
  authMethod: string;
  token: string;
  loginTime: string;
}

interface MOHAuthScreenProps {
  onLoginSuccess: (session: MOHOfficerSession) => void;
}

interface OfficerPreset {
  id: string;
  name: string;
  role: string;
  department: string;
  badgeId: string;
  clearanceLevel: number;
  jurisdiction: string;
  avatarInitials: string;
  email: string;
}

const AKWA_IBOM_OFFICERS: OfficerPreset[] = [
  {
    id: 'AKSG-MOH-001',
    name: 'Hon. Commissioner for Health',
    role: 'Honourable Commissioner for Health',
    department: 'Office of the Honourable Commissioner',
    badgeId: 'AKSG-CABINET-01',
    clearanceLevel: 5,
    jurisdiction: 'All 31 Local Government Areas',
    avatarInitials: 'HC',
    email: 'commissioner@akwaibomstate.gov.ng',
  },
  {
    id: 'AKSG-MOH-012',
    name: 'Dr. Ekemini Bassey',
    role: 'Director of Public Health & Disease Surveillance',
    department: 'Directorate of Public Health',
    badgeId: 'AKSG-PUBHLTH-012',
    clearanceLevel: 4,
    jurisdiction: 'Uyo Senatorial District',
    avatarInitials: 'EB',
    email: 'e.bassey@akwaibomstate.gov.ng',
  },
  {
    id: 'AKSG-HMB-004',
    name: 'Dr. Anietie Udoh',
    role: 'Executive Secretary, Hospitals Management Board',
    department: 'Akwa Ibom Hospitals Management Board',
    badgeId: 'AKSG-HMB-004',
    clearanceLevel: 4,
    jurisdiction: 'Ikot Ekpene & Eket Districts',
    avatarInitials: 'AU',
    email: 'a.udoh@akwaibomstate.gov.ng',
  },
  {
    id: 'AKSG-MOH-029',
    name: 'Dr. Idongesit Akpan',
    role: 'Director of Medical Services & Hospital Inspection',
    department: 'Directorate of Medical Services & Licensing',
    badgeId: 'AKSG-MEDSERV-029',
    clearanceLevel: 4,
    jurisdiction: 'Statewide Hospital Licensing',
    avatarInitials: 'IA',
    email: 'i.akpan@akwaibomstate.gov.ng',
  },
];

export const MOHAuthScreen: React.FC<MOHAuthScreenProps> = ({ onLoginSuccess }) => {
  const [selectedOfficer, setSelectedOfficer] = useState<OfficerPreset>(AKWA_IBOM_OFFICERS[0]);
  const [username, setUsername] = useState(AKWA_IBOM_OFFICERS[0].email);
  const [password, setPassword] = useState('••••••••••••');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  const handleSelectOfficer = (officer: OfficerPreset) => {
    setSelectedOfficer(officer);
    setUsername(officer.email);
    setPassword('••••••••••••');
    setErrorMsg(null);
    setInfoNotice(`Selected: ${officer.name} (${officer.role})`);
    setTimeout(() => setInfoNotice(null), 3000);
  };

  const executeLogin = (method: string) => {
    setIsLoading(true);
    setErrorMsg(null);

    setTimeout(() => {
      const session: MOHOfficerSession = {
        id: selectedOfficer.id,
        name: selectedOfficer.name,
        role: selectedOfficer.role,
        department: selectedOfficer.department,
        badgeId: selectedOfficer.badgeId,
        clearanceLevel: selectedOfficer.clearanceLevel,
        jurisdiction: selectedOfficer.jurisdiction,
        avatarInitials: selectedOfficer.avatarInitials,
        authMethod: method,
        token: `AKSG-MOH-${Date.now().toString(36).toUpperCase()}`,
        loginTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      };

      try {
        localStorage.setItem('medcore_moh_session', JSON.stringify(session));
      } catch {
        // ignore
      }

      setIsLoading(false);
      onLoginSuccess(session);
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Please enter your official email or Civil Service username.');
      return;
    }
    executeLogin('Admin Portal Credentials');
  };

  const handleSecureAccess = () => {
    executeLogin('Biometric / State PKI Token');
  };

  const handleForgotPassword = () => {
    setInfoNotice('Password reset request has been routed to the State e-Government & ICT Directorate.');
    setTimeout(() => setInfoNotice(null), 4500);
  };

  return (
    <div className="arise-auth-page">
      {/* Left Pane: Hospital Hero & Ministry Slogan exactly from auth screen.png */}
      <div 
        className="arise-auth-left-hero" 
        role="img" 
        aria-label="Welcome to the Health Facility Management Admin Portal - Ministry of Health Akwa Ibom State" 
      />


      {/* Right Pane: Light Background with Corner Swoosh and Floating Sign-In Card */}
      <div className="arise-auth-right-pane">
        {/* Akwa Ibom Tri-Color Corner Swooshes */}
        <div className="arise-corner-swoosh-container" aria-hidden="true">
          <svg className="arise-corner-swoosh-svg" viewBox="0 0 450 450" fill="none">
            <path 
              d="M 50 450 C 220 400 360 260 450 60 L 450 450 Z" 
              fill="#EA580C" 
            />
            <path 
              d="M 120 450 C 260 390 380 240 450 110 L 450 450 Z" 
              fill="#F59E0B" 
            />
            <path 
              d="M 180 450 C 290 370 400 220 450 160 L 450 450 Z" 
              fill="#065F46" 
            />
          </svg>
        </div>

        {/* Floating White Auth Card */}
        <div className="arise-auth-card">
          {/* Card Header: ARISE Logo & Ministry Subtitle */}
          <div className="arise-card-brand">
            <img 
              src="/arise-logo.png" 
              alt="ARISE Agenda" 
              className="arise-card-logo-img" 
            />
            <h1 className="arise-card-dept-title">MINISTRY OF HEALTH</h1>
            <p className="arise-card-state-title">AKWA IBOM STATE</p>
          </div>

          {/* Headline & Subtitle */}
          <div className="arise-card-intro">
            <h2 className="arise-card-heading">Sign in to your admin account</h2>
            <p className="arise-card-subheading">
              Access the health facilities management system and oversee all facilities in the state.
            </p>
          </div>

          {/* Feedback Notices */}
          {errorMsg && (
            <div className="arise-alert-box error">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoNotice && (
            <div className="arise-alert-box info">
              <CheckCircle2 size={16} />
              <span>{infoNotice}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="arise-card-form">
            {/* Input 1: Username or Email */}
            <div className="arise-input-group">
              <div className="arise-input-icon">
                <User size={18} />
              </div>
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username or Email"
                className="arise-input-field"
                required
                autoComplete="username"
              />
            </div>

            {/* Input 2: Password */}
            <div className="arise-input-group">
              <div className="arise-input-icon">
                <Lock size={18} />
              </div>
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="arise-input-field"
                required
                autoComplete="current-password"
              />
              <button 
                type="button" 
                className="arise-eye-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Options Row: Remember Me & Forgot Password */}
            <div className="arise-form-options">
              <label className="arise-remember-label">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="arise-checkbox"
                />
                <span>Remember me</span>
              </label>

              <button 
                type="button" 
                onClick={handleForgotPassword}
                className="arise-forgot-link"
              >
                Forgot password?
              </button>
            </div>

            {/* Primary Submit Button: Sign In -> */}
            <button 
              type="submit" 
              className="arise-btn-signin"
              disabled={isLoading}
            >
              {isLoading ? (
                <span>Verifying Credentials...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* OR Divider */}
          <div className="arise-divider">
            <span className="arise-divider-line" />
            <span className="arise-divider-text">OR</span>
            <span className="arise-divider-line" />
          </div>

          {/* Secondary Button: Secure Access */}
          <button 
            type="button" 
            className="arise-btn-secure"
            onClick={handleSecureAccess}
            disabled={isLoading}
          >
            <ShieldCheck size={18} />
            <span>Secure Access</span>
          </button>

          {/* Quick Officer Selector (for evaluation & instant switching) */}
          <div className="arise-quick-officers-section">
            <div className="arise-quick-header">
              <span>QUICK SIGN-IN AS ACCREDITED OFFICIAL:</span>
            </div>
            <div className="arise-officer-pills">
              {AKWA_IBOM_OFFICERS.map((officer) => {
                const isSelected = selectedOfficer.id === officer.id;
                return (
                  <button
                    key={officer.id}
                    type="button"
                    onClick={() => handleSelectOfficer(officer)}
                    className={`arise-officer-pill ${isSelected ? 'active' : ''}`}
                    title={`${officer.name} — ${officer.role}`}
                  >
                    <span className="arise-pill-dot" />
                    <span className="arise-pill-name">{officer.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card Footer: Ministry Seal & Version */}
          <div className="arise-card-footer">
            <Lock size={13} className="arise-footer-lock" />
            <span>Ministry of Health, Akwa Ibom State | Admin Portal v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
