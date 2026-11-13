'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  HelpCircle,
  EyeOff,
  UserCheck,
  CheckCircle2,
  GitBranch,
  ShieldCheck,
  Building,
  Target,
} from 'lucide-react';

interface IncidentReport {
  id: string;
  incidentType: 'Medication Administration Error' | 'Surgical Count / Foreign Object' | 'Patient Fall' | 'Needlestick / Blood Exposure' | 'Diagnostic / Specimen Mislabel' | 'Equipment Malfunction' | 'Delay in Critical Care';
  severity: 'Near Miss' | 'No Harm Incident' | 'Harm Incident (Minor/Mod)' | 'Sentinel Event (Severe/Catastrophic)';
  date: string;
  time: string;
  location: string;
  isAnonymous: boolean;
  reporterName?: string;
  reporterRole?: string;
  briefDescription: string;
  immediateActionsTaken: string;
  investigationStatus: 'Open - Under Review' | 'RCA in Progress' | 'CAPA Implemented' | 'Closed by CQI';
  rca5Whys?: {
    why1: string;
    why2: string;
    why3: string;
    why4: string;
    why5: string;
    rootCause: string;
  };
  correctiveActions?: string[];
}

export function ClinicalIncidentSafetySuite() {
  const [activeTab, setActiveTab] = useState<'log' | 'report-new' | 'rca-workspace'>('log');
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);

  const [incidents, setIncidents] = useState<IncidentReport[]>([
    {
      id: 'INC-2026-081',
      incidentType: 'Medication Administration Error',
      severity: 'Near Miss',
      date: '2026-11-12',
      time: '08:30',
      location: 'Pediatric Ward 2',
      isAnonymous: true,
      briefDescription: 'Gentamicin 80mg vial was placed in the 8mg pediatric tray. Caught by administering nurse during 5 Rights cross-check before IV push was given.',
      immediateActionsTaken: 'Vial returned to pharmacy satellite depot. Alert sent to ward stock checker. No dose given to patient.',
      investigationStatus: 'RCA in Progress',
      rca5Whys: {
        why1: '80mg adult vial was in pediatric dose bin.',
        why2: 'Restocking pharmacist was working double night shift under low light.',
        why3: 'Adult and pediatric Gentamicin vials share similar yellow cap design (Look-Alike Sound-Alike - LASA).',
        why4: 'Tall-Man lettering and barcode scan verification were bypassed during night restocking.',
        why5: 'Lack of automated 2D barcode verification at floor stock replenishment.',
        rootCause: 'LASA packaging vulnerability compounded by night-shift fatigue and absent electronic barcode cross-check on restock.',
      },
      correctiveActions: [
        'Affix high-alert neon stickers to all pediatric ampoules.',
        'Mandate barcode verification on satellite pharmacy restocking.',
      ],
    },
    {
      id: 'INC-2026-082',
      incidentType: 'Patient Fall',
      severity: 'Harm Incident (Minor/Mod)',
      date: '2026-11-11',
      time: '23:15',
      location: 'Female Medical Ward 1B',
      isAnonymous: false,
      reporterName: 'RN Chiamaka E.',
      reporterRole: 'Night Charge Nurse',
      briefDescription: '72yo post-CVA patient attempted unassisted unassisted transfer to commode at night. Slipped on wet floor tile. Sustained 2cm scalp laceration.',
      immediateActionsTaken: 'MO called immediately; head CT ordered (negative for intracranial bleed). Scalp laceration sutured with 3-0 Ethilon. Bed rails raised.',
      investigationStatus: 'CAPA Implemented',
      correctiveActions: [
        'Morse Fall Scale reassessed on all neurology admissions.',
        'Installed bed alarm motion sensors and high-absorbency non-slip mats.',
      ],
    },
    {
      id: 'INC-2026-083',
      incidentType: 'Needlestick / Blood Exposure',
      severity: 'No Harm Incident',
      date: '2026-11-09',
      time: '14:20',
      location: 'Accident & Emergency Resus Bay 1',
      isAnonymous: false,
      reporterName: 'Dr. Tariere Amadi',
      reporterRole: 'House Officer',
      briefDescription: 'Superficial needlestick puncture to left index finger while recapping 21G syringe after blood culture draw from trauma patient.',
      immediateActionsTaken: 'Site washed immediately with copious soap and water. Source patient consented to rapid HIV, HBV, HCV screening (all negative). Staff PEP starter pack initiated within 1 hour per CDC protocol.',
      investigationStatus: 'Closed by CQI',
    },
  ]);

  // New Report Form State
  const [incidentType, setIncidentType] = useState<IncidentReport['incidentType']>('Medication Administration Error');
  const [severity, setSeverity] = useState<IncidentReport['severity']>('Near Miss');
  const [date, setDate] = useState<string>('2026-11-13');
  const [time, setTime] = useState<string>('10:00');
  const [location, setLocation] = useState<string>('Theatre 3 (Surgical)');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);
  const [reporterName, setReporterName] = useState<string>('');
  const [reporterRole, setReporterRole] = useState<string>('');
  const [briefDescription, setBriefDescription] = useState<string>('');
  const [immediateActionsTaken, setImmediateActionsTaken] = useState<string>('');

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefDescription) return;

    const newReport: IncidentReport = {
      id: `INC-2026-${String(incidents.length + 84).padStart(3, '0')}`,
      incidentType,
      severity,
      date,
      time,
      location,
      isAnonymous,
      reporterName: isAnonymous ? undefined : reporterName,
      reporterRole: isAnonymous ? undefined : reporterRole,
      briefDescription,
      immediateActionsTaken,
      investigationStatus: 'Open - Under Review',
    };

    setIncidents([newReport, ...incidents]);
    setActiveTab('log');
    setBriefDescription('');
    setImmediateActionsTaken('');
  };

  const openRca = (incident: IncidentReport) => {
    setSelectedIncident(incident);
    setActiveTab('rca-workspace');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Clinical Incident & Safety Governance</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Non-punitive just-culture incident logging, sentinel event escalation, and Root Cause Analysis (RCA 5-Whys & CAPA) for Clinical Quality Assurance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('log')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'log'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            Incident Log ({incidents.length})
          </button>
          <button
            onClick={() => setActiveTab('report-new')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'report-new'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Plus className="w-4 h-4" />
            Report Incident
          </button>
        </div>
      </div>

      {activeTab === 'log' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-400 font-medium">Recorded Incidents</span>
              <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{incidents.length}</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              <span className="text-xs font-semibold">Near Misses (Catch & Learn)</span>
              <div className="text-2xl font-black mt-1 text-emerald-600">
                {incidents.filter(i => i.severity === 'Near Miss').length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
              <span className="text-xs font-semibold">Under Active RCA Review</span>
              <div className="text-2xl font-black mt-1 text-amber-600">
                {incidents.filter(i => i.investigationStatus === 'RCA in Progress' || i.investigationStatus === 'Open - Under Review').length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-300">
              <span className="text-xs font-semibold">CAPA Implemented</span>
              <div className="text-2xl font-black mt-1 text-purple-600">
                {incidents.filter(i => i.investigationStatus === 'CAPA Implemented' || i.investigationStatus === 'Closed by CQI').length}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600">
                      {incident.id}
                    </span>
                    <strong className="text-sm text-slate-900 dark:text-white">
                      {incident.incidentType}
                    </strong>
                    <span className="text-xs text-slate-400">
                      • {incident.location} ({incident.date} {incident.time})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      incident.severity === 'Sentinel Event (Severe/Catastrophic)'
                        ? 'bg-red-500 text-white animate-pulse'
                        : incident.severity === 'Harm Incident (Minor/Mod)'
                        ? 'bg-rose-500/20 text-rose-600'
                        : incident.severity === 'Near Miss'
                        ? 'bg-emerald-500/20 text-emerald-600'
                        : 'bg-amber-500/20 text-amber-700'
                    }`}>
                      {incident.severity}
                    </span>

                    <button
                      onClick={() => openRca(incident)}
                      className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      RCA & CAPA
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="md:col-span-2 space-y-1.5">
                    <p className="text-slate-700 dark:text-slate-300">
                      <strong>Narrative: </strong>{incident.briefDescription}
                    </p>
                    <p className="text-slate-500">
                      <strong>Immediate Mitigation: </strong>{incident.immediateActionsTaken}
                    </p>
                  </div>

                  <div className="space-y-1 md:border-l md:border-slate-100 dark:md:border-slate-800 md:pl-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Reporter:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {incident.isAnonymous ? 'Anonymous (Confidential)' : incident.reporterName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">QI Status:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{incident.investigationStatus}</span>
                    </div>
                    {incident.rca5Whys && (
                      <div className="text-[11px] text-emerald-600 font-medium pt-1">
                        Root cause identified: {incident.rca5Whys.rootCause}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'report-new' && (
        <form onSubmit={handleCreateReport} className="max-w-3xl mx-auto space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-indigo-600" />
                Confidential Incident Report Submission
              </h2>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymousCheck"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="anonymousCheck" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Submit Anonymously (Just Culture Protected)
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">Classification of Incident</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value as IncidentReport['incidentType'])}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value="Medication Administration Error">Medication Administration Error</option>
                  <option value="Surgical Count / Foreign Object">Surgical Count / Foreign Object</option>
                  <option value="Patient Fall">Patient Fall</option>
                  <option value="Needlestick / Blood Exposure">Needlestick / Blood Exposure</option>
                  <option value="Diagnostic / Specimen Mislabel">Diagnostic / Specimen Mislabel</option>
                  <option value="Equipment Malfunction">Equipment Malfunction</option>
                  <option value="Delay in Critical Care">Delay in Critical Care</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Incident Severity Level</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as IncidentReport['severity'])}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-rose-600"
                >
                  <option value="Near Miss">Near Miss (Caught before reaching patient)</option>
                  <option value="No Harm Incident">No Harm Incident (Reached patient, no harm observed)</option>
                  <option value="Harm Incident (Minor/Mod)">Harm Incident (Minor to moderate reversible harm)</option>
                  <option value="Sentinel Event (Severe/Catastrophic)">Sentinel Event (Severe injury / resuscitation / death)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500">Date of Occurrence</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Location / Ward</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. ICU Bay 4"
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500">Objective Incident Description (What Happened)</label>
              <textarea
                rows={4}
                required
                placeholder="Provide factual, sequential description without speculation or emotional language..."
                value={briefDescription}
                onChange={(e) => setBriefDescription(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs leading-relaxed"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500">Immediate Mitigations / Clinical Actions Taken</label>
              <textarea
                rows={2}
                placeholder="What was done immediately for patient safety and clinical stabilization..."
                value={immediateActionsTaken}
                onChange={(e) => setImmediateActionsTaken(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs leading-relaxed"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              Submit Confidential Safety Report
            </button>
          </div>
        </form>
      )}

      {activeTab === 'rca-workspace' && selectedIncident && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-600">{selectedIncident.id}</span>
                <h2 className="text-lg font-bold">{selectedIncident.incidentType} - Root Cause Analysis (RCA)</h2>
              </div>
              <button
                onClick={() => setActiveTab('log')}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Back to Incident Log
              </button>
            </div>

            {/* 5-Whys Framework */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <GitBranch className="w-4 h-4" />
                The 5-Whys Deep Root-Cause Ladder
              </h3>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                <div>
                  <strong className="text-slate-500 block">Why #1 (Direct failure):</strong>
                  <p className="mt-0.5 text-slate-800 dark:text-slate-200">{selectedIncident.rca5Whys?.why1 || 'Direct operational deviation.'}</p>
                </div>
                <div>
                  <strong className="text-slate-500 block">Why #2:</strong>
                  <p className="mt-0.5 text-slate-800 dark:text-slate-200">{selectedIncident.rca5Whys?.why2 || 'Environmental or systemic contributory factor.'}</p>
                </div>
                <div>
                  <strong className="text-slate-500 block">Why #3:</strong>
                  <p className="mt-0.5 text-slate-800 dark:text-slate-200">{selectedIncident.rca5Whys?.why3 || 'Process or packaging vulnerability.'}</p>
                </div>
                <div>
                  <strong className="text-slate-500 block">Why #4:</strong>
                  <p className="mt-0.5 text-slate-800 dark:text-slate-200">{selectedIncident.rca5Whys?.why4 || 'Verification gate bypass or barrier gap.'}</p>
                </div>
                <div>
                  <strong className="text-slate-500 block">Why #5 (Systemic root):</strong>
                  <p className="mt-0.5 text-slate-800 dark:text-slate-200">{selectedIncident.rca5Whys?.why5 || 'Underlying institutional design or resource constraint.'}</p>
                </div>
                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-300 font-semibold">
                  Root Cause Statement: {selectedIncident.rca5Whys?.rootCause || 'Under investigation.'}
                </div>
              </div>
            </div>

            {/* Corrective & Preventive Action Plan (CAPA) */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Target className="w-4 h-4" />
                Corrective and Preventive Action Plan (CAPA)
              </h3>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                {selectedIncident.correctiveActions ? (
                  selectedIncident.correctiveActions.map((action, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{action}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 italic">No CAPA items recorded yet. CQI Committee review in progress.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClinicalIncidentSafetySuite;
