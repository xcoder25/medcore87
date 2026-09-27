/**
 * Unified entry — Patient or Staff (one MedCore Mobile app)
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

interface Props {
  onSelect: (persona: Persona) => void;
}

export function UnifiedGate({ onSelect }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1220" />
      <View style={styles.hero}>
        <Image source={clinicLogo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>MedCore</Text>
        <Text style={styles.sub}>Hospital Mobile · Patient & Staff</Text>
        <Text style={styles.hint}>One app. Your access depends on who you are.</Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, styles.patientCard]}
          onPress={() => onSelect('patient')}
          activeOpacity={0.88}
        >
          <Text style={styles.cardIcon}>🧑‍🤝‍🧑</Text>
          <Text style={styles.cardTitle}>I am a Patient</Text>
          <Text style={styles.cardDesc}>
            Book visits, view records, health card, bills & emergency help
          </Text>
          <Text style={styles.cardCta}>Continue as Patient →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.staffCard]}
          onPress={() => onSelect('staff')}
          activeOpacity={0.88}
        >
          <Text style={styles.cardIcon}>🩺</Text>
          <Text style={styles.cardTitle}>I am Staff</Text>
          <Text style={styles.cardDesc}>
            Clinical tools by role — doctor, nurse, pharmacy, lab & more
          </Text>
          <Text style={[styles.cardCta, { color: '#93C5FD' }]}>Continue as Staff →</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.foot}>Akwa Ibom State · Secure role-based access</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1220' },
  hero: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 24 : 40, paddingBottom: 20 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#FFF',
    marginBottom: 14,
  },
  brand: { color: '#FFF', fontSize: 28, fontWeight: '800', letterSpacing: 0.5 },
  sub: { color: '#94A3B8', fontSize: 14, marginTop: 6, fontWeight: '600' },
  hint: { color: '#64748B', fontSize: 13, marginTop: 10, textAlign: 'center', paddingHorizontal: 32 },
  cards: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 14 },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  patientCard: {
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    borderColor: 'rgba(45, 212, 191, 0.35)',
  },
  staffCard: {
    backgroundColor: 'rgba(30, 58, 138, 0.35)',
    borderColor: 'rgba(96, 165, 250, 0.35)',
  },
  cardIcon: { fontSize: 32, marginBottom: 10 },
  cardTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  cardDesc: { color: '#94A3B8', fontSize: 13, lineHeight: 19, marginTop: 8 },
  cardCta: { color: '#5EEAD4', fontSize: 14, fontWeight: '700', marginTop: 14 },
  foot: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 11,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20,
    fontWeight: '600',
  },
});
