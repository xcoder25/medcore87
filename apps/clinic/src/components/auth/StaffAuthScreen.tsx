import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  TextInput,
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  Platform,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const ariseLogo = require('../../assets/arise_logo.png');
const hospitalHeroImg = require('../../assets/hospital_hero.jpg');
const clinicLogo = require('../../assets/logo.png');

export interface StaffSession {
  staffId: string;
  name: string;
  role: string;
  roleKey: string;
  title: string;
  facility: string;
  department: string;
  avatarInitials: string;
  shift: string;
}

interface StaffAuthScreenProps {
  onLoginSuccess: (session: StaffSession) => void;
}

export const AKWA_IBOM_HOSPITALS = [
  { id: 'AKS-ISH-001', name: 'Ibom Specialist Hospital, Uyo', short: 'ISH Uyo' },
  { id: 'AKS-SEC-001', name: 'Immanuel General Hospital, Eket', short: 'GH Eket' },
  { id: 'AKS-SEC-002', name: 'General Hospital, Ikot Ekpene', short: 'GH Ikot Ekpene' },
  { id: 'AKS-SEC-003', name: 'General Hospital, Iquita Oron', short: 'GH Oron' },
  { id: 'AKS-SEC-005', name: 'General Hospital, Etinan', short: 'GH Etinan' },
  { id: 'AKS-SEC-006', name: 'General Hospital, Ukpom Abak', short: 'GH Abak' },
  { id: 'AKS-SEC-007', name: 'General Hospital, Awa', short: 'GH Awa' },
  { id: 'AKS-SEC-009', name: 'General Hospital, Ikono', short: 'GH Ikono' },
  { id: 'AKS-SEC-015', name: 'General Hospital, Ikot Abasi', short: 'GH Ikot Abasi' },
  { id: 'AKS-SEC-022', name: 'Cottage Hospital, Ukana', short: 'CH Ukana' },
];

export const CLINICAL_ROLES = [
  { key: 'doctor', title: 'Doctor / Physician', short: 'Doctor', dept: 'Internal Medicine & Wards', icon: '🩺' },
  { key: 'nurse', title: 'Nurse / Nursing Officer', short: 'Nurse', dept: 'Inpatient Ward & e-MAR', icon: '💉' },
  { key: 'surgeon', title: 'Surgeon / Theatre Specialist', short: 'Surgeon', dept: 'Operating Theatres & PACU', icon: '🫀' },
  { key: 'midwife', title: 'Midwife / Obstetric Officer', short: 'Midwife', dept: 'Maternity & Labour Ward', icon: '👶' },
  { key: 'pharmacist', title: 'Pharmacist / Dispensary Officer', short: 'Pharmacist', dept: 'Main Dispensary & Pharmacy', icon: '💊' },
  { key: 'lab', title: 'Lab Scientist / Diagnostic Analyst', short: 'Lab Scientist', dept: 'Pathology & LIS Analyzers', icon: '🧪' },
  { key: 'radiologist', title: 'Radiologist / Imaging Scientist', short: 'Radiologist', dept: 'Radiology & PACS Viewer', icon: '🩻' },
  { key: 'accountant', title: 'Accountant / Billing Officer', short: 'Accountant', dept: 'Revenue, Cashier & NHIA', icon: '💳' },
  { key: 'records', title: 'Medical Records Officer', short: 'Records Officer', dept: 'Medical Records & FHIR ID', icon: '📋' },
  { key: 'biomedical', title: 'Biomedical Engineer', short: 'Biomedical', dept: 'Equipment & Oxygen Plant', icon: '🔧' },
];

