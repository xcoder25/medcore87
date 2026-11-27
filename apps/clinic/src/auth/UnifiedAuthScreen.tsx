import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Persona } from '../rbac/permissions';
import type { PatientSession, StaffSession } from './sessionTypes';
import {
  AKWA_IBOM_HOSPITALS,
  CLINICAL_ROLES,
} from '../components/auth/StaffAuthScreen';
import {
  AmbientGlowBackdrop,
  GlowButton,
  LiquidGlassCard,
} from '../components/ui/LiquidGlass';
import { MedIcon } from '../components/ui/PremiumIcons';
import { C } from '../theme';
import {
  getEmrBaseUrl,
  registerPatientWithEmr,
  requestAdminEmailOtp,
  requestPatientOtp,
  setEmrBaseUrl,
  verifyAdminEmailOtp,
  verifyAdminOfflineCode,
  verifyEmrStaffLogin,
  verifyPatientOtp,
} from '../services/emrSyncClient';

const clinicLogo = require('../assets/logo.png');
const ariseLogo = require('../assets/arise_logo.png');

interface UnifiedAuthScreenProps {
  onStaffLogin: (session: StaffSession) => void;
  onPatientAuth: (session: PatientSession) => void;
}

const MOBILE_HOSPITALS = [
  { id: 'IGH-EKT', name: 'Immanuel General Hospital, Eket', short: 'IGH Eket' },
  ...AKWA_IBOM_HOSPITALS.filter((h) => h.id !== 'IGH-EKT'),
];

