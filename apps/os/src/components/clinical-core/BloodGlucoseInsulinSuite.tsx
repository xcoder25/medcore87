'use client';

import React, { useState, useId } from 'react';
import {
  Activity,
  AlertTriangle,
  Plus,
  Clock,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Droplet,
  Heart,
  Sparkles,
  Info,
} from 'lucide-react';
import { listPatients, type FacilityPatient } from '@/lib/patientRegistryStore';

interface GlucoseReading {
  id: string;
  patientId: string;
  patientName: string;
  bed: string;
  timestamp: string;
  timing: 'Fasting' | 'Pre-Breakfast' | '2h Post-Breakfast' | 'Pre-Lunch' | '2h Post-Lunch' | 'Pre-Dinner' | '2h Post-Dinner' | 'Bedtime (22:00)' | '03:00 AM (Somogyi/Dawn)';
  cbg: number; // mg/dL
  slidingScaleInsulinUnits: number;
  insulinAdministered: boolean;
  administeredBy?: string;
  ketones?: 'Negative' | 'Trace' | 'Small (1+)' | 'Moderate (2+)' | 'Large (3+)';
  notes?: string;
  status: 'normal' | 'hypo' | 'hyper' | 'critical-hyper';
}

function calculateSlidingScale(cbg: number): number {
  if (cbg < 150) return 0;
  if (cbg <= 199) return 2;
  if (cbg <= 249) return 4;
  if (cbg <= 299) return 6;
  if (cbg <= 349) return 8;
  return 10; // STAT notify MO if >= 350
}

function classifyGlucose(cbg: number): 'normal' | 'hypo' | 'hyper' | 'critical-hyper' {
  if (cbg < 70) return 'hypo';
  if (cbg >= 350) return 'critical-hyper';
  if (cbg > 180) return 'hyper';
  return 'normal';
}