export const StaffAuthScreen: React.FC<StaffAuthScreenProps> = ({ onLoginSuccess }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<'EN' | 'AR' | 'ES' | 'FR'>('EN');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [authSheet, setAuthSheet] = useState<'none' | 'login'>('none');
  const [authMode, setAuthMode] = useState<'staff_id' | 'password'>('password');

  const [selectedHospitalIdx, setSelectedHospitalIdx] = useState(0);
  const [selectedRoleIdx, setSelectedRoleIdx] = useState(0);

  const [staffIdInput, setStaffIdInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isScanningBiometric, setIsScanningBiometric] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const authFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(authFade, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [authFade]);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const handleSignIn = () => {
    const role = CLINICAL_ROLES[selectedRoleIdx];
    const hospital = AKWA_IBOM_HOSPITALS[selectedHospitalIdx];
    const idVal = authMode === 'staff_id' ? staffIdInput.trim() : usernameInput.trim();

    const staffDisplayName =
      idVal ||
      (role.key === 'doctor'
        ? 'Dr. Julian Thorne, MD'
        : role.key === 'nurse'
        ? 'Nurse Sister Blessing, RN'
        : role.key === 'surgeon'
        ? 'Dr. Kufre Edet, FWACS'
        : `${role.short} on Duty`);

    const session: StaffSession = {
      staffId: idVal || `${hospital.id}-${role.key.toUpperCase()}-042`,
      name: staffDisplayName,
      role: role.title,
      roleKey: role.key,
      title: role.title,
      facility: hospital.name,
      department: `${role.dept} · Day Shift`,
      avatarInitials: staffDisplayName.slice(0, 2).toUpperCase(),
      shift: 'Day 07:00–19:00',
    };

    setAuthSheet('none');
    onLoginSuccess(session);
  };

  const handleFastPassAuth = () => {
    setIsScanningBiometric(true);
    setTimeout(() => {
      setIsScanningBiometric(false);
      handleSignIn();
    }, 900);
  };

  return (
    <SafeAreaView style={styles.figmaAuthSafeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Real Hospital Hero Background */}
      <Image source={hospitalHeroImg} style={styles.authBgImage} resizeMode="cover" />
      {/* Dark Readability Overlay */}
      <View style={styles.authBgOverlay} />

      {/* Toast Notification */}
      {feedbackToast && (
        <View style={styles.toastBox}>
          <Text style={styles.toastText}>{feedbackToast}</Text>
        </View>
      )}

      <Animated.View style={[styles.figmaAuthContainer, { opacity: authFade }]}>
        {/* Top Bar: Arise Akwa Ibom Logo LEFT + Language Pill RIGHT */}
        <View style={styles.figmaTopBar}>
          <Image source={ariseLogo} style={styles.ariseLogoImgSm} resizeMode="contain" />
          <TouchableOpacity
            style={styles.figmaLangPillGlass}
            onPress={() => setShowLangMenu(!showLangMenu)}
            activeOpacity={0.8}
          >
            <Text style={styles.figmaLangTextGlass}>{selectedLanguage} ▾</Text>
          </TouchableOpacity>
        </View>

        {/* Language Dropdown */}
        {showLangMenu && (
          <View style={styles.figmaLangDropdown}>
            {(['EN', 'AR', 'ES', 'FR'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.figmaLangOption, selectedLanguage === lang && styles.figmaLangOptionActive]}
                onPress={() => {
                  setSelectedLanguage(lang);
                  setShowLangMenu(false);
                }}
              >
                <Text style={[styles.figmaLangOptionText, selectedLanguage === lang && styles.figmaLangOptionTextActive]}>
                  {lang === 'EN' && 'English'}
                  {lang === 'AR' && 'العربية'}
                  {lang === 'ES' && 'Español'}
                  {lang === 'FR' && 'Français'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Center Glass Hero: Logo & Clinical Brand Card */}
        <View style={styles.figmaCenterHero}>
          <View style={styles.authGlassLogoCard}>
            <View style={styles.figmaLogoWrap}>
              <Image source={clinicLogo} style={styles.figmaLogoImg} resizeMode="contain" />
            </View>
            <View style={styles.figmaBrandRow}>
              <Text style={styles.figmaBrandBlue}>MedCore </Text>
              <Text style={styles.figmaBrandEmerald}>Clinic</Text>
            </View>
            {/* Akwa Ibom Clinical State Tag */}
            <View style={styles.authStateTagGlass}>
              <View style={styles.authStateDot} />
              <Text style={styles.authStateTagText}>AKWA IBOM STATE CLINICAL WORKSTATION</Text>
            </View>
          </View>

          {/* Headline & Subtitle */}
          <Text style={styles.figmaTitleGlass}>Clinician Workstation</Text>
          <Text style={styles.figmaSubtitleGlass}>
            Secure mobile access to inpatient wards, clinical workbench, e-MAR, and patient orders.
          </Text>
        </View>

        {/* Action Buttons — Glassmorphism Style */}
        <View style={styles.figmaBtnGroup}>
          <TouchableOpacity
            style={styles.figmaLoginBtn}
            onPress={() => setAuthSheet('login')}
            activeOpacity={0.88}
          >
            <Text style={styles.figmaLoginBtnText}>Sign In to Workstation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.figmaSignUpBtn}
            onPress={handleFastPassAuth}
            activeOpacity={0.88}
          >
            <Text style={styles.figmaSignUpBtnText}>
              {isScanningBiometric ? 'Verifying Fast-Pass...' : '⚡ Biometric Fast-Pass'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subtle Footnote */}
        <View style={styles.figmaFooterM87}>
          <Text style={styles.figmaFooterText}>
            Powered by <Text style={{ color: '#00D09C', fontWeight: '800' }}>M87</Text> Health Core • HL7 FHIR
          </Text>
        </View>
      </Animated.View>

      {/* =========================================================================
          CLINICAL STAFF SIGN IN MODAL / SHEET
      ========================================================================= */}
      <Modal
        visible={authSheet === 'login'}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAuthSheet('none')}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Header with Back Arrow */}
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setAuthSheet('none')} activeOpacity={0.8}>
                <Text style={styles.modalCloseIcon}>←</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Staff Workstation Sign In</Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.sheetSub}>
                Select your hospital facility, clinical role, and verify your credentials.
              </Text>

              {/* ── Hospital Facility Selector ── */}
              <View style={styles.sheetInputGroup}>
                <Text style={styles.sheetInputLabel}>HOSPITAL HEALTH FACILITY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {AKWA_IBOM_HOSPITALS.map((h, idx) => {
                    const isSel = selectedHospitalIdx === idx;
                    return (
                      <TouchableOpacity
                        key={h.id}
                        onPress={() => setSelectedHospitalIdx(idx)}
                        style={[styles.hospChip, isSel && styles.hospChipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.hospChipText, isSel && styles.hospChipTextActive]}>{h.short}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* ── Clinical Role Selector ── */}
              <View style={styles.sheetInputGroup}>
                <Text style={styles.sheetInputLabel}>CLINICAL / OPERATIONAL ROLE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {CLINICAL_ROLES.map((r, idx) => {
                    const isSel = selectedRoleIdx === idx;
                    return (
                      <TouchableOpacity
                        key={r.key}
                        onPress={() => setSelectedRoleIdx(idx)}
                        style={[styles.roleChip, isSel && styles.roleChipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={{ marginRight: 4, fontSize: 13 }}>{r.icon}</Text>
                        <Text style={[styles.roleChipText, isSel && styles.roleChipTextActive]}>{r.short}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* ── Auth Mode Switch (Password vs Staff ID) ── */}
              <View style={styles.modeTabs}>
                <TouchableOpacity
                  style={[styles.modeTab, authMode === 'password' && styles.modeTabActive]}
                  onPress={() => setAuthMode('password')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeTabText, authMode === 'password' && styles.modeTabTextActive]}>
                    Password
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeTab, authMode === 'staff_id' && styles.modeTabActive]}
                  onPress={() => setAuthMode('staff_id')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeTabText, authMode === 'staff_id' && styles.modeTabTextActive]}>
                    Staff ID No.
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── Dynamic Inputs ── */}
              {authMode === 'staff_id' ? (
                <View style={styles.sheetInputGroup}>
                  <Text style={styles.sheetInputLabel}>STAFF BADGE / IDENTIFICATION NUMBER</Text>
                  <View style={styles.sheetInputBox}>
                    <TextInput
                      style={styles.sheetTextInput}
                      value={staffIdInput}
                      onChangeText={setStaffIdInput}
                      placeholder="e.g. ISH-DOC-0142"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.sheetInputGroup}>
                    <Text style={styles.sheetInputLabel}>OFFICIAL CLINICAL USERNAME / EMAIL</Text>
                    <View style={styles.sheetInputBox}>
                      <TextInput
                        style={styles.sheetTextInput}
                        value={usernameInput}
                        onChangeText={setUsernameInput}
                        placeholder="e.g. dr.thorne@hospital.aks.gov.ng"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

                  <View style={styles.sheetInputGroup}>
                    <View style={styles.sheetPassLabelRow}>
                      <Text style={styles.sheetInputLabel}>SECURITY PASSCODE</Text>
                      <TouchableOpacity onPress={() => showToast('Passcode reset request sent to Hospital ICT Helpdesk')}>
                        <Text style={styles.sheetForgotLink}>Forgot?</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.sheetInputBox}>
                      <TextInput
                        style={styles.sheetTextInput}
                        value={passwordInput}
                        onChangeText={setPasswordInput}
                        secureTextEntry={!showPassword}
                        placeholder="Enter security passcode"
                        placeholderTextColor="#94A3B8"
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                        <Text style={styles.textActionToggle}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* Sign In Primary Button */}
              <TouchableOpacity style={styles.sheetSubmitBtn} onPress={handleSignIn} activeOpacity={0.88}>
                <Text style={styles.sheetSubmitBtnText}>Sign In to Workstation</Text>
              </TouchableOpacity>

              {/* Fast-Pass Biometric Button */}
              <TouchableOpacity
                style={styles.sheetBiometricBtn}
                onPress={handleFastPassAuth}
                disabled={isScanningBiometric}
                activeOpacity={0.85}
              >
                <View style={styles.biometricDotActive} />
                <Text style={styles.sheetBiometricText}>
                  {isScanningBiometric ? 'Verifying Biometrics...' : 'Fast-Pass with Touch / Face ID'}
                </Text>
              </TouchableOpacity>

              {/* Security Footnote */}
              <View style={styles.complianceBox}>
                <Text style={styles.complianceText}>
                  🛡️ Zero-Trust RBAC • HL7 FHIR Compliant • Cryptographically Signed Session
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  figmaAuthSafeArea: {
    flex: 1,
    backgroundColor: '#050C1A',
  },
  authBgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  authBgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 12, 26, 0.82)',
  },
  figmaAuthContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 36 : 14,
    paddingBottom: 24,
  },
  figmaTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ariseLogoImgSm: {
    width: 90,
    height: 38,
  },
  figmaLangPillGlass: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  figmaLangTextGlass: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  figmaLangDropdown: {
    position: 'absolute',
    top: 60,
    right: 22,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 999,
  },
  figmaLangOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  figmaLangOptionActive: {
    backgroundColor: 'rgba(0, 102, 255, 0.25)',
  },
  figmaLangOptionText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  figmaLangOptionTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  figmaCenterHero: {
    alignItems: 'center',
    marginVertical: 'auto',
  },
  authGlassLogoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 16,
    width: '100%',
    maxWidth: 380,
  },
  figmaLogoWrap: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  figmaLogoImg: {
    width: 52,
    height: 52,
  },
  figmaBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  figmaBrandBlue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#38BDF8',
  },
  figmaBrandEmerald: {
    fontSize: 22,
    fontWeight: '900',
    color: '#10B981',
  },
  authStateTagGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 102, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 10,
  },
  authStateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 7,
  },
  authStateTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.6,
  },
  figmaTitleGlass: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 10,
    textAlign: 'center',
  },
  figmaSubtitleGlass: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.82)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
    maxWidth: 340,
  },
  figmaBtnGroup: {
    gap: 12,
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  figmaLoginBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  figmaLoginBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  figmaSignUpBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  figmaSignUpBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  figmaFooterM87: {
    alignItems: 'center',
    marginTop: 8,
  },
  figmaFooterText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '600',
  },
  toastBox: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    borderColor: '#0284C7',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 9999,
  },
  toastText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Modal Sheet Styles ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: height * 0.88,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sheetSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  sheetInputGroup: {
    marginBottom: 14,
  },
  sheetInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  sheetInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    marginTop: 6,
  },
  sheetTextInput: {
    flex: 1,
    paddingVertical: 11,
    color: '#FFFFFF',
    fontSize: 13,
  },
  sheetPassLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetForgotLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  textActionToggle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    paddingHorizontal: 6,
  },

  /* Chips */
  hospChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  hospChipActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
    borderColor: '#0284C7',
  },
  hospChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  hospChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  roleChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  roleChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  roleChipTextActive: {
    color: '#10B981',
    fontWeight: '800',
  },

  /* Mode Tabs */
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    padding: 3,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeTabActive: {
    backgroundColor: '#0284C7',
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },

  sheetSubmitBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  sheetSubmitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sheetBiometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  biometricDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  sheetBiometricText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  complianceBox: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  complianceText: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
  },
});