export const UnifiedAuthScreen: React.FC<UnifiedAuthScreenProps> = ({
  onStaffLogin,
  onPatientAuth,
}) => {
  const [persona, setPersona] = useState<Persona>('staff');
  const [patientMode, setPatientMode] = useState<'login' | 'signup'>('login');
  const [hospitalIdx, setHospitalIdx] = useState(0);
  const [showServerCfg, setShowServerCfg] = useState(false);
  const [emrUrlInput, setEmrUrlInput] = useState(() => getEmrBaseUrl());

  // Staff / Facility Admin EMR credentials
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [offlineRoleIdx, setOfflineRoleIdx] = useState(0);
  const [offerOfflineFallback, setOfferOfflineFallback] = useState(false);

  // Patient sign-in / sign-up fields
  const [patName, setPatName] = useState('');
  const [patCardOrPhone, setPatCardOrPhone] = useState('');
  const [patEmail, setPatEmail] = useState('');
  const [patOtpSent, setPatOtpSent] = useState(false);
  const [patOtpCode, setPatOtpCode] = useState('');
  const [patOtpPreview, setPatOtpPreview] = useState<string | null>(null);

  // Admin 2FA state
  const [pendingAdminSession, setPendingAdminSession] = useState<StaffSession | null>(null);
  const [adminMfaTab, setAdminMfaTab] = useState<'email_otp' | 'offline_code'>('email_otp');
  const [adminOtpInput, setAdminOtpInput] = useState('');
  const [adminOtpMasked, setAdminOtpMasked] = useState<string | null>(null);
  const [adminOtpPreview, setAdminOtpPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const heroFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroFloat, { toValue: -5, duration: 2400, useNativeDriver: true }),
        Animated.timing(heroFloat, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [heroFloat]);

  const hospital = MOBILE_HOSPITALS[hospitalIdx] || MOBILE_HOSPITALS[0];

  const handleSaveServerUrl = () => {
    setEmrBaseUrl(emrUrlInput);
    setShowServerCfg(false);
    setInfoMsg(
      emrUrlInput.trim()
        ? `Connected EMR endpoint: ${emrUrlInput.trim()}`
        : 'EMR endpoint cleared (using device default).'
    );
  };

  const handleStaffSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setOfferOfflineFallback(false);

    const cleanId = identifier.trim();
    const cleanPin = pin.trim();
    if (!cleanId) {
      setErrorMsg('Enter your MedCore OS Badge ID (e.g. IGH-ADM-01) or work email.');
      return;
    }
    if (cleanPin.length < 6) {
      setErrorMsg('Enter your 6-digit MedCore EMR PIN.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyEmrStaffLogin({
        facilityId: hospital.id,
        identifier: cleanId,
        pin: cleanPin,
      });

      if (res.verified && res.staff) {
        const s = res.staff;
        const staffSession: StaffSession = {
          staffId: s.badgeId,
          name: s.name,
          role: s.role,
          roleKey: s.roleKey,
          title: s.title,
          facilityId: s.facilityId || hospital.id,
          facility:
            MOBILE_HOSPITALS.find((h) => h.id === s.facilityId)?.name || hospital.name,
          department: s.department || 'Clinical Operations',
          email: s.email,
          clearanceLevel: s.clearanceLevel,
          sessionToken: res.sessionToken,
          emrSynced: true,
          avatarInitials: s.name.slice(0, 2).toUpperCase(),
          shift: 'Active EMR Shift',
        };
        const needsAdmin2fa =
          s.roleKey === 'hospital_admin' ||
          s.roleKey === 'sysadmin' ||
          s.roleKey === 'medical_director' ||
          (s.clearanceLevel || 0) >= 4;

        if (needsAdmin2fa) {
          setPendingAdminSession(staffSession);
          setAdminOtpInput('');
          setAdminMfaTab('email_otp');
          const otpRes = await requestAdminEmailOtp({
            facilityId: staffSession.facilityId,
            badgeId: staffSession.staffId,
            staffName: staffSession.name,
            email: staffSession.email,
          });
          setAdminOtpMasked(otpRes.maskedEmail || staffSession.email || 'staff email');
          setAdminOtpPreview(otpRes.devPreviewCode || null);
          setInfoMsg(
            otpRes.ok
              ? `Admin 2FA: Verification code sent to ${otpRes.maskedEmail || 'your staff email'}.`
              : `${otpRes.error || 'Email delivery unavailable'} — use Offline Admin Code tab.`
          );
          if (!otpRes.ok) setAdminMfaTab('offline_code');
          return;
        }

        onStaffLogin(staffSession);
        return;
      }

      if (res.networkOffline) {
        setOfferOfflineFallback(true);
        setErrorMsg(
          `${res.error || 'EMR server unreachable.'} Configure the EMR URL above or enter Offline Field Shift below.`
        );
        return;
      }

      setErrorMsg(res.error || 'Invalid MedCore EMR Staff ID / Email or PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineStaffEntry = () => {
    const role = CLINICAL_ROLES[offlineRoleIdx] || CLINICAL_ROLES[0];
    const cleanId = identifier.trim() || `${hospital.id}-${role.key.toUpperCase()}-OFF`;
    onStaffLogin({
      staffId: cleanId.toUpperCase(),
      name: cleanId.includes('@') ? cleanId.split('@')[0] : `${role.short} (Offline)`,
      role: role.title,
      roleKey: role.key,
      title: role.title,
      facilityId: hospital.id,
      facility: hospital.name,
      department: `${role.dept} · Offline Cache`,
      email: cleanId.includes('@') ? cleanId.toLowerCase() : undefined,
      clearanceLevel: role.key === 'hospital_admin' ? 5 : 2,
      emrSynced: false,
      avatarInitials: cleanId.slice(0, 2).toUpperCase(),
      shift: 'Offline Field Shift',
    });
  };

  const handleVerifyAdmin2fa = async () => {
    if (!pendingAdminSession) return;
    setErrorMsg(null);
    const clean = adminOtpInput.replace(/\D/g, '').trim();
    if (clean.length !== 6) {
      setErrorMsg('Enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const verifier =
        adminMfaTab === 'email_otp' ? verifyAdminEmailOtp : verifyAdminOfflineCode;
      const res = await verifier({
        facilityId: pendingAdminSession.facilityId,
        badgeId: pendingAdminSession.staffId,
        code: clean,
      });
      if (!res.verified) {
        setErrorMsg(res.error || 'Invalid 2FA verification code.');
        return;
      }
      const verifiedSession = pendingAdminSession;
      setPendingAdminSession(null);
      setAdminOtpInput('');
      setAdminOtpPreview(null);
      onStaffLogin(verifiedSession);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSubmit = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    const cleanName = patName.trim();
    const cleanCardOrPhone = patCardOrPhone.trim();
    const cleanEmail = patEmail.trim().toLowerCase();

    if (patientMode === 'signup') {
      if (cleanName.length < 2) {
        setErrorMsg('Please enter your full name to create your patient account.');
        return;
      }
      if (cleanCardOrPhone.replace(/\D/g, '').length < 7 && !cleanEmail.includes('@')) {
        setErrorMsg('Enter a valid phone number or email address for appointment sync.');
        return;
      }
      setLoading(true);
      try {
        const reg = await registerPatientWithEmr({
          fullName: cleanName,
          phone: cleanCardOrPhone.replace(/\D/g, '').length >= 7 ? cleanCardOrPhone : undefined,
          email: cleanEmail || undefined,
          facilityId: hospital.id,
          facilityName: hospital.name,
        });
        if (!reg.ok) {
          setErrorMsg(reg.error || 'Could not create patient account.');
          return;
        }
        onPatientAuth({
          persona: 'patient',
          patientId: reg.patientId,
          shid: reg.shid,
          name: cleanName,
          facilityId: hospital.id,
          facility: hospital.name,
          phone: cleanCardOrPhone || undefined,
          email: cleanEmail || undefined,
          emrSynced: reg.emrSynced,
        });
        return;
      } finally {
        setLoading(false);
      }
    }

    // Patient Sign In with EMR OTP Verification
    if (!cleanCardOrPhone && cleanName.length < 2) {
      setErrorMsg('Enter your Patient ID / SHID or phone number to sign in.');
      return;
    }

    const base = getEmrBaseUrl();
    if (base && !patOtpSent) {
      setLoading(true);
      try {
        const otpRes = await requestPatientOtp({
          identifier: cleanCardOrPhone || cleanName,
          facilityId: hospital.id,
        });
        if (otpRes.ok) {
          setPatOtpSent(true);
          setPatOtpCode('');
          setPatOtpPreview(otpRes.devPreviewCode || null);
          setInfoMsg(`6-digit Care OTP sent to ${otpRes.maskedTarget || cleanCardOrPhone}.`);
          return;
        }
      } finally {
        setLoading(false);
      }
    }

    if (base && patOtpSent) {
      if (patOtpCode.replace(/\D/g, '').length !== 6) {
        setErrorMsg('Enter the 6-digit Care verification code.');
        return;
      }
      setLoading(true);
      try {
        const verifyRes = await verifyPatientOtp({
          identifier: cleanCardOrPhone || cleanName,
          code: patOtpCode.trim(),
          facilityId: hospital.id,
          facilityName: hospital.name,
        });
        if (!verifyRes.verified || !verifyRes.patient) {
          setErrorMsg(verifyRes.error || 'Invalid Patient Care OTP.');
          return;
        }
        const p = verifyRes.patient;
        onPatientAuth({
          persona: 'patient',
          patientId: p.patientId,
          shid: p.shid,
          name: cleanName || p.fullName,
          facilityId: p.facilityId || hospital.id,
          facility: p.facilityName || hospital.name,
          phone: p.phone,
          email: p.email,
          emrSynced: true,
        });
        return;
      } finally {
        setLoading(false);
      }
    }

    const isPhone = /^\+?[0-9\s-]{7,}$/.test(cleanCardOrPhone);
    onPatientAuth({
      persona: 'patient',
      patientId: isPhone
        ? `PAT-${hospital.id.slice(-3)}-${cleanCardOrPhone.replace(/\D/g, '').slice(-5)}`
        : cleanCardOrPhone.toUpperCase() || `PAT-${hospital.id.slice(-3)}-001`,
      shid: cleanCardOrPhone.toUpperCase().startsWith('SHID') ? cleanCardOrPhone.toUpperCase() : undefined,
      name: cleanName || 'Patient Portal Member',
      facilityId: hospital.id,
      facility: hospital.name,
      phone: isPhone ? cleanCardOrPhone : undefined,
      emrSynced: Boolean(base),
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AmbientGlowBackdrop variant={persona === 'patient' ? 'care' : 'auth'} />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
          >
            {/* Top Bar */}
            <View style={styles.topBar}>
              <Image source={ariseLogo} style={styles.ariseLogo} resizeMode="contain" />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  onPress={() => setShowServerCfg((v) => !v)}
                  style={styles.iconPill}
                >
                  <MedIcon name="settings" size={14} color="#7DD3FC" badge={false} />
                  <Text style={styles.iconPillText}>EMR Sync</Text>
                </Pressable>
                <View style={styles.stateBadge}>
                  <Text style={styles.stateBadgeText}>AKS RBAC</Text>
                </View>
              </View>
            </View>

            {/* Server URL Configuration Drawer */}
            {showServerCfg && (
              <LiquidGlassCard glowColor={C.glowCyan} style={{ marginBottom: 14 }}>
                <Text style={styles.cardHeading}>MedCore OS EMR Endpoint</Text>
                <Text style={styles.cardHint}>
                  Point mobile directly at your MedCore OS server (Cloud URL or Hospital LAN IP) for live authentication &amp; sync.
                </Text>
                <TextInput
                  style={styles.glassInput}
                  value={emrUrlInput}
                  onChangeText={setEmrUrlInput}
                  placeholder="https://your-medcore-os.vercel.app or http://localhost:3003"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                />
                <GlowButton
                  label="Save EMR Endpoint"
                  icon="sync"
                  variant="primary"
                  onPress={handleSaveServerUrl}
                />
              </LiquidGlassCard>
            )}

            {/* Liquid Hero Emblem */}
            <Animated.View style={[styles.heroBlock, { transform: [{ translateY: heroFloat }] }]}>
              <View style={styles.emblemOuter}>
                <View style={styles.emblemRim} />
                <Image source={clinicLogo} style={styles.logoImg} resizeMode="contain" />
              </View>
              <Text style={styles.brandTitle}>MedCore Mobile</Text>
              <Text style={styles.brandSub}>
                Unified RBAC Clinical &amp; Patient Portal · Synced with MedCore EMR
              </Text>
            </Animated.View>

            {/* Persona Segmented Switcher */}
            <LiquidGlassCard
              glowColor={persona === 'staff' ? C.glowBlue : C.glowEmerald}
              intensity="strong"
              animateIn
              style={{ marginBottom: 14 }}
            >
              <View style={styles.personaTabs}>
                <Pressable
                  onPress={() => {
                    setPersona('staff');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  style={[styles.personaTab, persona === 'staff' && styles.personaTabStaff]}
                >
                  <MedIcon
                    name="shield"
                    size={15}
                    color={persona === 'staff' ? '#FFFFFF' : '#94A3B8'}
                    badge={false}
                  />
                  <Text
                    style={[
                      styles.personaTabText,
                      persona === 'staff' && { color: '#FFFFFF' },
                    ]}
                  >
                    Staff &amp; Admin (EMR)
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setPersona('patient');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  style={[styles.personaTab, persona === 'patient' && styles.personaTabPatient]}
                >
                  <MedIcon
                    name="heart"
                    size={15}
                    color={persona === 'patient' ? '#FFFFFF' : '#94A3B8'}
                    badge={false}
                  />
                  <Text
                    style={[
                      styles.personaTabText,
                      persona === 'patient' && { color: '#FFFFFF' },
                    ]}
                  >
                    Patient Portal
                  </Text>
                </Pressable>
              </View>

              {/* Facility Picker */}
              <Text style={styles.label}>HOSPITAL FACILITY</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
              >
                {MOBILE_HOSPITALS.map((h, i) => {
                  const sel = i === hospitalIdx;
                  return (
                    <TouchableOpacity
                      key={h.id}
                      onPress={() => setHospitalIdx(i)}
                      style={[
                        styles.facChip,
                        sel && {
                          backgroundColor:
                            persona === 'staff'
                              ? 'rgba(56, 189, 248, 0.22)'
                              : 'rgba(16, 185, 129, 0.22)',
                          borderColor: persona === 'staff' ? C.glowBlue : C.glowEmerald,
                        },
                      ]}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.facChipText, sel && { color: '#FFFFFF' }]}>
                        {h.short}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {errorMsg && (
                <View style={styles.errBox}>
                  <Text style={styles.errText}>{errorMsg}</Text>
                </View>
              )}
              {infoMsg && (
                <View style={styles.okBox}>
                  <Text style={styles.okText}>{infoMsg}</Text>
                </View>
              )}

              {/* STAFF & ADMIN EMR SIGN IN */}
              {persona === 'staff' ? (
                <View>
                  <View style={styles.boundaryNotice}>
                    <MedIcon name="lock" size={14} color="#7DD3FC" badge={false} />
                    <Text style={styles.boundaryText}>
                      Sign in with your MedCore OS EMR Badge ID / Email &amp; PIN. Admin accounts can enrol staff for their facility; high-privilege audit &amp; treasury controls remain Desktop EMR Only.
                    </Text>
                  </View>

                  <Text style={styles.label}>EMR STAFF ID OR WORK EMAIL</Text>
                  <TextInput
                    style={styles.glassInput}
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder="e.g. IGH-ADM-01 or doctor@hospital.aks.gov.ng"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                  />

                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>6-DIGIT EMR PIN</Text>
                    <Pressable onPress={() => setShowPin((v) => !v)}>
                      <Text style={styles.toggleLink}>{showPin ? 'Hide' : 'Show'}</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={styles.glassInput}
                    value={pin}
                    onChangeText={setPin}
                    placeholder="••••••"
                    placeholderTextColor="#64748B"
                    secureTextEntry={!showPin}
                    keyboardType="numeric"
                    maxLength={12}
                  />

                  <GlowButton
                    label="Sign In with EMR Credentials"
                    icon="shield"
                    variant="primary"
                    loading={loading}
                    onPress={handleStaffSignIn}
                  />

                  {pendingAdminSession && (
                    <View style={[styles.offlineCard, { borderColor: C.glowBlue, backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                      <Text style={[styles.offlineTitle, { color: '#BAE6FD' }]}>
                        Admin 2FA Verification Required · {pendingAdminSession.staffId}
                      </Text>
                      <View style={[styles.subSegment, { marginTop: 8 }]}>
                        <Pressable
                          onPress={() => setAdminMfaTab('email_otp')}
                          style={[styles.subSegBtn, adminMfaTab === 'email_otp' && styles.subSegBtnActive]}
                        >
                          <Text style={[styles.subSegText, adminMfaTab === 'email_otp' && { color: '#FFFFFF' }]}>
                            Email OTP ({adminOtpMasked || 'EMR'})
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setAdminMfaTab('offline_code')}
                          style={[styles.subSegBtn, adminMfaTab === 'offline_code' && styles.subSegBtnActive]}
                        >
                          <Text style={[styles.subSegText, adminMfaTab === 'offline_code' && { color: '#FFFFFF' }]}>
                            Offline Admin Code
                          </Text>
                        </Pressable>
                      </View>
                      {adminOtpPreview && adminMfaTab === 'email_otp' && (
                        <Text style={[styles.okText, { marginBottom: 8 }]}>
                          Preview OTP (SMTP Dev Fallback): {adminOtpPreview}
                        </Text>
                      )}
                      <TextInput
                        style={styles.glassInput}
                        value={adminOtpInput}
                        onChangeText={setAdminOtpInput}
                        placeholder="Enter 6-digit 2FA code"
                        placeholderTextColor="#64748B"
                        keyboardType="numeric"
                        maxLength={6}
                      />
                      <GlowButton
                        label={loading ? 'Verifying 2FA…' : 'Verify Admin 2FA & Enter Hub'}
                        icon="check"
                        variant="primary"
                        loading={loading}
                        onPress={handleVerifyAdmin2fa}
                      />
                    </View>
                  )}

                  {offerOfflineFallback && (
                    <View style={styles.offlineCard}>
                      <Text style={styles.offlineTitle}>Offline Field Shift Fallback</Text>
                      <Text style={styles.offlineDesc}>
                        Select your assigned role to continue offline while EMR sync reconnects:
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginVertical: 10 }}
                      >
                        {CLINICAL_ROLES.map((r, idx) => {
                          const sel = idx === offlineRoleIdx;
                          return (
                            <TouchableOpacity
                              key={r.key}
                              onPress={() => setOfflineRoleIdx(idx)}
                              style={[
                                styles.facChip,
                                sel && {
                                  backgroundColor: 'rgba(251, 191, 36, 0.2)',
                                  borderColor: C.glowAmber,
                                },
                              ]}
                            >
                              <Text style={[styles.facChipText, sel && { color: '#FDE68A' }]}>
                                {r.short}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      <GlowButton
                        label="Enter Offline Field Mode"
                        icon="activity"
                        variant="glass"
                        onPress={handleOfflineStaffEntry}
                      />
                    </View>
                  )}
                </View>
              ) : (
                /* PATIENT SIGN IN & SELF SIGNUP */
                <View>
                  <View style={styles.subSegment}>
                    <Pressable
                      onPress={() => {
                        setPatientMode('login');
                        setErrorMsg(null);
                      }}
                      style={[
                        styles.subSegBtn,
                        patientMode === 'login' && styles.subSegBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.subSegText,
                          patientMode === 'login' && { color: '#FFFFFF' },
                        ]}
                      >
                        Sign In
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setPatientMode('signup');
                        setErrorMsg(null);
                      }}
                      style={[
                        styles.subSegBtn,
                        patientMode === 'signup' && styles.subSegBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.subSegText,
                          patientMode === 'signup' && { color: '#FFFFFF' },
                        ]}
                      >
                        Create Account
                      </Text>
                    </Pressable>
                  </View>

                  {patientMode === 'signup' && (
                    <>
                      <Text style={styles.label}>FULL NAME *</Text>
                      <TextInput
                        style={styles.glassInput}
                        value={patName}
                        onChangeText={setPatName}
                        placeholder="e.g. Iniobong Udoh"
                        placeholderTextColor="#64748B"
                      />
                    </>
                  )}

                  <Text style={styles.label}>
                    {patientMode === 'signup' ? 'PHONE NUMBER *' : 'SHID / PATIENT ID OR PHONE *'}
                  </Text>
                  <TextInput
                    style={styles.glassInput}
                    value={patCardOrPhone}
                    onChangeText={setPatCardOrPhone}
                    placeholder={
                      patientMode === 'signup'
                        ? '08012345678'
                        : 'SHID-AKS-XXXXXX or 08012345678'
                    }
                    placeholderTextColor="#64748B"
                    autoCapitalize="characters"
                  />

                  {patientMode === 'signup' && (
                    <>
                      <Text style={styles.label}>EMAIL (OPTIONAL)</Text>
                      <TextInput
                        style={styles.glassInput}
                        value={patEmail}
                        onChangeText={setPatEmail}
                        placeholder="patient@email.com"
                        placeholderTextColor="#64748B"
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    </>
                  )}

                  {patientMode === 'login' && (
                    <>
                      <Text style={styles.label}>FULL NAME (OPTIONAL)</Text>
                      <TextInput
                        style={styles.glassInput}
                        value={patName}
                        onChangeText={setPatName}
                        placeholder="Display name"
                        placeholderTextColor="#64748B"
                      />
                      {patOtpSent && (
                        <>
                          {patOtpPreview && (
                            <Text style={[styles.okText, { marginBottom: 8 }]}>
                              Verification Code (SMS/Email Dev Fallback): {patOtpPreview}
                            </Text>
                          )}
                          <Text style={styles.label}>6-DIGIT CARE VERIFICATION CODE *</Text>
                          <TextInput
                            style={styles.glassInput}
                            value={patOtpCode}
                            onChangeText={setPatOtpCode}
                            placeholder="123456"
                            placeholderTextColor="#64748B"
                            keyboardType="numeric"
                            maxLength={6}
                          />
                        </>
                      )}
                    </>
                  )}

                  <GlowButton
                    label={
                      patientMode === 'signup'
                        ? 'Create Account & Sync to EMR'
                        : patOtpSent
                        ? 'Verify Code & Open Portal'
                        : getEmrBaseUrl()
                        ? 'Send Verification Code'
                        : 'Open Patient Portal'
                    }
                    icon={patientMode === 'signup' ? 'user-plus' : 'arrow-right'}
                    variant="emerald"
                    loading={loading}
                    onPress={handlePatientSubmit}
                  />
                </View>
              )}
            </LiquidGlassCard>

            <Text style={styles.footer}>
              Encrypted RBAC Session · Bidirectional Hospital EMR Sync
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvas },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ariseLogo: { width: 76, height: 28 },
  iconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 165, 233, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  iconPillText: { color: '#7DD3FC', fontSize: 11, fontWeight: '700' },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  stateBadgeText: { color: '#E2E8F0', fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  heroBlock: { alignItems: 'center', marginVertical: 12 },
  emblemOuter: {
    width: 78,
    height: 78,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    overflow: 'hidden',
  },
  emblemRim: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    height: '42%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  logoImg: { width: 52, height: 52 },
  brandTitle: { color: '#FFFFFF', fontSize: 27, fontWeight: '800', letterSpacing: 0.3 },
  brandSub: {
    color: '#94A3B8',
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 18,
  },
  cardHeading: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  cardHint: { color: '#94A3B8', fontSize: 11.5, marginBottom: 10, lineHeight: 16 },
  personaTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14,
  },
  personaTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  personaTabStaff: {
    backgroundColor: 'rgba(37, 99, 235, 0.72)',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  personaTabPatient: {
    backgroundColor: 'rgba(5, 150, 105, 0.75)',
    shadowColor: '#10B981',
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  personaTabText: { color: '#94A3B8', fontSize: 12.5, fontWeight: '800' },
  label: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLink: { color: '#38BDF8', fontSize: 11.5, fontWeight: '700', marginBottom: 6 },
  facChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginRight: 7,
  },
  facChipText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  glassInput: {
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 12,
  },
  boundaryNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
    marginBottom: 12,
  },
  boundaryText: { flex: 1, color: '#BAE6FD', fontSize: 11.5, lineHeight: 16.5 },
  errBox: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 63, 94, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.45)',
    marginBottom: 12,
  },
  errText: { color: '#FECDD3', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  okBox: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    marginBottom: 12,
  },
  okText: { color: '#A7F3D0', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  offlineCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  offlineTitle: { color: '#FDE68A', fontSize: 12.5, fontWeight: '800' },
  offlineDesc: { color: '#FCD34D', fontSize: 11, marginTop: 2 },
  subSegment: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  subSegBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  subSegBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderColor: C.glowEmerald,
  },
  subSegText: { color: '#94A3B8', fontSize: 12.5, fontWeight: '800' },
  footer: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 16,
  },
});

export default UnifiedAuthScreen;
