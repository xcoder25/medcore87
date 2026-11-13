'use client';

import React, { useState } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  Plus,
  FileCheck2,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Send,
  Building2,
  Info,
} from 'lucide-react';
import { listPatients, type FacilityPatient } from '@/lib/patientRegistryStore';

interface AdrReport {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  suspectedDrug: string;
  brandName?: string;
  batchNumber: string;
  dosage: string;
  route: string;
  therapyStartDate: string;
  reactionStartDate: string;
  reactionDescription: string;
  reactionSeverity: 'Mild' | 'Moderate' | 'Severe' | 'Life-Threatening' | 'Fatal';
  dechallenge: 'Positive (improved upon stopping)' | 'Negative (no change)' | 'Not Stopped' | 'Unknown';
  rechallenge: 'Positive (recurred upon reintroduction)' | 'Negative (did not recur)' | 'Not Reintroduced';
  naranjoScore: number;
  naranjoCausality: 'Definite' | 'Probable' | 'Possible' | 'Doubtful';
  outcome: 'Recovered' | 'Recovering' | 'Not Recovered' | 'Fatal' | 'Unknown';
  reporterName: string;
  reporterCadre: string;
  status: 'Draft' | 'Submitted to NPC/WHO' | 'Acknowledged';
}

const NARANJO_QUESTIONS = [
  { q: '1. Are there previous conclusive reports on this reaction?', yes: 1, no: 0, dontKnow: 0 },
  { q: '2. Did the adverse event appear after the suspected drug was administered?', yes: 2, no: -1, dontKnow: 0 },
  { q: '3. Did the adverse reaction improve when the drug was discontinued or a specific antagonist was administered?', yes: 1, no: 0, dontKnow: 0 },
  { q: '4. Did the adverse reaction reappear when the drug was readministered?', yes: 2, no: -1, dontKnow: 0 },
  { q: '5. Are there alternative causes (other than the drug) that could on their own have caused the reaction?', yes: -1, no: 2, dontKnow: 0 },
  { q: '6. Did the reaction appear when a placebo was given?', yes: -1, no: 1, dontKnow: 0 },
  { q: '7. Was the drug detected in the blood (or other fluids) in concentrations known to be toxic?', yes: 1, no: 0, dontKnow: 0 },
  { q: '8. Was the reaction more severe when the dose was increased, or less severe when the dose was decreased?', yes: 1, no: 0, dontKnow: 0 },
  { q: '9. Did the patient have a similar reaction to the same or similar drugs in any previous exposure?', yes: 1, no: 0, dontKnow: 0 },
  { q: '10. Was the adverse event confirmed by any objective evidence?', yes: 1, no: 0, dontKnow: 0 },
];

function getNaranjoCategory(score: number): 'Definite' | 'Probable' | 'Possible' | 'Doubtful' {
  if (score >= 9) return 'Definite';
  if (score >= 5) return 'Probable';
  if (score >= 1) return 'Possible';
  return 'Doubtful';
}

