/**
 * Unified entry — Patient or Staff (premium gate with hospital hero)
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import type { Persona } from '../rbac/permissions';

const clinicLogo = require('../assets/logo.png');
const hospitalHeroImg = require('../assets/hospital_hero.jpg');
const ariseLogo = require('../assets/arise_logo.png');

interface Props {
  onSelect: (persona: Persona) => void;
}

export function UnifiedGate({ onSelect }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Image source={hospitalHeroImg} style={styles.bg} resizeMode="cover" />
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Image source={ariseLogo} style={styles.arise} resizeMode="contain" />
          <View style={styles.pill}>
            <Text style={styles.pillText}>AKWA IBOM</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.logoPlate}>
            <Image source={clinicLogo} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.brand}>MedCore</Text>
          <Text style={styles.sub}>One mobile app for care & clinical work</Text>
          <Text style={styles.hint}>Choose how you enter — access is role-based and secure.</Text>
        </View>

        <View style={styles.cards}>
          <TouchableOpacity
            style={[styles.card, styles.patientCard]}
            onPress={() => onSelect('patient')}
            activeOpacity={0.9}
          >
            <View style={styles.cardIconWrap}>
              <Text style={styles.cardIcon}>💚</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>I am a Patient</Text>
              <Text style={styles.cardDesc}>
                Appointments, records, health card & emergency help
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.staffCard]}
            onPress={() => onSelect('staff')}
            activeOpacity={0.9}
          >
            <View style={[styles.cardIconWrap, styles.cardIconStaff]}>
              <Text style={styles.cardIcon}>🩺</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>I am Staff</Text>
              <Text style={styles.cardDesc}>
                Ward tools by role — doctor, nurse, pharmacy, lab & more
              </Text>
            </View>
            <Text style={[styles.chevron, { color: '#93C5FD' }]}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.foot}>
          Powered by <Text style={{ color: '#2DD4BF', fontWeight: '800' }}>M87</Text> · Secure RBAC
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050C1A' },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 12, 26, 0.82)',
  },
  safe: { flex: 1, paddingHorizontal: 20 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 8 : 0,
    marginBottom: 8,
  },
  arise: { width: 80, height: 28 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pillText: { color: '#E0F2FE', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  hero: { alignItems: 'center', paddingVertical: 20 },
  logoPlate: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#0066FF',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logo: { width: 64, height: 64 },
  brand: { color: '#FFF', fontSize: 32, fontWeight: '800', letterSpacing: 0.4 },
  sub: { color: '#94A3B8', fontSize: 15, marginTop: 8, fontWeight: '600', textAlign: 'center' },
  hint: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  cards: { flex: 1, justifyContent: 'center', gap: 14, paddingBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  patientCard: {
    backgroundColor: 'rgba(13, 148, 136, 0.18)',
    borderColor: 'rgba(45, 212, 191, 0.4)',
  },
  staffCard: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconStaff: { backgroundColor: 'rgba(59, 130, 246, 0.25)' },
  cardIcon: { fontSize: 24 },
  cardTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  cardDesc: { color: '#94A3B8', fontSize: 12, lineHeight: 17, marginTop: 4 },
  chevron: { color: '#5EEAD4', fontSize: 28, fontWeight: '300' },
  foot: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 12,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    fontWeight: '600',
  },
});
