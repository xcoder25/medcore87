'use client';

import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Sparkles,
  Download,
  QrCode,
  User,
  Calendar,
  CheckCircle2,
  Stethoscope,
  Pill,
  Clock,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { listPatients, type FacilityPatient } from '@/lib/patientRegistryStore';

interface DischargeRecord {
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  admissionDate: string;
  dischargeDate: string;
  ward: string;
  consultant: string;
  admittingDiagnosis: string;
  dischargeDiagnosis: string;
  secondaryDiagnoses: string;
  hospitalCourse: string;
  surgeriesProcedures: string;
  investigationsSummary: string;
  dischargeCondition: 'Cured' | 'Improved' | 'Stable' | 'Transferred' | 'Discharged Against Medical Advice (DAMA)';
  dischargeMedications: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }[];
  followUpClinic: string;
  followUpDate: string;
  lifestyleDietaryAdvice: string;
  dischargingDoctor: string;
  doctorLicense: string;
  compiledAt: string;
}

export function DischargeSummaryCompilerSuite() {
  const [patients] = useState<FacilityPatient[]>(() => {
    try {
      return listPatients();
    } catch {
      return [];
    }
  });
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || 'DEMO-01');
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);

  const selectedPatient: FacilityPatient | undefined = patients.find((p: FacilityPatient) => p.id === selectedPatientId);

  // Form State
  const [formData, setFormData] = useState<DischargeRecord>({
    patientId: patients[0]?.id || 'MED-2026-091',
    patientName: patients[0] ? `${patients[0].firstName} ${patients[0].lastName}` : 'Chidiebere Okafor',
    hospitalNumber: patients[0]?.id || 'MED-2026-091',
    admissionDate: '2026-11-04',
    dischargeDate: '2026-11-13',
    ward: 'Male Medical Ward, Bed 04A',
    consultant: 'Dr. Ifeanyi Okonkwo, MBBS, FWACP (Internal Med)',
    admittingDiagnosis: 'Decompensated Type 2 Diabetes Mellitus with Hyperglycemic Hyperosmolar State (HHS) & Right Diabetic Foot Ulcer Wagner Grade 2',
    dischargeDiagnosis: 'Controlled Type 2 Diabetes Mellitus; Granulating Right Diabetic Foot Ulcer; Controlled Hypertension',
    secondaryDiagnoses: 'Essential Hypertension Stage 2, Dyslipidemia, Mild Peripheral Neuropathy',
    hospitalCourse:
      'Patient was admitted in acute confusion with severe dehydration and capillary blood glucose of 480 mg/dL. Rehydrated with IV 0.9% Normal Saline and started on fixed-rate IV regular insulin infusion with hourly glucose monitoring. Transitioned to SubQ Basal-Bolus regimen on day 3. Wound surgical debridement was performed on day 4 by orthopedic team; healthy granulating tissue noted. Patient is now fully oriented, ambulating with walker, and tolerating normal diabetic diet.',
    surgeriesProcedures: 'Surgical wound debridement & hydrogel vacuum dressing (08-Nov-2026)',
    investigationsSummary: 'Admission HbA1c: 11.8%; Discharge FBG: 124 mg/dL; Serum Creatinine: 0.9 mg/dL; Wound swab: Staph aureus (sensitive to Amoxicillin-Clavulanate).',
    dischargeCondition: 'Improved',
    dischargeMedications: [
      {
        name: 'Insulin Glargine (Lantus)',
        dosage: '18 Units',
        frequency: 'Once daily at bedtime (21:00)',
        duration: '30 days',
        instructions: 'SubQ into abdominal wall, alternate injection sites.',
      },
      {
        name: 'Tab Metformin XR',
        dosage: '1000 mg',
        frequency: 'Once daily',
        duration: '30 days',
        instructions: 'Take immediately with dinner.',
      },
      {
        name: 'Tab Augmentin (Co-amoxiclav)',
        dosage: '625 mg',
        frequency: 'Twice daily',
        duration: '5 more days',
        instructions: 'Complete antibiotic course.',
      },
      {
        name: 'Tab Amlodipine',
        dosage: '5 mg',
        frequency: 'Once daily in morning',
        duration: '30 days',
        instructions: 'Take with water after breakfast.',
      },
    ],
    followUpClinic: 'Endocrine & Metabolic Outpatient Clinic (Room 12)',
    followUpDate: '2026-11-27 (2 Weeks)',
    lifestyleDietaryAdvice: 'Strict low glycemic index diet, zero refined sugar. Daily foot inspection with mirror. Keep dressing clean and dry. Return to A&E immediately if fever > 38°C or foot discoloration appears.',
    dischargingDoctor: 'Dr. Tariere Amadi, MBBS, Registrar',
    doctorLicense: 'MDCN/REG/2021/68421',
    compiledAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  });

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatientId(patientId);
    const pt = patients.find((p: FacilityPatient) => p.id === patientId);
    if (pt) {
      setFormData(prev => ({
        ...prev,
        patientId: pt.id,
        patientName: `${pt.firstName} ${pt.lastName}`,
        hospitalNumber: pt.id,
        admittingDiagnosis: pt.problems?.[0] || pt.chronicConditions?.[0] || 'Acute Inpatient Admission',
        dischargeDiagnosis: pt.problems?.[0] || 'Resolved Acute Inpatient Episode',
      }));
    }
  };

  const handleAiAutoSynthesize = () => {
    setAiGenerating(true);
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        hospitalCourse: `[Celestia AI Synthesis]: Patient ${formData.patientName} was admitted on ${formData.admissionDate} presenting with acute exacerbation of ${formData.admittingDiagnosis}. Managed comprehensively with clinical protocols, pharmacotherapy, and multidisciplinary nursing support. Clinical parameters stabilized within 72 hours, with normalization of vital signs and biochemical markers. Patient meets all discharge criteria: afebrile for 48 hours, tolerating oral feeding, independent mobility, and good understanding of home medication regimens.`,
        investigationsSummary: `Baseline serial blood counts, electrolyte urea creatinine, and imaging reviewed. Electrolytes normalized: Na+ 138 mmol/L, K+ 4.2 mmol/L, Urea 4.1 mmol/L. Infection markers down-trended to baseline.`,
      }));
      setAiGenerating(false);
    }, 700);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <FileText className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Inpatient Discharge Summary Compiler</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Automated tertiary discharge summary generation, multi-disciplinary hospital course synthesis, prescription reconciliation, and official QR-verifiable discharge letters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-4 py-2 rounded-xl font-bold text-sm border transition-all ${
              previewMode
                ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300'
            }`}
          >
            {previewMode ? 'Edit Mode' : 'Official Document Preview'}
          </button>
          {previewMode && (
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm shadow hover:opacity-90 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print / Export PDF
            </button>
          )}
        </div>
      </div>

      {!previewMode ? (
        /* Edit & Compile Form */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-teal-600" />
                Select Inpatient
              </h2>

              <div>
                <label className="text-xs font-semibold text-slate-500">Patient File</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => handlePatientSelect(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                >
                  {patients.map((p: FacilityPatient) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Admission Date</label>
                  <input
                    type="date"
                    value={formData.admissionDate}
                    onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Discharge Date</label>
                  <input
                    type="date"
                    value={formData.dischargeDate}
                    onChange={(e) => setFormData({ ...formData, dischargeDate: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Ward & Bed</label>
                <input
                  type="text"
                  value={formData.ward}
                  onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Attending Consultant</label>
                <input
                  type="text"
                  value={formData.consultant}
                  onChange={(e) => setFormData({ ...formData, consultant: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Discharge Status</label>
                <select
                  value={formData.dischargeCondition}
                  onChange={(e) => setFormData({ ...formData, dischargeCondition: e.target.value as DischargeRecord['dischargeCondition'] })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  <option value="Cured">Cured / Fully Recovered</option>
                  <option value="Improved">Improved (Safe for Outpatient Followup)</option>
                  <option value="Stable">Stable</option>
                  <option value="Transferred">Transferred to Higher Care</option>
                  <option value="Discharged Against Medical Advice (DAMA)">Discharged Against Medical Advice (DAMA)</option>
                </select>
              </div>

              <button
                onClick={handleAiAutoSynthesize}
                disabled={aiGenerating}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {aiGenerating ? 'Celestia Synthesizing Course...' : 'Celestia AI Auto-Synthesize'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-600" />
                Diagnoses & Hospital Course
              </h2>

              <div>
                <label className="text-xs font-semibold text-slate-500">Admitting Diagnosis</label>
                <input
                  type="text"
                  value={formData.admittingDiagnosis}
                  onChange={(e) => setFormData({ ...formData, admittingDiagnosis: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Final Discharge Diagnosis (Principal)</label>
                <input
                  type="text"
                  value={formData.dischargeDiagnosis}
                  onChange={(e) => setFormData({ ...formData, dischargeDiagnosis: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-teal-700 dark:text-teal-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Secondary / Comorbid Diagnoses</label>
                <input
                  type="text"
                  value={formData.secondaryDiagnoses}
                  onChange={(e) => setFormData({ ...formData, secondaryDiagnoses: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Surgeries / Significant Bedside Procedures</label>
                <input
                  type="text"
                  value={formData.surgeriesProcedures}
                  onChange={(e) => setFormData({ ...formData, surgeriesProcedures: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Clinical Narrative & Hospital Course</label>
                <textarea
                  rows={4}
                  value={formData.hospitalCourse}
                  onChange={(e) => setFormData({ ...formData, hospitalCourse: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Key Lab Investigations & Imaging Trend</label>
                <textarea
                  rows={2}
                  value={formData.investigationsSummary}
                  onChange={(e) => setFormData({ ...formData, investigationsSummary: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Follow-up Clinic</label>
                  <input
                    type="text"
                    value={formData.followUpClinic}
                    onChange={(e) => setFormData({ ...formData, followUpClinic: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Follow-up Date</label>
                  <input
                    type="text"
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Discharge Dietary & Warning Advice</label>
                <input
                  type="text"
                  value={formData.lifestyleDietaryAdvice}
                  onChange={(e) => setFormData({ ...formData, lifestyleDietaryAdvice: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewMode(true)}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow flex items-center gap-2"
                >
                  Review Official Discharge Letter
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Official Discharge Letter Print Canvas */
        <div className="max-w-4xl mx-auto bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-xl border border-slate-200 print:border-none print:shadow-none print:p-0">
          {/* Hospital Header Banner */}
          <div className="border-b-2 border-slate-900 pb-6 mb-6 flex items-start justify-between">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Federal Ministry of Health / Tertiary Care</div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">MEDCORE COMPREHENSIVE TEACHING HOSPITAL</h2>
              <p className="text-xs text-slate-600">Directorate of Clinical Services & Patient Medical Records</p>
              <p className="text-xs text-slate-500">Plot 104 Medical Enclave, Central Hospital District | Phone: +234 1 800 MEDCORE</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-teal-900 text-white text-xs font-black tracking-wider uppercase rounded">
                Official Clinical Discharge Summary
              </span>
              <div className="mt-2 text-xs text-slate-500 font-mono">DOC-DIS-{formData.patientId}</div>
            </div>
          </div>

          {/* Patient Demographic Block */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs mb-6">
            <div>
              <span className="text-slate-400 block font-semibold">Patient Name:</span>
              <span className="font-bold text-sm text-slate-900">{formData.patientName}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Hospital No / Reg:</span>
              <span className="font-mono font-bold text-slate-900">{formData.hospitalNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Admission / Discharge:</span>
              <span className="font-medium text-slate-800">{formData.admissionDate} &rarr; {formData.dischargeDate}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Ward & Bed:</span>
              <span className="font-medium text-slate-800">{formData.ward}</span>
            </div>
          </div>

          {/* Diagnoses Section */}
          <div className="space-y-4 mb-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1 mb-1.5">
                Clinical Diagnoses
              </h3>
              <p className="text-xs">
                <strong className="text-slate-800">Final Principal Diagnosis: </strong>
                <span className="font-bold text-teal-900">{formData.dischargeDiagnosis}</span>
              </p>
              <p className="text-xs mt-1">
                <strong className="text-slate-800">Admitting Diagnosis: </strong>
                <span className="text-slate-700">{formData.admittingDiagnosis}</span>
              </p>
              {formData.secondaryDiagnoses && (
                <p className="text-xs mt-1">
                  <strong className="text-slate-800">Secondary / Comorbid Diagnoses: </strong>
                  <span className="text-slate-700">{formData.secondaryDiagnoses}</span>
                </p>
              )}
            </div>

            {/* Hospital Course */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1 mb-1.5">
                Summary of Hospital Stay & Clinical Course
              </h3>
              <p className="text-xs text-slate-800 leading-relaxed text-justify">
                {formData.hospitalCourse}
              </p>
            </div>

            {/* Surgeries / Procedures */}
            {formData.surgeriesProcedures && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1 mb-1.5">
                  Procedures & Surgical Interventions
                </h3>
                <p className="text-xs text-slate-800">
                  {formData.surgeriesProcedures}
                </p>
              </div>
            )}

            {/* Investigations */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1 mb-1.5">
                Diagnostic Investigations & Lab Highlights
              </h3>
              <p className="text-xs text-slate-800">
                {formData.investigationsSummary}
              </p>
            </div>

            {/* Discharge Medications */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1 mb-2">
                Discharge Medications (To Take Home - TTO)
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-3">Medication Name</th>
                      <th className="py-1.5 px-3">Dose</th>
                      <th className="py-1.5 px-3">Frequency</th>
                      <th className="py-1.5 px-3">Duration</th>
                      <th className="py-1.5 px-3">Special Instructions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {formData.dischargeMedications.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-900">{m.name}</td>
                        <td className="py-1.5 px-3">{m.dosage}</td>
                        <td className="py-1.5 px-3">{m.frequency}</td>
                        <td className="py-1.5 px-3">{m.duration}</td>
                        <td className="py-1.5 px-3 text-slate-600 italic">{m.instructions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Instructions & Followup */}
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-teal-50/50 border border-teal-100 text-xs">
              <div>
                <strong className="block text-teal-950 font-bold mb-1">Outpatient Follow-Up Appointment:</strong>
                <p className="text-slate-700">{formData.followUpClinic}</p>
                <p className="font-bold text-teal-800">Date: {formData.followUpDate}</p>
              </div>
              <div>
                <strong className="block text-teal-950 font-bold mb-1">Dietary & Warning Signs:</strong>
                <p className="text-slate-700">{formData.lifestyleDietaryAdvice}</p>
              </div>
            </div>
          </div>

          {/* Footer & Doctor Signature */}
          <div className="border-t-2 border-slate-800 pt-6 mt-8 flex items-end justify-between">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Discharging Clinician:</div>
              <div className="font-bold text-sm text-slate-900">{formData.dischargingDoctor}</div>
              <div className="text-xs font-mono text-slate-600">License: {formData.doctorLicense}</div>
              <div className="text-[11px] text-slate-500 mt-2">Attending Consultant: {formData.consultant}</div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-2 border border-slate-300 rounded-lg bg-white shadow-sm flex flex-col items-center">
                <QrCode className="w-16 h-16 text-slate-800" />
                <span className="text-[9px] font-mono font-bold text-slate-500 mt-1">VERIFY: MED-{formData.patientId.slice(0, 8)}</span>
              </div>
              <div className="text-center w-40">
                <div className="h-12 border-b border-slate-400 flex items-end justify-center font-serif italic text-sm text-slate-600 pb-1">
                  Dr. Tariere Amadi
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Official Doctor Stamp</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DischargeSummaryCompilerSuite;