export function BloodGlucoseInsulinSuite() {
  const [patients] = useState<FacilityPatient[]>(() => {
    try {
      return listPatients();
    } catch {
      return [];
    }
  });
  const searchId = useId();
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || 'DEMO-PT-01');
  const [filterPatient, setFilterPatient] = useState<string>('all');

  const [readings, setReadings] = useState<GlucoseReading[]>([
    {
      id: 'CBG-2026-001',
      patientId: patients[0]?.id || 'DEMO-PT-01',
      patientName: patients[0] ? `${patients[0].firstName} ${patients[0].lastName}` : 'Chidiebere Okafor',
      bed: 'Bed 4A (Medical Ward)',
      timestamp: 'Today, 07:05 AM',
      timing: 'Fasting',
      cbg: 242,
      slidingScaleInsulinUnits: 4,
      insulinAdministered: true,
      administeredBy: 'RN Blessing K.',
      ketones: 'Negative',
      notes: 'Complained of mild dry mouth. 4u Soluble Regular Insulin given SubQ into abdomen.',
      status: 'hyper',
    },
    {
      id: 'CBG-2026-002',
      patientId: patients[0]?.id || 'DEMO-PT-01',
      patientName: patients[0] ? `${patients[0].firstName} ${patients[0].lastName}` : 'Chidiebere Okafor',
      bed: 'Bed 4A (Medical Ward)',
      timestamp: 'Today, 11:30 AM',
      timing: 'Pre-Lunch',
      cbg: 168,
      slidingScaleInsulinUnits: 2,
      insulinAdministered: true,
      administeredBy: 'RN Blessing K.',
      ketones: 'Negative',
      notes: '2u regular insulin given 15 min prior to lunch.',
      status: 'normal',
    },
    {
      id: 'CBG-2026-003',
      patientId: patients[1]?.id || 'DEMO-PT-02',
      patientName: patients[1] ? `${patients[1].firstName} ${patients[1].lastName}` : 'Amina Yusuf',
      bed: 'Bed 2B (ICU Stepdown)',
      timestamp: 'Today, 03:00 AM',
      timing: '03:00 AM (Somogyi/Dawn)',
      cbg: 62,
      slidingScaleInsulinUnits: 0,
      insulinAdministered: false,
      ketones: 'Negative',
      notes: 'Diaphoretic, shaky. Rule 15-15 activated: 15g oral glucose (200mL Lucozade/fruit juice) given.',
      status: 'hypo',
    },
    {
      id: 'CBG-2026-004',
      patientId: patients[1]?.id || 'DEMO-PT-02',
      patientName: patients[1] ? `${patients[1].firstName} ${patients[1].lastName}` : 'Amina Yusuf',
      bed: 'Bed 2B (ICU Stepdown)',
      timestamp: 'Today, 03:20 AM',
      timing: '03:00 AM (Somogyi/Dawn)',
      cbg: 94,
      slidingScaleInsulinUnits: 0,
      insulinAdministered: false,
      ketones: 'Negative',
      notes: 'Repeat CBG post 15-min hypoglycemia protocol. Patient alert and asymptomatic.',
      status: 'normal',
    },
  ]);

  // Form State
  const [cbgInput, setCbgInput] = useState<number>(180);
  const [timing, setTiming] = useState<GlucoseReading['timing']>('Pre-Lunch');
  const [bedInput, setBedInput] = useState<string>('Bed 4A');
  const [ketonesInput, setKetonesInput] = useState<GlucoseReading['ketones']>('Negative');
  const [adminCheck, setAdminCheck] = useState<boolean>(true);
  const [nurseSignature, setNurseSignature] = useState<string>('RN Chiamaka E.');
  const [notesInput, setNotesInput] = useState<string>('');
  const [alertDismissed, setAlertDismissed] = useState<boolean>(false);

  const activePatient: FacilityPatient | undefined = patients.find((p: FacilityPatient) => p.id === selectedPatientId);
  const calculatedDose = calculateSlidingScale(cbgInput);
  const statusCategory = classifyGlucose(cbgInput);

  const handleAddReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cbgInput) return;

    const newReading: GlucoseReading = {
      id: `CBG-${Date.now().toString().slice(-5)}`,
      patientId: selectedPatientId,
      patientName: activePatient ? `${activePatient.firstName} ${activePatient.lastName}` : 'Unknown Patient',
      bed: bedInput,
      timestamp: 'Just now',
      timing,
      cbg: cbgInput,
      slidingScaleInsulinUnits: calculatedDose,
      insulinAdministered: adminCheck && calculatedDose > 0,
      administeredBy: adminCheck ? nurseSignature : undefined,
      ketones: ketonesInput,
      notes: notesInput || undefined,
      status: statusCategory,
    };

    setReadings([newReading, ...readings]);
    setNotesInput('');
  };

  const visibleReadings = filterPatient === 'all'
    ? readings
    : readings.filter(r => r.patientId === filterPatient);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <Droplet className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Capillary Blood Glucose & Insulin Flowsheet</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Point-of-care CBG telemetry, automated sliding-scale regular insulin dosage calculation, and hypoglycemia emergency protocol.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor={searchId} className="text-xs font-semibold text-slate-500">Filter Ward Patient:</label>
          <select
            id={searchId}
            value={filterPatient}
            onChange={(e) => setFilterPatient(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium"
          >
            <option value="all">All Ward Patients ({readings.length})</option>
            {patients.map((p: FacilityPatient) => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.id})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Critical Protocol Alerts */}
      {cbgInput < 70 && !alertDismissed && (
        <div className="p-4 rounded-xl bg-red-500/10 border-2 border-red-500 text-red-700 dark:text-red-400 flex items-start justify-between gap-4 animate-pulse">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-base uppercase tracking-wider">Hypoglycemia Emergency Alert (&lt; 70 mg/dL)</div>
              <p className="text-sm mt-1">
                Patient CBG is <strong>{cbgInput} mg/dL</strong>. <strong>NO INSULIN</strong>. Execute Rule 15-15 immediately:
              </p>
              <ul className="text-xs list-disc list-inside mt-2 space-y-1">
                <li>If conscious: Administer 15g fast-acting carbohydrate (1/2 cup fruit juice or 3 glucose tablets).</li>
                <li>If unconscious/NPO: Administer 25mL to 50mL IV 50% Dextrose (D50W) stat over 3 minutes.</li>
                <li>Re-check CBG in 15 minutes. Repeat until CBG &gt;= 80 mg/dL.</li>
              </ul>
            </div>
          </div>
          <button
            onClick={() => setAlertDismissed(true)}
            className="text-xs underline font-semibold text-red-600 hover:text-red-800"
          >
            Acknowledge
          </button>
        </div>
      )}

      {cbgInput >= 350 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500 text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-base uppercase tracking-wider">Critical Hyperglycemia (CBG &gt;= 350 mg/dL) - Rule Out DKA / HHS</div>
            <p className="text-sm mt-1">
              Give maximum sliding scale dose (10u SubQ) and <strong>immediately check urine/serum ketones</strong>. Stat notify Medical Officer on-call for IV regular insulin infusion protocol and fluid resuscitation.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry & Sliding Scale Calculator */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-bold flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-indigo-500" />
              Log Point-of-Care Reading
            </h2>

            <form onSubmit={handleAddReading} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">Target Inpatient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                >
                  {patients.map((p: FacilityPatient) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Ward Bed</label>
                  <input
                    type="text"
                    value={bedInput}
                    onChange={(e) => setBedInput(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium"
                    placeholder="Bed 4A"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Timing</label>
                  <select
                    value={timing}
                    onChange={(e) => setTiming(e.target.value as GlucoseReading['timing'])}
                    className="w-full mt-1 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  >
                    <option value="Fasting">Fasting (06:00)</option>
                    <option value="Pre-Breakfast">Pre-Breakfast</option>
                    <option value="2h Post-Breakfast">2h Post-Breakfast</option>
                    <option value="Pre-Lunch">Pre-Lunch</option>
                    <option value="2h Post-Lunch">2h Post-Lunch</option>
                    <option value="Pre-Dinner">Pre-Dinner</option>
                    <option value="2h Post-Dinner">2h Post-Dinner</option>
                    <option value="Bedtime (22:00)">Bedtime (22:00)</option>
                    <option value="03:00 AM (Somogyi/Dawn)">03:00 AM Check</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-500">Capillary Blood Glucose (CBG)</label>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {(cbgInput / 18.0182).toFixed(1)} mmol/L
                  </span>
                </div>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min="20"
                    max="800"
                    value={cbgInput}
                    onChange={(e) => {
                      setCbgInput(Number(e.target.value));
                      setAlertDismissed(false);
                    }}
                    className="w-full pl-4 pr-16 py-2.5 rounded-xl border-2 border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-800 text-xl font-bold tracking-tight text-slate-900 dark:text-white"
                  />
                  <span className="absolute right-3 top-3 text-xs font-semibold text-slate-400">mg/dL</span>
                </div>
              </div>

              {/* Sliding Scale Dosage Visualizer */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Calculated Regular Insulin</span>
                  <span className={`text-base font-extrabold px-2.5 py-0.5 rounded-lg ${
                    calculatedDose === 0
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      : 'bg-indigo-600 text-white'
                  }`}>
                    {calculatedDose} Units SubQ
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 leading-tight">
                  Standard Hospital Sliding Scale: &lt;150: 0u | 150-199: 2u | 200-249: 4u | 250-299: 6u | 300-349: 8u | &gt;=350: 10u STAT.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Urine Ketones</label>
                  <select
                    value={ketonesInput}
                    onChange={(e) => setKetonesInput(e.target.value as GlucoseReading['ketones'])}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  >
                    <option value="Negative">Negative</option>
                    <option value="Trace">Trace</option>
                    <option value="Small (1+)">Small (1+)</option>
                    <option value="Moderate (2+)">Moderate (2+)</option>
                    <option value="Large (3+)">Large (3+)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Nurse Initial</label>
                  <input
                    type="text"
                    value={nurseSignature}
                    onChange={(e) => setNurseSignature(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
              </div>

              {calculatedDose > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="adminDoseCheck"
                    checked={adminCheck}
                    onChange={(e) => setAdminCheck(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="adminDoseCheck" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Confirm {calculatedDose}u administered SubQ right now
                  </label>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-500">Clinical Observations / Meal Intake</label>
                <textarea
                  rows={2}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="e.g., Patient ate 100% of diabetic meal, no dizziness."
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Commit Reading to Chart
              </button>
            </form>
          </div>

          {/* Target Ranges Reference Card */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-sm">
              <ShieldCheck className="w-4 h-4" /> ADA Inpatient Glycemic Targets
            </div>
            <p>• General Inpatient Pre-meal: 100 - 140 mg/dL (5.6 - 7.8 mmol/L)</p>
            <p>• General Inpatient Post-meal / Random: 140 - 180 mg/dL</p>
            <p>• Strict ICU Target: 140 - 180 mg/dL (avoid strict &lt; 110 due to mortality risk)</p>
          </div>
        </div>

        {/* Glucose Timeline & History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Recorded Readings & Glycemic Trend
            </h3>
            <span className="text-xs font-semibold text-slate-400">
              {visibleReadings.length} readings charted
            </span>
          </div>

          <div className="space-y-3">
            {visibleReadings.map((reading) => {
              const mmol = (reading.cbg / 18.0182).toFixed(1);
              return (
                <div
                  key={reading.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {reading.patientName}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                        {reading.bed}
                      </span>
                      <span className="text-xs text-slate-400">
                        {reading.timestamp}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                        {reading.timing}
                      </span>
                    </div>

                    {reading.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {reading.notes}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {reading.ketones && reading.ketones !== 'Negative' && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          Ketones: {reading.ketones}
                        </span>
                      )}
                      {reading.insulinAdministered && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {reading.slidingScaleInsulinUnits}u Regular given by {reading.administeredBy}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-2xl font-black ${
                        reading.status === 'hypo'
                          ? 'text-red-500'
                          : reading.status === 'critical-hyper'
                          ? 'text-purple-500'
                          : reading.status === 'hyper'
                          ? 'text-amber-500'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {reading.cbg}
                      </span>
                      <span className="text-xs font-bold text-slate-400">mg/dL</span>
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      {mmol} mmol/L
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BloodGlucoseInsulinSuite;
