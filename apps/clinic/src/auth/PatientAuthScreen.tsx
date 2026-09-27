/**
 * Patient auth — same hospital hero background + glass UI as original MedCore Care app
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Animated,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { PatientSession } from './sessionTypes';
import { AKWA_IBOM_HOSPITALS } from '../components/auth/StaffAuthScreen';

const { height } = Dimensions.get('window');
const hospitalHeroImg = require('../assets/hospital_hero.jpg');
const ariseLogo = require('../assets/arise_logo.png');
const patLogo = require('../assets/patmedcore.png');

interface Props {
  onSuccess: (session: PatientSession) => void;
  onBack: () => void;
}

export function PatientAuthScreen({ onSuccess, onBack }: Props) {
  const [name, setName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [phone, setPhone] = useState('');
  const [hospitalIdx, setHospitalIdx] = useState(0);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<'none' | 'login' | 'signup'>('none');
  const authFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(authFade, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [authFade]);

  const hospital = AKWA_IBOM_HOSPITALS[hospitalIdx];

  const submit = (mode: 'login' | 'signup') => {
    if (!name.trim() && mode === 'signup') {
      setError('Enter your full name');
      return;
    }
    const id =
      patientId.trim() ||
      `PAT-${hospital.id.slice(-3)}-${Date.now().toString().slice(-6)}`;
    onSuccess({
      persona: 'patient',
      patientId: id,
      name: name.trim() || 'Patient',
      facility: hospital.name,
      phone: phone.trim() || undefined,
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Image source={hospitalHeroImg} style={styles.authBgImage} resizeMode="cover" />
      <View style={styles.authBgOverlay} />

      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.container, { opacity: authFade }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.back}>← Back</Text>
            </TouchableOpacity>
            <Image source={ariseLogo} style={styles.ariseLogo} resizeMode="contain" />
            <View style={styles.langPill}>
              <Text style={styles.langText}>EN</Text>
            </View>
          </View>

          <View style={styles.centerHero}>
            <View style={styles.glassCard}>
              <Image source={patLogo} style={styles.patLogo} resizeMode="contain" />
              <View style={styles.brandRow}>
                <Text style={styles.brandBlue}>MedCore </Text>
                <Text style={styles.brandEmerald}>Care</Text>
              </View>
              <View style={styles.stateTag}>
                <View style={styles.stateDot} />
                <Text style={styles.stateTagText}>AKWA IBOM STATE HEALTH PORTAL</Text>
              </View>
            </View>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>
              Secure access to your personal health record and care services.
            </Text>
          </View>

          <View style={styles.btnGroup}>
            <TouchableOpacity style={styles.loginBtn} onPress={() => setSheet('login')} activeOpacity={0.88}>
              <Text style={styles.loginBtnText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signUpBtn} onPress={() => setSheet('signup')} activeOpacity={0.88}>
              <Text style={styles.signUpBtnText}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            Powered by <Text style={{ color: '#00A88F', fontWeight: '800' }}>M87</Text> Health Core
          </Text>
        </Animated.View>

        {sheet !== 'none' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetWrap}
          >
            <TouchableOpacity style={styles.sheetDim} activeOpacity={1} onPress={() => setSheet('none')} />
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setSheet('none')}>
                  <Text style={styles.sheetClose}>←</Text>
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>
                  {sheet === 'login' ? 'Welcome Back' : 'Create account'}
                </Text>
                <View style={{ width: 28 }} />
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetSub}>
                  {sheet === 'login'
                    ? 'Enter your health number or name to open your hospital record.'
                    : 'Register for MedCore Care at your preferred facility.'}
                </Text>

                {sheet === 'signup' && (
                  <>
                    <Text style={styles.inputLabel}>FULL NAME</Text>
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="As on your hospital card"
                      placeholderTextColor="#94A3B8"
                    />
                  </>
                )}

                <Text style={styles.inputLabel}>PATIENT ID / HEALTH CARD</Text>
                <TextInput
                  style={styles.input}
                  value={patientId}
                  onChangeText={setPatientId}
                  placeholder="e.g. AKS-ABK-001-90821"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />

                {sheet === 'login' && (
                  <>
                    <Text style={styles.inputLabel}>FULL NAME (if new on this phone)</Text>
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name"
                      placeholderTextColor="#94A3B8"
                    />
                  </>
                )}

                <Text style={styles.inputLabel}>PHONE (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="080…"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.inputLabel}>HOSPITAL</Text>
                <View style={styles.hospitalList}>
                  {AKWA_IBOM_HOSPITALS.slice(0, 6).map((h, i) => (
                    <TouchableOpacity
                      key={h.id}
                      style={[styles.hItem, hospitalIdx === i && styles.hItemOn]}
                      onPress={() => setHospitalIdx(i)}
                    >
                      <Text style={[styles.hText, hospitalIdx === i && styles.hTextOn]}>{h.short}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity
                  style={styles.sheetPrimary}
                  onPress={() => submit(sheet === 'login' ? 'login' : 'signup')}
                >
                  <Text style={styles.sheetPrimaryText}>
                    {sheet === 'login' ? 'Login' : 'Create account'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050C1A' },
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
    backgroundColor: 'rgba(5, 12, 26, 0.78)',
  },
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 12 : 4,
  },
  back: { color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: 15 },
  ariseLogo: { width: 72, height: 28 },
  langPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  langText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  centerHero: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: 16 },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 16,
    width: '100%',
  },
  patLogo: { width: 64, height: 64, marginBottom: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandBlue: { fontSize: 22, fontWeight: '800', color: '#38BDF8' },
  brandEmerald: { fontSize: 22, fontWeight: '800', color: '#2DD4BF' },
  stateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 102, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  stateTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  btnGroup: { gap: 12, marginBottom: 12 },
  loginBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  loginBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  signUpBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  signUpBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 8,
  },
  sheetWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheetDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    maxHeight: height * 0.78,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetClose: { fontSize: 22, color: '#0F172A', fontWeight: '600' },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  sheetSub: { fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 14 },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  hospitalList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  hItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hItemOn: { backgroundColor: '#0066FF', borderColor: '#0066FF' },
  hText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  hTextOn: { color: '#FFF' },
  error: { color: '#DC2626', marginTop: 10, fontWeight: '600' },
  sheetPrimary: {
    marginTop: 20,
    backgroundColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetPrimaryText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