export function PharmacovigilanceAdrSuite() {
  const [patients] = useState<FacilityPatient[]>(() => {
    try {
      return listPatients();
    } catch {
      return [];
    }
  });
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || 'DEMO-01');
  const [activeTab, setActiveTab] = useState<'reports' | 'new-yellow-form'>('reports');

  // Naranjo Answers: array of 'yes' | 'no' | 'dontKnow'
  const [naranjoAnswers, setNaranjoAnswers] = useState<Record<number, 'yes' | 'no' | 'dontKnow'>>({
    0: 'yes',
    1: 'yes',
    2: 'yes',
    3: 'dontKnow',
    4: 'no',
    5: 'dontKnow',
    6: 'dontKnow',
    7: 'dontKnow',
    8: 'no',
    9: 'yes',
  });

  const calculateScore = () => {
    let score = 0;
    NARANJO_QUESTIONS.forEach((q, idx) => {
      const ans = naranjoAnswers[idx] || 'dontKnow';
      score += q[ans];
    });
    return score;
  };

  const currentScore = calculateScore();
  const currentCategory = getNaranjoCategory(currentScore);

  const [reports, setReports] = useState<AdrReport[]>([
    {
      id: 'ADR-2026-0042',
      patientId: patients[0]?.id || 'DEMO-01',
      patientName: patients[0] ? `${patients[0].firstName} ${patients[0].lastName}` : 'Chidiebere Okafor',
      age: 44,
      gender: 'Male',
      suspectedDrug: 'Ceftriaxone IV',
      brandName: 'Rocephin 1g',
      batchNumber: 'LOT-B94812',
      dosage: '1g IV 12-hourly',
      route: 'Intravenous',
      therapyStartDate: '2026-11-10',
      reactionStartDate: '2026-11-10 (15 min post-infusion)',
      reactionDescription: 'Acute generalized urticaria, facial angioedema, inspiratory stridor, hypotension (BP 80/50). Responded promptly to IM Adrenaline (0.5mg 1:1000) and IV Hydrocortisone.',
      reactionSeverity: 'Severe',
      dechallenge: 'Positive (improved upon stopping)',
      rechallenge: 'Not Reintroduced',
      naranjoScore: 7,
      naranjoCausality: 'Probable',
      outcome: 'Recovered',
      reporterName: 'Pharm. Adaeze Obi, MPharm, RPh',
      reporterCadre: 'Clinical Pharmacist',
      status: 'Submitted to NPC/WHO',
    },
    {
      id: 'ADR-2026-0043',
      patientId: patients[1]?.id || 'DEMO-02',
      patientName: patients[1] ? `${patients[1].firstName} ${patients[1].lastName}` : 'Amina Yusuf',
      age: 29,
      gender: 'Female',
      suspectedDrug: 'Nevirapine',
      brandName: 'Viramune 200mg',
      batchNumber: 'NVP-2025-X71',
      dosage: '200mg daily lead-in',
      route: 'Oral',
      therapyStartDate: '2026-10-28',
      reactionStartDate: '2026-11-09',
      reactionDescription: 'Severe maculopapular rash involving trunk and extremities, fever 38.8°C, oral mucosal erosion. Suspected Stevens-Johnson Syndrome (SJS). Drug immediately discontinued.',
      reactionSeverity: 'Life-Threatening',
      dechallenge: 'Positive (improved upon stopping)',
      rechallenge: 'Not Reintroduced',
      naranjoScore: 8,
      naranjoCausality: 'Probable',
      outcome: 'Recovering',
      reporterName: 'Dr. Tariere Amadi, MBBS',
      reporterCadre: 'Medical Officer',
      status: 'Acknowledged',
    },
  ]);

  // Form State
  const [suspectedDrug, setSuspectedDrug] = useState<string>('');
  const [brandName, setBrandName] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [dosage, setDosage] = useState<string>('');
  const [route, setRoute] = useState<string>('Oral');
  const [therapyStartDate, setTherapyStartDate] = useState<string>('2026-11-11');
  const [reactionStartDate, setReactionStartDate] = useState<string>('2026-11-12');
  const [reactionSeverity, setReactionSeverity] = useState<AdrReport['reactionSeverity']>('Moderate');
  const [reactionDescription, setReactionDescription] = useState<string>('');
  const [reporterName, setReporterName] = useState<string>('Pharm. Adaeze Obi');
  const [reporterCadre, setReporterCadre] = useState<string>('Clinical Pharmacist');

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspectedDrug || !reactionDescription) return;

    const pt = patients.find((p: FacilityPatient) => p.id === selectedPatientId);

    const newReport: AdrReport = {
      id: `ADR-2026-${String(reports.length + 44).padStart(4, '0')}`,
      patientId: selectedPatientId,
      patientName: pt ? `${pt.firstName} ${pt.lastName}` : 'Selected Patient',
      age: 40,
      gender: pt?.sex || 'Unknown',
      suspectedDrug,
      brandName,
      batchNumber: batchNumber || 'UNKNOWN-LOT',
      dosage,
      route,
      therapyStartDate,
      reactionStartDate,
      reactionDescription,
      reactionSeverity,
      dechallenge: 'Positive (improved upon stopping)',
      rechallenge: 'Not Reintroduced',
      naranjoScore: currentScore,
      naranjoCausality: currentCategory,
      outcome: 'Recovering',
      reporterName,
      reporterCadre,
      status: 'Submitted to NPC/WHO',
    };

    setReports([newReport, ...reports]);
    setActiveTab('reports');
    setSuspectedDrug('');
    setReactionDescription('');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Pharmacovigilance & Yellow Form ADR Registry</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            National Pharmacovigilance Centre (NPC / NAFDAC / WHO-UMC) adverse drug reaction tracking and algorithmic Naranjo causality scoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'reports'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            ADR Registry Log ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('new-yellow-form')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'new-yellow-form'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Plus className="w-4 h-4" />
            File Yellow Form
          </button>
        </div>
      </div>

      {activeTab === 'reports' ? (
        /* Registry View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-400 font-medium">Total ADR Reports</span>
              <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{reports.length}</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-400 font-medium">Life-Threatening / Severe</span>
              <div className="text-2xl font-black mt-1 text-red-500">
                {reports.filter(r => r.reactionSeverity === 'Severe' || r.reactionSeverity === 'Life-Threatening').length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-400 font-medium">WHO / NPC Submitted</span>
              <div className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
                {reports.filter(r => r.status === 'Submitted to NPC/WHO' || r.status === 'Acknowledged').length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-400 font-medium">Average Naranjo Score</span>
              <div className="text-2xl font-black mt-1 text-amber-600">
                {(reports.reduce((acc, r) => acc + r.naranjoScore, 0) / (reports.length || 1)).toFixed(1)} / 10
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">
                      {report.id}
                    </span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {report.patientName} ({report.gender}, ~{report.age}y)
                    </span>
                    <span className="text-xs text-slate-400">
                      • {report.patientId}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      report.reactionSeverity === 'Life-Threatening'
                        ? 'bg-red-500 text-white'
                        : report.reactionSeverity === 'Severe'
                        ? 'bg-rose-500/20 text-rose-600'
                        : 'bg-amber-500/20 text-amber-700'
                    }`}>
                      {report.reactionSeverity}
                    </span>

                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center gap-1">
                      <FileCheck2 className="w-3.5 h-3.5" />
                      {report.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Suspected Drug & Batch:</span>
                    <strong className="text-slate-900 dark:text-slate-200 text-sm">{report.suspectedDrug}</strong>
                    <div className="text-slate-500 mt-0.5">{report.brandName} • Lot: {report.batchNumber}</div>
                    <div className="text-slate-500">{report.dosage} ({report.route})</div>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Reaction Presentation:</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5 line-clamp-3">
                      {report.reactionDescription}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Naranjo Causality:</span>
                      <span className="font-extrabold text-amber-600">{report.naranjoScore} pts ({report.naranjoCausality})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Dechallenge:</span>
                      <span className="text-slate-700 dark:text-slate-300">{report.dechallenge}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Patient Outcome:</span>
                      <span className="text-emerald-600 font-bold">{report.outcome}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1">
                      Reported by {report.reporterName} ({report.reporterCadre})
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Form View */
        <form onSubmit={handleCreateReport} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-amber-500" />
                NAFDAC / WHO Yellow Form Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Patient</label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    {patients.map((p: FacilityPatient) => (
                      <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Suspected Generic Drug Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Artemether-Lumefantrine, Gentamicin"
                    value={suspectedDrug}
                    onChange={(e) => setSuspectedDrug(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Brand Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Coartem, Rocephin"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Batch / Lot Number</label>
                  <input
                    type="text"
                    placeholder="e.g. LOT-4820A"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Dosage & Route</label>
                  <input
                    type="text"
                    placeholder="e.g. 500mg Oral Twice Daily"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Therapy Start Date</label>
                  <input
                    type="date"
                    value={therapyStartDate}
                    onChange={(e) => setTherapyStartDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Reaction Onset Date</label>
                  <input
                    type="date"
                    value={reactionStartDate}
                    onChange={(e) => setReactionStartDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Reaction Severity</label>
                  <select
                    value={reactionSeverity}
                    onChange={(e) => setReactionSeverity(e.target.value as AdrReport['reactionSeverity'])}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-amber-600"
                  >
                    <option value="Mild">Mild (Self-limiting)</option>
                    <option value="Moderate">Moderate (Requires Rx modification)</option>
                    <option value="Severe">Severe (Hospitalization prolonged)</option>
                    <option value="Life-Threatening">Life-Threatening (ICU / Anaphylaxis)</option>
                    <option value="Fatal">Fatal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Detailed Adverse Reaction Clinical Narrative</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe signs, symptoms, onset latency, anatomical distribution, lab findings, and interventions rendered..."
                  value={reactionDescription}
                  onChange={(e) => setReactionDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Reporter Name</label>
                  <input
                    type="text"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Professional Cadre</label>
                  <input
                    type="text"
                    value={reporterCadre}
                    onChange={(e) => setReporterCadre(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Naranjo Causality Calculator Side Panel */}
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold">Naranjo Causality Algorithm</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  currentCategory === 'Definite'
                    ? 'bg-purple-600 text-white'
                    : currentCategory === 'Probable'
                    ? 'bg-amber-500 text-white'
                    : currentCategory === 'Possible'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-500 text-white'
                }`}>
                  {currentScore} pts: {currentCategory}
                </span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 text-xs">
                {NARANJO_QUESTIONS.map((q, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{q.q}</p>
                    <div className="flex items-center gap-4 text-[11px]">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={`naranjo-${idx}`}
                          checked={naranjoAnswers[idx] === 'yes'}
                          onChange={() => setNaranjoAnswers({ ...naranjoAnswers, [idx]: 'yes' })}
                          className="text-amber-600"
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={`naranjo-${idx}`}
                          checked={naranjoAnswers[idx] === 'no'}
                          onChange={() => setNaranjoAnswers({ ...naranjoAnswers, [idx]: 'no' })}
                          className="text-amber-600"
                        />
                        No
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={`naranjo-${idx}`}
                          checked={naranjoAnswers[idx] === 'dontKnow'}
                          onChange={() => setNaranjoAnswers({ ...naranjoAnswers, [idx]: 'dontKnow' })}
                          className="text-amber-600"
                        />
                        Do not know
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Submit Yellow Form to NPC / WHO
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

export default PharmacovigilanceAdrSuite;
