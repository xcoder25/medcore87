/** Predictive staffing demand from visit patterns */
import { todayVisits, listVisits } from './receptionOpsStore';
import { queueStats } from './universalQueue';

export interface StaffingForecast {
  horizonHours: number;
  expectedPatients: number;
  recommendedDoctors: number;
  recommendedNurses: number;
  recommendedPharmacy: number;
  recommendedLab: number;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
}

export function forecastStaffing(facilityId: string): StaffingForecast {
  const today = todayVisits(facilityId);
  const hour = new Date().getHours();
  const waiting = today.filter((v) => v.status === 'waiting' || v.status === 'called').length;
  const q = queueStats(facilityId);

  // Simple model: morning peak, midday, evening
  const peakFactor = hour >= 8 && hour <= 11 ? 1.35 : hour >= 12 && hour <= 15 ? 1.15 : 0.85;
  const baseRate = Math.max(today.length, 1) / Math.max(hour - 7, 1);
  const remainingHours = Math.max(18 - hour, 1);
  const expectedPatients = Math.round(baseRate * remainingHours * peakFactor + waiting);

  const recommendedDoctors = Math.max(1, Math.ceil(expectedPatients / 12) + (waiting > 8 ? 1 : 0));
  const recommendedNurses = Math.max(2, Math.ceil(expectedPatients / 8));
  const recommendedPharmacy = Math.max(1, Math.ceil((q.waiting + expectedPatients * 0.4) / 15));
  const recommendedLab = Math.max(1, Math.ceil(expectedPatients * 0.3 / 10));

  return {
    horizonHours: remainingHours,
    expectedPatients,
    recommendedDoctors,
    recommendedNurses,
    recommendedPharmacy,
    recommendedLab,
    confidence: today.length > 15 ? 'high' : today.length > 5 ? 'medium' : 'low',
    rationale: `Based on ${today.length} check-ins today, ${waiting} waiting, queue pressure ${q.waiting}, hour-of-day factor ${peakFactor}.`,
  };
}
