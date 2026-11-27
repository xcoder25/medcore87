import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LiquidGlassCard } from '../ui/LiquidGlass';
import { C } from '../../theme';

export interface NEWS2Vitals {
  respiratoryRate?: number;
  spo2?: number;
  systolicBP?: number;
  heartRate?: number;
  temperature?: number;
  avpu?: 'A' | 'C' | 'V' | 'P' | 'U';
}

export const NEWS2Widget: React.FC<{ vitals?: NEWS2Vitals }> = ({ vitals = {} }) => {
  const { totalScore, riskBand, color } = useMemo(() => {
    let score = 0;
    if (vitals.respiratoryRate !== undefined) {
      if (vitals.respiratoryRate <= 8 || vitals.respiratoryRate >= 25) score += 3;
      else if (vitals.respiratoryRate >= 21) score += 2;
      else if (vitals.respiratoryRate <= 11) score += 1;
    }
    if (vitals.spo2 !== undefined) {
      if (vitals.spo2 <= 91) score += 3;
      else if (vitals.spo2 <= 93) score += 2;
      else if (vitals.spo2 <= 95) score += 1;
    }
    if (vitals.systolicBP !== undefined) {
      if (vitals.systolicBP <= 90 || vitals.systolicBP >= 220) score += 3;
      else if (vitals.systolicBP <= 100) score += 2;
      else if (vitals.systolicBP <= 110) score += 1;
    }
    if (vitals.heartRate !== undefined) {
      if (vitals.heartRate <= 40 || vitals.heartRate >= 131) score += 3;
      else if (vitals.heartRate >= 111) score += 2;
      else if (vitals.heartRate <= 50 || vitals.heartRate >= 91) score += 1;
    }
    if (vitals.temperature !== undefined) {
      if (vitals.temperature <= 35.0) score += 3;
      else if (vitals.temperature >= 39.1) score += 2;
      else if (vitals.temperature <= 36.0 || vitals.temperature >= 38.1) score += 1;
    }
    if (vitals.avpu && vitals.avpu !== 'A') score += 3;

    if (score >= 7) return { totalScore: score, riskBand: 'HIGH RISK · Immediate Escalation', color: '#FB7185' };
    if (score >= 5) return { totalScore: score, riskBand: 'MEDIUM RISK · Urgent Review', color: '#FBBF24' };
    return { totalScore: score, riskBand: 'LOW RISK · Routine Obs', color: '#34D399' };
  }, [vitals]);

  return (
    <LiquidGlassCard glowColor={color} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.scoreBadge, { borderColor: color, backgroundColor: `${color}22` }]}>
          <Text style={[styles.scoreNum, { color }]}>{totalScore}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>NEWS2 Deterioration Score</Text>
          <Text style={[styles.band, { color }]}>{riskBand}</Text>
        </View>
      </View>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: { fontSize: 22, fontWeight: '900' },
  title: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  band: { fontSize: 12, fontWeight: '800', marginTop: 2 },
});

export default NEWS2Widget;
