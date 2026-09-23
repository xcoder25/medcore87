/**
 * MedCore Vitals Engine
 * Processes incoming vitals, computes NEWS2, triggers real-time alerts
 */

import { syncEventBus } from '../sync/eventBus';
import { calculateNEWS2, calculateQSOFA, VitalsInput } from './newsCalculator';
import { dataStore } from '../store/database';

export interface VitalsRecord {
  id: string;
  patientId: string;
  patientName: string;
  facilityId: string;
  wardId?: string;
  bedId?: string;
  recordedBy: string;
  recordedAt: string;
  // Vitals measurements
  temperature: number;
  systolicBP: number;
  diastolicBP: number;
  heartRate: number;
  respiratoryRate: number;
  spO2: number;
  supplementalOxygen: boolean;
  consciousness: 'A' | 'C' | 'V' | 'P' | 'U';
  painScore: number;           // 0-10
  bloodGlucose?: number;       // mmol/L
  weight?: number;             // kg
  height?: number;             // cm
  // Computed
  news2Score?: number;
  news2Risk?: string;
  qsofaScore?: number;
  sepsisRisk?: boolean;
}

class VitalsEngine {
  private vitalsHistory: Map<string, VitalsRecord[]> = new Map();

  /**
   * Process a new vitals reading — compute scores, store, broadcast
   */
  public processVitals(params: Omit<VitalsRecord, 'id' | 'recordedAt' | 'news2Score' | 'news2Risk' | 'qsofaScore' | 'sepsisRisk'>): VitalsRecord {
    const id = `VIT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)}`;
    const recordedAt = new Date().toISOString();

    const vitalsInput: VitalsInput = {
      respiratoryRate:    params.respiratoryRate,
      spO2:               params.spO2,
      supplementalOxygen: params.supplementalOxygen,
      systolicBP:         params.systolicBP,
      heartRate:          params.heartRate,
      temperature:        params.temperature,
      consciousness:      params.consciousness,
    };

    const news2 = calculateNEWS2(vitalsInput);
    const qsofa = calculateQSOFA({
      respiratoryRate: params.respiratoryRate,
      systolicBP:      params.systolicBP,
      consciousness:   params.consciousness,
    });

    const record: VitalsRecord = {
      ...params,
      id,
      recordedAt,
      news2Score: news2.totalScore,
      news2Risk:  news2.riskLevel,
      qsofaScore: qsofa.score,
      sepsisRisk: qsofa.sepsisRisk,
    };

    // Store in history
    if (!this.vitalsHistory.has(params.patientId)) {
      this.vitalsHistory.set(params.patientId, []);
    }
    const history = this.vitalsHistory.get(params.patientId)!;
    history.push(record);
    if (history.length > 48) history.shift(); // Keep 48 readings max per patient

    // ─── Broadcast: Vitals recorded ─────────────────────
    syncEventBus.broadcast({
      topic: 'VITALS_RECORDED',
      facilityId: params.facilityId,
      emitterApp: 'API_SERVER',
      payload: {
        patientId: params.patientId,
        patientName: params.patientName,
        news2Score: news2.totalScore,
        news2Risk: news2.riskLevel,
        vitalsId: id,
      },
    });

    // ─── Broadcast: NEWS2 score update ──────────────────
    syncEventBus.broadcast({
      topic: 'NEWS2_SCORE_UPDATED',
      facilityId: params.facilityId,
      emitterApp: 'API_SERVER',
      payload: {
        patientId: params.patientId,
        patientName: params.patientName,
        score: news2.totalScore,
        riskLevel: news2.riskLevel,
        breakdown: news2.breakdown,
        alerts: news2.alerts,
        monitoringFrequency: news2.monitoringFrequency,
      },
    });

    // ─── Broadcast: Deterioration alert (NEWS2 ≥ 5) ─────
    if (news2.escalationRequired) {
      syncEventBus.broadcast({
        topic: 'NEWS2_DETERIORATION',
        facilityId: params.facilityId,
        emitterApp: 'API_SERVER',
        payload: {
          patientId: params.patientId,
          patientName: params.patientName,
          news2Score: news2.totalScore,
          riskLevel: news2.riskLevel,
          clinicalRisk: news2.clinicalRisk,
          alerts: news2.alerts,
          bedId: params.bedId,
          wardId: params.wardId,
          recordedBy: params.recordedBy,
          timestamp: recordedAt,
        },
      });
    }

    // ─── Broadcast: Sepsis Alert (qSOFA ≥ 2) ────────────
    if (qsofa.sepsisRisk) {
      syncEventBus.broadcast({
        topic: 'SEPSIS_ALERT',
        facilityId: params.facilityId,
        emitterApp: 'API_SERVER',
        payload: {
          patientId: params.patientId,
          patientName: params.patientName,
          qsofaScore: qsofa.score,
          criteria: qsofa.criteria,
          recommendation: qsofa.recommendation,
          bedId: params.bedId,
          wardId: params.wardId,
          timestamp: recordedAt,
        },
      });
    }

    // ─── Check individual out-of-range vitals ────────────
    const criticalAlerts: string[] = [];
    if (params.spO2 < 90)          criticalAlerts.push(`SpO₂ critically low: ${params.spO2}%`);
    if (params.systolicBP < 90)    criticalAlerts.push(`Hypotension: BP ${params.systolicBP}/${params.diastolicBP} mmHg`);
    if (params.heartRate > 140 || params.heartRate < 40) criticalAlerts.push(`Critical heart rate: ${params.heartRate} bpm`);
    if (params.temperature > 39.5) criticalAlerts.push(`High fever: ${params.temperature}°C`);
    if (params.temperature < 35.0) criticalAlerts.push(`Hypothermia: ${params.temperature}°C`);

    if (criticalAlerts.length > 0) {
      syncEventBus.broadcast({
        topic: 'VITALS_ALERT',
        facilityId: params.facilityId,
        emitterApp: 'API_SERVER',
        payload: {
          patientId: params.patientId,
          patientName: params.patientName,
          alerts: criticalAlerts,
          vitals: { temperature: params.temperature, systolicBP: params.systolicBP, heartRate: params.heartRate, spO2: params.spO2 },
          bedId: params.bedId,
          wardId: params.wardId,
        },
      });
    }

    return record;
  }

  public getPatientVitalsHistory(patientId: string): VitalsRecord[] {
    return this.vitalsHistory.get(patientId) || [];
  }

  public getLatestVitals(patientId: string): VitalsRecord | undefined {
    const history = this.vitalsHistory.get(patientId);
    return history ? history[history.length - 1] : undefined;
  }
}

export const vitalsEngine = new VitalsEngine();
