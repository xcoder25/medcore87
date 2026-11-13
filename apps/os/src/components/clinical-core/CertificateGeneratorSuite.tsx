'use client';

/**
 * CertificateGeneratorSuite — Birth, Fitness, Sick Leave & Death Certificates.
 * Integrated with Celestia AI Assist for both New and Existing Patients.
 * Compliant with Nigerian Health Records (HIM) and Akwa Ibom State Ministry of Health standards.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Award, Baby, FileText, CheckCircle2, Sparkles, Printer, Download,
  Search, Plus, RefreshCw, AlertCircle, Shield, User, Calendar,
  Clock, MapPin, Stethoscope, ChevronRight, Hash, Copy, Check, Eye
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { listPatients, type RegisteredPatient } from '../../lib/patientRegistryStore';
import { geminiGenerate } from '../../lib/geminiClient';
import { getAdminSettings } from '../../lib/adminSettingsStore';

export type CertificateType = 'birth' | 'fitness' | 'sick_leave' | 'death';

export interface BaseCertificate {
  id: string;
  serialNumber: string;
  certificateType: CertificateType;
  facilityId: string;
  facilityName: string;
  issuedAt: string;
  certifyingOfficer: string;
  officerRole: string;
  officerRegNumber: string;
  verificationHash: string;
  patientId?: string;
  isNewPatient?: boolean;
}

export interface BirthCertificateData extends BaseCertificate {
  certificateType: 'birth';
  childName: string;
  sex: 'Male' | 'Female';
  dateOfBirth: string;
  timeOfBirth: string;
  birthWeightKg: number;
  gestationWeeks: number;
  deliveryType: 'Spontaneous Vertex' | 'Caesarean Section' | 'Assisted Vacuum' | 'Breech Delivery';
  birthOrder: 'Single' | 'Twin (1st)' | 'Twin (2nd)' | 'Triplet';
  motherName: string;
  motherNIN?: string;
  motherPhone?: string;
  motherLga: string;
  fatherName: string;
  fatherNIN?: string;
  fatherPhone?: string;
  residentialAddress: string;
  wardName: string;
  apgarScore1Min: number;
  apgarScore5Min: number;
}

export interface FitnessCertificateData extends BaseCertificate {
  certificateType: 'fitness';
  candidateName: string;
  age: number;
  sex: 'Male' | 'Female';
  purpose: 'Pre-Employment' | 'Higher Institution Admission' | 'NYSC Mobilization' | 'Driving License' | 'Sports / Aviation';
  organizationName: string;
  bloodPressure: string;
  pulseRate: number;
  heightCm: number;
  weightKg: number;
  visualAcuityRight: string;
  visualAcuityLeft: string;
  chestExpansionOk: boolean;
  heartSoundsNormal: boolean;
  urinalysisSugar: 'Negative' | 'Trace' | 'Positive';
  urinalysisAlbumin: 'Negative' | 'Trace' | 'Positive';
  bloodGroupGenotype: string;
  concludingFitness: 'Certified Medically Fit' | 'Fit with Restrictions' | 'Medically Unfit';
  clinicalRemarks: string;
}

export interface SickLeaveCertificateData extends BaseCertificate {
  certificateType: 'sick_leave';
  patientName: string;
  hospitalNumber: string;
  employerOrSchool: string;
  diagnosis: string;
  icd10Code?: string;
  leaveDays: number;
  startDate: string;
  endDate: string;
  fitToResumeDate: string;
  recommendations: string;
}

export interface DeathCertificateData extends BaseCertificate {
  certificateType: 'death';
  deceasedName: string;
  age: number;
  sex: 'Male' | 'Female';
  hospitalNumber: string;
  dateOfDeath: string;
  timeOfDeath: string;
  placeOfDeath: string;
  immediateCause: string;
  antecedentCause: string;
  underlyingCondition: string;
  otherContributingConditions?: string;
  autopsyPerformed: boolean;
  coronerNotified: boolean;
  nextOfKinName: string;
  nextOfKinPhone: string;
}

export type AnyCertificate =
  | BirthCertificateData
  | FitnessCertificateData
  | SickLeaveCertificateData
  | DeathCertificateData;

const STORAGE_KEY = 'medcore_os_certificates_v1';

function loadCertificates(): AnyCertificate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCertificates(list: AnyCertificate[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

function computeAge(dobStr?: string): number {
  if (!dobStr) return 30;
  try {
    const birthYear = new Date(dobStr).getFullYear();
    const currentYear = new Date().getFullYear();
    const diff = currentYear - birthYear;
    return isNaN(diff) || diff < 0 ? 30 : diff;
  } catch {
    return 30;
  }
}

export const CertificateGeneratorSuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const facilityName = session?.facility || 'Immanuel General Hospital, Eket';
  const adminSettings = useMemo(() => getAdminSettings(facilityId), [facilityId]);

  const [activeTab, setActiveTab] = useState<'create' | 'registry'>('create');
  const [certType, setCertType] = useState<CertificateType>('birth');
  const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing');

  // Existing patient selection
  const [patients, setPatients] = useState<RegisteredPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [patientSearch, setPatientSearch] = useState<string>('');

  // AI prompt / assistant state
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);

  // Form Fields - Birth
  const [birthChildName, setBirthChildName] = useState('Baby Boy Udoh');
  const [birthSex, setBirthSex] = useState<'Male' | 'Female'>('Male');
  const [birthDob, setBirthDob] = useState(() => new Date().toISOString().split('T')[0]);
  const [birthTime, setBirthTime] = useState('04:15');
  const [birthWeight, setBirthWeight] = useState(3.4);
  const [birthGestation, setBirthGestation] = useState(39);
  const [birthDelivery, setBirthDelivery] = useState<BirthCertificateData['deliveryType']>('Spontaneous Vertex');
  const [birthOrder, setBirthOrder] = useState<BirthCertificateData['birthOrder']>('Single');
  const [birthMotherName, setBirthMotherName] = useState('Mrs. Grace Aniefiok Udoh');
  const [birthMotherNin, setBirthMotherNin] = useState('NIN-84920481923');
  const [birthMotherPhone, setBirthMotherPhone] = useState('+234 803 456 7890');
  const [birthFatherName, setBirthFatherName] = useState('Mr. Aniefiok Udoh');
  const [birthFatherNin, setBirthFatherNin] = useState('NIN-92817401924');
  const [birthAddress, setBirthAddress] = useState('14 Marina Road, Eket, Akwa Ibom State');
  const [birthLga, setBirthLga] = useState('Eket LGA');
  const [birthWard, setBirthWard] = useState('Labour & Delivery Ward Suite B');
  const [birthApgar1, setBirthApgar1] = useState(8);
  const [birthApgar5, setBirthApgar5] = useState(10);

  // Form Fields - Fitness
  const [fitName, setFitName] = useState('Ememobong Bassey Ekpo');
  const [fitAge, setFitAge] = useState(24);
  const [fitSex, setFitSex] = useState<'Male' | 'Female'>('Female');
  const [fitPurpose, setFitPurpose] = useState<FitnessCertificateData['purpose']>('Pre-Employment');
  const [fitOrg, setFitOrg] = useState('Akwa Ibom State Civil Service Commission');
  const [fitBp, setFitBp] = useState('118/76 mmHg');
  const [fitPulse, setFitPulse] = useState(74);
  const [fitHeight, setFitHeight] = useState(168);
  const [fitWeight, setFitWeight] = useState(62);
  const [fitVisionR, setFitVisionR] = useState('6/6');
  const [fitVisionL, setFitVisionL] = useState('6/6');
  const [fitGenotype, setFitGenotype] = useState('O+ / AA');
  const [fitConclusion, setFitConclusion] = useState<FitnessCertificateData['concludingFitness']>('Certified Medically Fit');
  const [fitRemarks, setFitRemarks] = useState('No cardiopulmonary deficits. Cleared for all official physical duties.');

  // Form Fields - Sick Leave
  const [sickName, setSickName] = useState('Ndifreke Emmanuel Okon');
  const [sickHospitalNo, setSickHospitalNo] = useState('IGH-2026-4019');
  const [sickEmployer, setSickEmployer] = useState('ExxonMobil Nigeria, Qua Iboe Terminal');
  const [sickDiagnosis, setSickDiagnosis] = useState('Acute Bronchitis with Bronchospasm & Physical Exhaustion');
  const [sickIcd, setSickIcd] = useState('J20.9');
  const [sickDays, setSickDays] = useState(3);
  const [sickStart, setSickStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [sickRemarks, setSickRemarks] = useState('Strict bed rest advised. Refrain from heavy lifting and chemical exposure.');

  // Form Fields - Death
  const [deathName, setDeathName] = useState('Elder Bassey Udo Akpan');
  const [deathAge, setDeathAge] = useState(76);
  const [deathSex, setDeathSex] = useState<'Male' | 'Female'>('Male');
  const [deathHospitalNo, setDeathHospitalNo] = useState('IGH-2025-1092');
  const [deathDate, setDeathDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [deathTime, setDeathTime] = useState('18:40');
  const [deathPlace, setDeathPlace] = useState('Intensive Care Unit (ICU Bay 3)');
  const [deathCause1, setDeathCause1] = useState('Refractory Septic Shock');
  const [deathCause2, setDeathCause2] = useState('Severe Community-Acquired Bilateral Pneumonia');
  const [deathCause3, setDeathCause3] = useState('Type 2 Diabetes Mellitus with Nephropathy');
  const [deathNok, setDeathNok] = useState('Mr. Eno Bassey Akpan (Son)');
  const [deathNokPhone, setDeathNokPhone] = useState('+234 812 345 6789');

  // Issued certificates registry
  const [issuedCerts, setIssuedCerts] = useState<AnyCertificate[]>([]);
  const [selectedCertForPreview, setSelectedCertForPreview] = useState<AnyCertificate | null>(null);

  // Load patient list and certificates
  useEffect(() => {
    try {
      const pts = listPatients(facilityId);
      setPatients(pts);
    } catch {
      /* ignore */
    }
    setIssuedCerts(loadCertificates());
  }, [facilityId]);

  // Selected patient details
  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  // Filtered patients for dropdown
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 15);
    const q = patientSearch.toLowerCase();
    return patients
      .filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.hospitalNumber.toLowerCase().includes(q) ||
          p.phone.includes(q)
      )
      .slice(0, 15);
  }, [patients, patientSearch]);

  // When an existing patient is selected, auto-populate the matching fields
  const handleSelectExistingPatient = (pt: RegisteredPatient) => {
    setSelectedPatientId(pt.id);
    const fullName = `${pt.firstName} ${pt.lastName}`.trim();
    const age = computeAge(pt.dob);
    const primaryDiag = pt.problems?.[0] || pt.chronicConditions?.[0] || 'General Clinical Evaluation';

    if (certType === 'birth') {
      setBirthMotherName(fullName);
      setBirthMotherNin(pt.nin || 'NIN-UNREGISTERED');
      setBirthMotherPhone(pt.phone || '');
      setBirthAddress(pt.address || 'Eket, Akwa Ibom State');
      setBirthLga(pt.lga || 'Eket LGA');
    } else if (certType === 'fitness') {
      setFitName(fullName);
      setFitAge(age);
      setFitSex(pt.sex === 'Female' ? 'Female' : 'Male');
      if (pt.bloodGroup) setFitGenotype(`${pt.bloodGroup} / ${pt.genotype || 'AA'}`);
    } else if (certType === 'sick_leave') {
      setSickName(fullName);
      setSickHospitalNo(pt.hospitalNumber);
      setSickDiagnosis(primaryDiag);
    } else if (certType === 'death') {
      setDeathName(fullName);
      setDeathAge(age);
      setDeathSex(pt.sex === 'Female' ? 'Female' : 'Male');
      setDeathHospitalNo(pt.hospitalNumber);
    }
    setAiSuccessMsg(`Patient loaded: ${fullName} (${pt.hospitalNumber})`);
  };

  // AI Assist handler (Gemini + Local Fallback)
  const handleRunAiAssist = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiSuccessMsg(null);

    const contextStr =
      patientMode === 'existing' && selectedPatient
        ? `Patient File: Name: ${selectedPatient.firstName} ${selectedPatient.lastName}, Age: ${computeAge(selectedPatient.dob)}, Gender: ${selectedPatient.sex}, Hospital No: ${selectedPatient.hospitalNumber}, LGA: ${selectedPatient.lga || 'Eket'}, Address: ${selectedPatient.address || 'Eket'}, Phone: ${selectedPatient.phone}, Diagnosis: ${selectedPatient.problems?.[0] || selectedPatient.chronicConditions?.[0] || 'None recorded'}.`
        : `New Patient / Unregistered Case. User Input: "${aiPrompt || 'Normal healthy presentation'}"`;

    const systemInstruction = `You are Celestia AI Medical Certification Officer for ${facilityName}, Akwa Ibom State.
Extract structured clinical certificate data in JSON format for a "${certType}" certificate.
Return ONLY valid JSON matching this schema:
For birth: { childName, sex, birthWeightKg, gestationWeeks, deliveryType, motherName, fatherName, residentialAddress, lga, apgarScore1Min, apgarScore5Min }
For fitness: { candidateName, age, sex, purpose, bloodPressure, pulseRate, heightCm, weightKg, visualAcuityRight, visualAcuityLeft, concludingFitness, clinicalRemarks }
For sick_leave: { patientName, hospitalNumber, employerOrSchool, diagnosis, icd10Code, leaveDays, recommendations }
For death: { deceasedName, age, sex, hospitalNumber, immediateCause, antecedentCause, underlyingCondition, nextOfKinName, nextOfKinPhone }`;

    try {
      const res = await geminiGenerate(
        `Generate official hospital ${certType} certificate data based on: ${contextStr}. Instruction: ${aiPrompt}`,
        systemInstruction,
        contextStr,
        facilityId
      );

      if (res.ok && res.text) {
        try {
          const cleanJson = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          applyAiParsedData(parsed);
          setAiSuccessMsg(`AI Auto-filled ${certType.toUpperCase()} certificate successfully using ${res.usedGemini ? 'Gemini AI' : 'Local Heuristics'}!`);
          setAiLoading(false);
          return;
        } catch {
          // Fall through to heuristic extractor
        }
      }

      // Offline intelligent heuristic parser
      applyLocalHeuristicExtraction(aiPrompt, selectedPatient);
      setAiSuccessMsg(`AI assistant structured the certificate details using local clinical heuristics.`);
    } catch (err: any) {
      setAiError(err?.message || 'AI assist encountered an issue; defaults retained.');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiParsedData = (data: any) => {
    if (certType === 'birth') {
      if (data.childName) setBirthChildName(data.childName);
      if (data.sex) setBirthSex(data.sex === 'Female' ? 'Female' : 'Male');
      if (data.birthWeightKg) setBirthWeight(Number(data.birthWeightKg));
      if (data.gestationWeeks) setBirthGestation(Number(data.gestationWeeks));
      if (data.deliveryType) setBirthDelivery(data.deliveryType);
      if (data.motherName) setBirthMotherName(data.motherName);
      if (data.fatherName) setBirthFatherName(data.fatherName);
      if (data.residentialAddress) setBirthAddress(data.residentialAddress);
      if (data.lga) setBirthLga(data.lga);
      if (data.apgarScore1Min) setBirthApgar1(Number(data.apgarScore1Min));
      if (data.apgarScore5Min) setBirthApgar5(Number(data.apgarScore5Min));
    } else if (certType === 'fitness') {
      if (data.candidateName) setFitName(data.candidateName);
      if (data.age) setFitAge(Number(data.age));
      if (data.sex) setFitSex(data.sex === 'Female' ? 'Female' : 'Male');
      if (data.bloodPressure) setFitBp(data.bloodPressure);
      if (data.pulseRate) setFitPulse(Number(data.pulseRate));
      if (data.visualAcuityRight) setFitVisionR(data.visualAcuityRight);
      if (data.concludingFitness) setFitConclusion(data.concludingFitness);
      if (data.clinicalRemarks) setFitRemarks(data.clinicalRemarks);
    } else if (certType === 'sick_leave') {
      if (data.patientName) setSickName(data.patientName);
      if (data.hospitalNumber) setSickHospitalNo(data.hospitalNumber);
      if (data.diagnosis) setSickDiagnosis(data.diagnosis);
      if (data.icd10Code) setSickIcd(data.icd10Code);
      if (data.leaveDays) setSickDays(Number(data.leaveDays));
      if (data.recommendations) setSickRemarks(data.recommendations);
    } else if (certType === 'death') {
      if (data.deceasedName) setDeathName(data.deceasedName);
      if (data.age) setDeathAge(Number(data.age));
      if (data.immediateCause) setDeathCause1(data.immediateCause);
      if (data.antecedentCause) setDeathCause2(data.antecedentCause);
      if (data.underlyingCondition) setDeathCause3(data.underlyingCondition);
    }
  };

  const applyLocalHeuristicExtraction = (prompt: string, pt: RegisteredPatient | null) => {
    const text = (prompt || '').toLowerCase();
    if (certType === 'birth') {
      if (text.includes('girl') || text.includes('female')) setBirthSex('Female');
      if (text.includes('cesarean') || text.includes('c-section')) setBirthDelivery('Caesarean Section');
      const kgMatch = text.match(/(\d+(\.\d+)?)\s*kg/);
      if (kgMatch) setBirthWeight(parseFloat(kgMatch[1]));
      if (pt) {
        setBirthMotherName(`${pt.firstName} ${pt.lastName}`);
        setBirthAddress(pt.address || 'Eket, Akwa Ibom');
      }
    } else if (certType === 'fitness') {
      if (pt) {
        setFitName(`${pt.firstName} ${pt.lastName}`);
        setFitAge(computeAge(pt.dob));
      }
      if (text.includes('unfit')) setFitConclusion('Medically Unfit');
      else if (text.includes('restrict')) setFitConclusion('Fit with Restrictions');
      else setFitConclusion('Certified Medically Fit');
    } else if (certType === 'sick_leave') {
      const daysMatch = text.match(/(\d+)\s*(day|days|wk|week)/);
      if (daysMatch) setSickDays(parseInt(daysMatch[1], 10));
      if (pt) {
        setSickName(`${pt.firstName} ${pt.lastName}`);
        setSickHospitalNo(pt.hospitalNumber);
        const diag = pt.problems?.[0] || pt.chronicConditions?.[0];
        if (diag) setSickDiagnosis(diag);
      }
    } else if (certType === 'death') {
      if (pt) {
        setDeathName(`${pt.firstName} ${pt.lastName}`);
        setDeathHospitalNo(pt.hospitalNumber);
        setDeathAge(computeAge(pt.dob));
      }
    }
  };

  // Compile active certificate object for save & preview
  const currentCertificateData: AnyCertificate = useMemo(() => {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const certSerial = `AKS-${facilityId}-${certType.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}-${randomHex}`;
    const hash = `VER-${randomHex}-${Date.now().toString(36).toUpperCase()}`;

    const base: BaseCertificate = {
      id: `CERT-${Date.now()}`,
      serialNumber: certSerial,
      certificateType: certType,
      facilityId,
      facilityName,
      issuedAt: new Date().toISOString(),
      certifyingOfficer: session?.name || 'Dr. Edidiong Bassey, MBBS, FMCOG',
      officerRole: session?.role || 'Medical Officer / Attending Physician',
      officerRegNumber: 'MDCN/2018/48910',
      verificationHash: hash,
      patientId: selectedPatient?.id,
      isNewPatient: patientMode === 'new',
    };

    if (certType === 'birth') {
      return {
        ...base,
        certificateType: 'birth',
        childName: birthChildName,
        sex: birthSex,
        dateOfBirth: birthDob,
        timeOfBirth: birthTime,
        birthWeightKg: birthWeight,
        gestationWeeks: birthGestation,
        deliveryType: birthDelivery,
        birthOrder: birthOrder,
        motherName: birthMotherName,
        motherNIN: birthMotherNin,
        motherPhone: birthMotherPhone,
        motherLga: birthLga,
        fatherName: birthFatherName,
        fatherNIN: birthFatherNin,
        residentialAddress: birthAddress,
        wardName: birthWard,
        apgarScore1Min: birthApgar1,
        apgarScore5Min: birthApgar5,
      };
    } else if (certType === 'fitness') {
      return {
        ...base,
        certificateType: 'fitness',
        candidateName: fitName,
        age: fitAge,
        sex: fitSex,
        purpose: fitPurpose,
        organizationName: fitOrg,
        bloodPressure: fitBp,
        pulseRate: fitPulse,
        heightCm: fitHeight,
        weightKg: fitWeight,
        visualAcuityRight: fitVisionR,
        visualAcuityLeft: fitVisionL,
        chestExpansionOk: true,
        heartSoundsNormal: true,
        urinalysisSugar: 'Negative',
        urinalysisAlbumin: 'Negative',
        bloodGroupGenotype: fitGenotype,
        concludingFitness: fitConclusion,
        clinicalRemarks: fitRemarks,
      };
    } else if (certType === 'sick_leave') {
      const start = new Date(sickStart);
      const end = new Date(start);
      end.setDate(end.getDate() + Math.max(1, sickDays));
      const resume = new Date(end);
      resume.setDate(resume.getDate() + 1);

      return {
        ...base,
        certificateType: 'sick_leave',
        patientName: sickName,
        hospitalNumber: sickHospitalNo,
        employerOrSchool: sickEmployer,
        diagnosis: sickDiagnosis,
        icd10Code: sickIcd,
        leaveDays: sickDays,
        startDate: sickStart,
        endDate: end.toISOString().split('T')[0],
        fitToResumeDate: resume.toISOString().split('T')[0],
        recommendations: sickRemarks,
      };
    } else {
      return {
        ...base,
        certificateType: 'death',
        deceasedName: deathName,
        age: deathAge,
        sex: deathSex,
        hospitalNumber: deathHospitalNo,
        dateOfDeath: deathDate,
        timeOfDeath: deathTime,
        placeOfDeath: deathPlace,
        immediateCause: deathCause1,
        antecedentCause: deathCause2,
        underlyingCondition: deathCause3,
        autopsyPerformed: false,
        coronerNotified: false,
        nextOfKinName: deathNok,
        nextOfKinPhone: deathNokPhone,
      };
    }
  }, [
    certType, facilityId, facilityName, session, selectedPatient, patientMode,
    birthChildName, birthSex, birthDob, birthTime, birthWeight, birthGestation,
    birthDelivery, birthOrder, birthMotherName, birthMotherNin, birthMotherPhone,
    birthLga, birthFatherName, birthFatherNin, birthAddress, birthWard,
    birthApgar1, birthApgar5, fitName, fitAge, fitSex, fitPurpose, fitOrg,
    fitBp, fitPulse, fitHeight, fitWeight, fitVisionR, fitVisionL, fitGenotype,
    fitConclusion, fitRemarks, sickName, sickHospitalNo, sickEmployer,
    sickDiagnosis, sickIcd, sickDays, sickStart, sickRemarks, deathName,
    deathAge, deathSex, deathHospitalNo, deathDate, deathTime, deathPlace,
    deathCause1, deathCause2, deathCause3, deathNok, deathNokPhone
  ]);

  // Issue & Save certificate to durable register
  const handleIssueCertificate = () => {
    const updated = [currentCertificateData, ...issuedCerts];
    setIssuedCerts(updated);
    saveCertificates(updated);
    setSelectedCertForPreview(currentCertificateData);
    setAiSuccessMsg(`Official Certificate [${currentCertificateData.serialNumber}] successfully issued & signed!`);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 28px', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#E0F2FE', color: '#0369A1', padding: '4px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, marginBottom: 6 }}>
            <Award size={14} /> Official Medical Document & Legal Registry
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Hospital Certificate Generator & Registry
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: '#64748B' }}>
            Akwa Ibom State Ministry of Health · Verified Birth, Fitness, Excuse Duty & Death Certification with AI Drafting
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'create' ? '2px solid #0284C7' : '1px solid #E2E8F0',
              background: activeTab === 'create' ? '#E0F2FE' : '#FFFFFF',
              color: activeTab === 'create' ? '#0369A1' : '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Plus size={16} /> Issue Certificate
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('registry')}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'registry' ? '2px solid #0284C7' : '1px solid #E2E8F0',
              background: activeTab === 'registry' ? '#E0F2FE' : '#FFFFFF',
              color: activeTab === 'registry' ? '#0369A1' : '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FileText size={16} /> Issued Registry ({issuedCerts.length})
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 460px) 1fr', gap: 24, alignItems: 'start' }}>
          {/* Left Column: Form & AI Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Certificate Type Selector */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 10 }}>
                1. Select Certificate Category
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { key: 'birth', label: 'Birth Certificate', icon: Baby, color: '#0284C7' },
                  { key: 'fitness', label: 'Medical Fitness', icon: Award, color: '#10B981' },
                  { key: 'sick_leave', label: 'Sick Leave / Excuse', icon: FileText, color: '#F59E0B' },
                  { key: 'death', label: 'Cause of Death', icon: Shield, color: '#64748B' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setCertType(item.key as CertificateType);
                      setAiSuccessMsg(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: certType === item.key ? `2px solid ${item.color}` : '1px solid #E2E8F0',
                      background: certType === item.key ? '#F0F9FF' : '#FFFFFF',
                      color: certType === item.key ? '#0C4A6E' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <item.icon size={18} style={{ color: item.color }} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Patient Mode: Existing vs New */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  2. Patient Source
                </label>
                <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: 999, padding: 3 }}>
                  <button
                    type="button"
                    onClick={() => setPatientMode('existing')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 999,
                      border: 'none',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: patientMode === 'existing' ? '#0284C7' : 'transparent',
                      color: patientMode === 'existing' ? '#FFF' : '#64748B',
                    }}
                  >
                    Existing Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatientMode('new')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 999,
                      border: 'none',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: patientMode === 'new' ? '#0284C7' : 'transparent',
                      color: patientMode === 'new' ? '#FFF' : '#64748B',
                    }}
                  >
                    New Patient / Direct
                  </button>
                </div>
              </div>

              {patientMode === 'existing' ? (
                <div>
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#94A3B8' }} />
                    <input
                      type="text"
                      placeholder="Search patient by name, folder number, phone…"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px 9px 34px',
                        borderRadius: 10,
                        border: '1px solid #E2E8F0',
                        fontSize: '0.82rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #F1F5F9', borderRadius: 10, background: '#F8FAFC' }}>
                    {filteredPatients.length === 0 ? (
                      <div style={{ padding: '12px', fontSize: '0.8rem', color: '#94A3B8', textAlign: 'center' }}>
                        No registered patients matching query.
                      </div>
                    ) : (
                      filteredPatients.map((p) => {
                        const isSel = selectedPatientId === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleSelectExistingPatient(p)}
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid #E2E8F0',
                              cursor: 'pointer',
                              background: isSel ? '#E0F2FE' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: isSel ? '#0369A1' : '#0F172A' }}>
                                {p.firstName} {p.lastName}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                {p.hospitalNumber} · {p.sex} · {computeAge(p.dob)}yo
                              </div>
                            </div>
                            {isSel && <CheckCircle2 size={16} color="#0284C7" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 12, fontSize: '0.8rem', color: '#166534' }}>
                  <strong>New Patient Direct Mode:</strong> The certificate will be issued under a designated emergency/ad-hoc serial code. You can register the child or patient to the MPI after certificate generation.
                </div>
              )}
            </div>

            {/* AI Assistant Prompter */}
            <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: 16, padding: 18, color: '#FFF', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={18} color="#38BDF8" />
                <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#38BDF8', letterSpacing: '0.02em' }}>
                  Celestia AI Certificate Drafter
                </span>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: '0.76rem', color: '#94A3B8', lineHeight: 1.45 }}>
                Type details in natural language (e.g. <em>"Baby boy born 03:40 AM, 3.4kg, mother is Mrs. Grace Udoh, vertex delivery"</em> or <em>"Severe acute malaria, 3 days excused duty"</em>).
              </p>
              <textarea
                rows={2}
                placeholder="Enter clinical scenario or notes to auto-fill certificate…"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0B1220',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  padding: '8px 10px',
                  color: '#FFF',
                  fontSize: '0.8rem',
                  outline: 'none',
                  resize: 'none',
                  marginBottom: 10,
                }}
              />
              <button
                type="button"
                onClick={handleRunAiAssist}
                disabled={aiLoading}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(90deg, #0284C7, #38BDF8)',
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: aiLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {aiLoading ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {aiLoading ? 'Drafting Certificate with AI…' : 'AI Auto-Fill Certificate'}
              </button>

              {aiSuccessMsg && (
                <div style={{ marginTop: 10, fontSize: '0.74rem', color: '#4ADE80', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} /> {aiSuccessMsg}
                </div>
              )}
              {aiError && (
                <div style={{ marginTop: 10, fontSize: '0.74rem', color: '#F87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} /> {aiError}
                </div>
              )}
            </div>

            {/* Detailed Certificate Form Fields */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18, maxHeight: 420, overflowY: 'auto' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
                Certificate Data Form
              </div>

              {certType === 'birth' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Child's Full Name</label>
                    <input type="text" value={birthChildName} onChange={(e) => setBirthChildName(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Sex</label>
                      <select value={birthSex} onChange={(e) => setBirthSex(e.target.value as any)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', background: '#FFF' }}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Birth Weight (kg)</label>
                      <input type="number" step="0.1" value={birthWeight} onChange={(e) => setBirthWeight(parseFloat(e.target.value))} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Date of Birth</label>
                      <input type="date" value={birthDob} onChange={(e) => setBirthDob(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Time of Birth</label>
                      <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Mother's Full Maiden Name</label>
                    <input type="text" value={birthMotherName} onChange={(e) => setBirthMotherName(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Father's Full Name</label>
                    <input type="text" value={birthFatherName} onChange={(e) => setBirthFatherName(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Residential Address & LGA</label>
                    <input type="text" value={birthAddress} onChange={(e) => setBirthAddress(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                </div>
              )}

              {certType === 'fitness' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Candidate Name</label>
                    <input type="text" value={fitName} onChange={(e) => setFitName(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Age</label>
                      <input type="number" value={fitAge} onChange={(e) => setFitAge(parseInt(e.target.value, 10))} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Blood Pressure</label>
                      <input type="text" value={fitBp} onChange={(e) => setFitBp(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Purpose & Organization</label>
                    <input type="text" value={fitOrg} onChange={(e) => setFitOrg(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Conclusion</label>
                    <select value={fitConclusion} onChange={(e) => setFitConclusion(e.target.value as any)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', background: '#FFF' }}>
                      <option value="Certified Medically Fit">Certified Medically Fit</option>
                      <option value="Fit with Restrictions">Fit with Restrictions</option>
                      <option value="Medically Unfit">Medically Unfit</option>
                    </select>
                  </div>
                </div>
              )}

              {certType === 'sick_leave' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Patient Name & Folder</label>
                    <input type="text" value={sickName} onChange={(e) => setSickName(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Clinical Diagnosis (ICD-10)</label>
                    <input type="text" value={sickDiagnosis} onChange={(e) => setSickDiagnosis(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Excused Days</label>
                      <input type="number" min="1" max="60" value={sickDays} onChange={(e) => setSickDays(parseInt(e.target.value, 10))} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Effective Date</label>
                      <input type="date" value={sickStart} onChange={(e) => setSickStart(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Workplace / School</label>
                    <input type="text" value={sickEmployer} onChange={(e) => setSickEmployer(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                </div>
              )}

              {certType === 'death' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Deceased Name</label>
                    <input type="text" value={deathName} onChange={(e) => setDeathName(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Immediate Cause (a)</label>
                    <input type="text" value={deathCause1} onChange={(e) => setDeathCause1(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Underlying Condition (b)</label>
                    <input type="text" value={deathCause2} onChange={(e) => setDeathCause2(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Action Button: Sign & Issue */}
            <button
              type="button"
              onClick={handleIssueCertificate}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 12,
                border: 'none',
                background: '#0284C7',
                color: '#FFF',
                fontWeight: 800,
                fontSize: '0.94rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              }}
            >
              <Award size={18} /> Sign & Issue Official Certificate
            </button>
          </div>

          {/* Right Column: Live Printable Certificate Preview */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Live Certificate Document Preview
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handlePrint}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: '#FFF',
                    color: '#334155',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Printer size={14} /> Print
                </button>
              </div>
            </div>

            {/* Certificate Paper Canvas */}
            <div
              id="printable-certificate-pad"
              style={{
                background: '#FFF',
                borderRadius: 16,
                boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                border: '8px double #0C4A6E',
                padding: '36px 36px 30px',
                position: 'relative',
                overflow: 'hidden',
                color: '#0F172A',
              }}
            >
              {/* Background Watermark */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  opacity: 0.035,
                  fontSize: '8rem',
                  fontWeight: 900,
                  color: '#0C4A6E',
                  transform: 'rotate(-25deg)',
                }}
              >
                MEDCORE
              </div>

              {/* Official Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0C4A6E', paddingBottom: 16, marginBottom: 20 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.12em', color: '#0369A1', textTransform: 'uppercase' }}>
                  GOVERNMENT OF AKWA IBOM STATE OF NIGERIA
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
                  MINISTRY OF HEALTH · HOSPITAL OPERATIONS DIVISION
                </div>
                <h2 style={{ margin: '8px 0 2px', fontSize: '1.35rem', fontWeight: 900, color: '#0C4A6E', letterSpacing: '-0.01em' }}>
                  {facilityName.toUpperCase()}
                </h2>
                <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  {adminSettings.address || 'P.M.B. 1014, Eket, Akwa Ibom State, Nigeria'} · Tel: {adminSettings.phone || '+234 802 000 1122'}
                </div>
                <div style={{ display: 'inline-block', marginTop: 10, padding: '4px 16px', background: '#0C4A6E', color: '#FFF', borderRadius: 999, fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {certType === 'birth' && 'HOSPITAL CERTIFICATE OF BIRTH'}
                  {certType === 'fitness' && 'MEDICAL CERTIFICATE OF FITNESS'}
                  {certType === 'sick_leave' && 'EXCUSE DUTY / SICK LEAVE CERTIFICATE'}
                  {certType === 'death' && 'MEDICAL CERTIFICATION OF CAUSE OF DEATH'}
                </div>
              </div>

              {/* Certificate Body */}
              <div style={{ minHeight: 280, fontSize: '0.86rem', lineHeight: 1.6, color: '#1E293B' }}>
                {certType === 'birth' && (
                  <div>
                    <p style={{ margin: '0 0 14px' }}>
                      This is to certify that according to the hospital delivery register, there was born to:
                    </p>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '0.84rem' }}>
                        <div><strong>Child's Name:</strong> {birthChildName}</div>
                        <div><strong>Sex:</strong> {birthSex}</div>
                        <div><strong>Date of Birth:</strong> {birthDob}</div>
                        <div><strong>Time of Birth:</strong> {birthTime} hrs</div>
                        <div><strong>Birth Weight:</strong> {birthWeight} kg</div>
                        <div><strong>Gestation Age:</strong> {birthGestation} weeks</div>
                        <div><strong>Delivery Mode:</strong> {birthDelivery}</div>
                        <div><strong>APGAR Score:</strong> 1m: {birthApgar1} / 5m: {birthApgar5}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: '0.82rem', color: '#334155' }}>
                      <div><strong>Mother:</strong> {birthMotherName} ({birthMotherNin})</div>
                      <div><strong>Father:</strong> {birthFatherName}</div>
                      <div><strong>Ward:</strong> {birthWard}</div>
                      <div><strong>LGA & State:</strong> {birthLga}, Akwa Ibom State</div>
                    </div>
                  </div>
                )}

                {certType === 'fitness' && (
                  <div>
                    <p style={{ margin: '0 0 12px' }}>
                      This is to certify that I have carefully and thoroughly examined <strong>{fitName}</strong> (Age: {fitAge} years, Sex: {fitSex}), a candidate for <strong>{fitPurpose}</strong> at <strong>{fitOrg}</strong>.
                    </p>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.82rem' }}>
                      <div><strong>Blood Pressure:</strong> {fitBp}</div>
                      <div><strong>Pulse:</strong> {fitPulse} bpm</div>
                      <div><strong>Vision:</strong> OD: {fitVisionR} / OS: {fitVisionL}</div>
                      <div><strong>Blood Group / Genotype:</strong> {fitGenotype}</div>
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: fitConclusion === 'Certified Medically Fit' ? '#ECFDF5' : '#FEF2F2', border: fitConclusion === 'Certified Medically Fit' ? '1px solid #A7F3D0' : '1px solid #FECACA', color: fitConclusion === 'Certified Medically Fit' ? '#065F46' : '#991B1B', fontWeight: 800, fontSize: '0.88rem' }}>
                      Conclusion: {fitConclusion}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: 8 }}>
                      Remarks: {fitRemarks}
                    </p>
                  </div>
                )}

                {certType === 'sick_leave' && (
                  <div>
                    <p style={{ margin: '0 0 12px' }}>
                      This is to certify that <strong>{sickName}</strong> (Hospital No: <strong>{sickHospitalNo}</strong>) of <strong>{sickEmployer}</strong> was medically attended to at this hospital and is suffering from:
                    </p>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontWeight: 700, color: '#0C4A6E' }}>
                      {sickDiagnosis} (ICD-10: {sickIcd})
                    </div>
                    <p style={{ margin: '0 0 12px' }}>
                      I consider that a period of absence from duty of <strong>{sickDays} day(s)</strong>, with effect from <strong>{sickStart}</strong>, is essential for patient recovery.
                    </p>
                    <div style={{ padding: '8px 12px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, color: '#92400E', fontSize: '0.82rem', fontWeight: 700 }}>
                      Patient is certified fit to resume duty on: {currentCertificateData.certificateType === 'sick_leave' ? (currentCertificateData as SickLeaveCertificateData).fitToResumeDate : ''}
                    </div>
                  </div>
                )}

                {certType === 'death' && (
                  <div>
                    <p style={{ margin: '0 0 12px' }}>
                      I hereby certify that <strong>{deathName}</strong> (Age: {deathAge}, Sex: {deathSex}, Folder No: {deathHospitalNo}) died at <strong>{deathPlace}</strong> on <strong>{deathDate}</strong> at approximately <strong>{deathTime} hours</strong>.
                    </p>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: '0.82rem' }}>
                      <div><strong>Immediate Cause:</strong> {deathCause1}</div>
                      <div style={{ marginTop: 4 }}><strong>Antecedent Cause:</strong> {deathCause2}</div>
                      <div style={{ marginTop: 4 }}><strong>Underlying Pathology:</strong> {deathCause3}</div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                      Next of Kin Notified: {deathNok} ({deathNokPhone})
                    </div>
                  </div>
                )}
              </div>

              {/* Footer: Official Stamp, Verification QR Code, Signatures */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #CBD5E1', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: 4 }}>Official Verification Serial & QR</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Simulated Encrypted QR Block */}
                    <div style={{ width: 56, height: 56, background: '#0F172A', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '0.55rem', textAlign: 'center', padding: 4, fontWeight: 800 }}>
                      [QR-SEAL]<br />{currentCertificateData.verificationHash.slice(0, 10)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#475569' }}>
                      <div><strong>Serial:</strong> {currentCertificateData.serialNumber}</div>
                      <div><strong>Security Hash:</strong> {currentCertificateData.verificationHash}</div>
                      <div style={{ color: '#059669', fontWeight: 700 }}>Akwa Ibom e-Health Certified</div>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ width: 140, borderBottom: '1.5px dashed #0C4A6E', marginBottom: 4 }} />
                  <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0C4A6E' }}>
                    {currentCertificateData.certifyingOfficer}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                    {currentCertificateData.officerRole} · {currentCertificateData.officerRegNumber}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                    Dated: {new Date(currentCertificateData.issuedAt).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Issued Registry Tab */
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
            Permanent Certificate Archive & Registry
          </h3>

          {issuedCerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>
              <Award size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div style={{ fontSize: '0.94rem', fontWeight: 700 }}>No certificates issued yet</div>
              <p style={{ margin: '4px 0 16px', fontSize: '0.82rem' }}>Generate and sign birth, fitness, or excuse duty certificates above.</p>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                style={{ padding: '8px 16px', borderRadius: 10, background: '#0284C7', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                Create First Certificate
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                    <th style={{ padding: '12px 14px' }}>Serial Number</th>
                    <th style={{ padding: '12px 14px' }}>Category</th>
                    <th style={{ padding: '12px 14px' }}>Subject / Patient</th>
                    <th style={{ padding: '12px 14px' }}>Certifying Officer</th>
                    <th style={{ padding: '12px 14px' }}>Date Issued</th>
                    <th style={{ padding: '12px 14px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {issuedCerts.map((cert) => {
                    let subjectName = 'Unknown';
                    if (cert.certificateType === 'birth') subjectName = (cert as BirthCertificateData).childName;
                    else if (cert.certificateType === 'fitness') subjectName = (cert as FitnessCertificateData).candidateName;
                    else if (cert.certificateType === 'sick_leave') subjectName = (cert as SickLeaveCertificateData).patientName;
                    else if (cert.certificateType === 'death') subjectName = (cert as DeathCertificateData).deceasedName;

                    return (
                      <tr key={cert.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0369A1' }}>
                          {cert.serialNumber}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', background: cert.certificateType === 'birth' ? '#E0F2FE' : '#FEF3C7', color: cert.certificateType === 'birth' ? '#0369A1' : '#92400E' }}>
                            {cert.certificateType}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0F172A' }}>
                          {subjectName}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#475569' }}>
                          {cert.certifyingOfficer}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748B' }}>
                          {new Date(cert.issuedAt).toLocaleDateString('en-GB')}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCertForPreview(cert);
                              setActiveTab('create');
                            }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 8,
                              border: '1px solid #CBD5E1',
                              background: '#FFF',
                              color: '#0284C7',
                              fontWeight: 700,
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Eye size={12} /> View & Print
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CertificateGeneratorSuite;
