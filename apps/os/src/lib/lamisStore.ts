/**
 * LAMIS (Lafiya Management Information System) + NDR + RADET Engine for MedCore.
 * Fully aligned with Federal Ministry of Health (FMoH), PEPFAR, and AKSMoH standards.
 */

export interface LamisArtPatient {
  id: string;
  artNumber: string; // e.g. "AKS/EKT/019/0042"
  hospitalNumber: string;
  nin?: string;
  fullName: string;
  sex: 'M' | 'F';
  dob: string;
  phone: string;
  lga: string;
  facilityId: string;
  
  // Clinical HIV Care & Treatment
  dateEnrolled: string;
  dateArtInitiation: string;
  regimenLine: 'First Line' | 'Second Line' | 'Third Line' | 'Salvage';
  currentRegimen: string; // e.g. 'TLD (TDF/3TC/DTG)', 'TLE', 'ABC/3TC/DTG'
  whoClinicalStage: 1 | 2 | 3 | 4;
  functionalStatus: 'Working' | 'Ambulatory' | 'Bedridden';
  currentArtStatus: 'Active' | 'IIT (Defaulted)' | 'Transferred Out' | 'Stopped' | 'Dead';
  
  // Tuberculosis / HIV Co-infection
  tbScreeningStatus: 'No Signs' | 'Suspect' | 'Confirmed Active' | 'On Treatment';
  tbPreventiveTherapy: 'Not Started' | 'In Progress (3HP)' | 'In Progress (6H)' | 'Completed';
  tptCompletionDate?: string;
  
  // PMTCT (Maternal & Child Health)
  isPregnant: boolean;
  edd?: string;
  breastfeeding: boolean;
  infantPcrTestStatus?: 'Not Applicable' | 'Pending 6-week PCR' | 'Negative' | 'Positive';
  
  // Key Populations
  keyPopulationGroup?: 'General Population' | 'FSW' | 'MSM' | 'PWID' | 'Transgender' | 'Inmate';
  
  // Pharmacy & MMD (Multi-Month Dispensing)
  lastPickupDate: string;
  daysOfRefillSupplied: 30 | 60 | 90 | 180; // 30 (1M), 90 (3M), 180 (6M MMD)
  nextPickupDate: string;
  adherencePercentage: number; // e.g. 95%
  
  // Laboratory LIMS (CD4 & Viral Load)
  baselineCd4: number;
  lastCd4Count: number;
  lastCd4Date: string;
  lastViralLoadCopies: number; // e.g. 20 copies/ml or 4500 copies/ml
  lastViralLoadDate: string;
  viralLoadSampleStatus: 'Result Returned' | 'Specimen in Transit to PCR Lab' | 'Sample Collected' | 'Due for Test';
  viralSuppressed: boolean; // <1000 copies/mL
  
  // AI & ML Risk Stratification
  iitRiskScore: 'High Risk' | 'Medium Risk' | 'Low Risk';
  iitRiskProbability: number; // 0 to 1
  riskFactors: string[];
}

const STORAGE_KEY = 'medcore_lamis_cohort_v1';
const EVENT_NAME = 'medcore-lamis-sync';

const INITIAL_COHORT: LamisArtPatient[] = [];

export function listLamisCohort(facilityId?: string): LamisArtPatient[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const all = JSON.parse(raw) as LamisArtPatient[];
    if (facilityId) {
      return all.filter((p) => !p.facilityId || p.facilityId.toUpperCase() === facilityId.toUpperCase());
    }
    return all;
  } catch {
    return [];
  }
}

export function saveLamisCohort(patients: LamisArtPatient[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    /* ignore */
  }
}

export function subscribeLamisCohort(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT_NAME, cb);
    window.removeEventListener('storage', cb);
  };
}

/**
 * Generates the official PEPFAR / CDC / USAID Retention Audit & Determination Tool (RADET).
 */
export function generateRadetReport(facilityId: string) {
  const cohort = listLamisCohort(facilityId);
  const period = new Date().toISOString().slice(0, 7); // e.g. "2026-10"
  
  const rows = cohort.map((p, idx) => ({
    sn: idx + 1,
    hospitalNumber: p.hospitalNumber,
    artNumber: p.artNumber,
    nin: p.nin || '—',
    sex: p.sex,
    dob: p.dob,
    age: Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 3600 * 1000)),
    dateArtInitiated: p.dateArtInitiation,
    regimenLine: p.regimenLine,
    currentRegimen: p.currentRegimen,
    dateLastRefill: p.lastPickupDate,
    daysOfRefill: p.daysOfRefillSupplied,
    nextRefillDate: p.nextPickupDate,
    currentArtStatus: p.currentArtStatus,
    viralLoadCopies: p.lastViralLoadCopies,
    dateLastViralLoad: p.lastViralLoadDate,
    viralSuppression: p.viralSuppressed ? 'Suppressed (<1000)' : 'Unsuppressed (>=1000)',
    tbScreening: p.tbScreeningStatus,
    tptStatus: p.tbPreventiveTherapy,
    pmtctStatus: p.isPregnant ? 'Pregnant' : p.breastfeeding ? 'Breastfeeding' : 'Not Pregnant',
  }));

  const summary = {
    facilityId,
    period,
    generatedAt: new Date().toISOString(),
    txCurr: cohort.filter((p) => p.currentArtStatus === 'Active').length,
    txNew: cohort.filter((p) => p.dateArtInitiation.startsWith(period)).length,
    mmdCoverageRate: Math.round(
      (cohort.filter((p) => p.daysOfRefillSupplied >= 90).length / (cohort.length || 1)) * 100
    ),
    viralSuppressionRate: Math.round(
      (cohort.filter((p) => p.viralSuppressed).length / (cohort.length || 1)) * 100
    ),
    highIitRiskCount: cohort.filter((p) => p.iitRiskScore === 'High Risk').length,
  };

  return { summary, rows };
}

/**
 * Generates standard National Data Repository (NDR) compliant XML/JSON container for Federal MoH.
 */
export function generateNdrContainer(facilityId: string) {
  const cohort = listLamisCohort(facilityId);
  const now = new Date().toISOString();
  
  return {
    MessageHeader: {
      MessageStatusCode: 'INITIAL',
      MessageCreationDateTime: now,
      MessageSchemaVersion: '1.6.2',
      SendingOrganization: {
        FacilityName: facilityId === 'IGH-EKT' ? 'Immanuel General Hospital, Eket' : facilityId,
        FacilityID: facilityId,
        State: 'Akwa Ibom',
        Country: 'Nigeria',
      },
    },
    IndividualRecords: cohort.map((p) => ({
      PatientDemographics: {
        PatientIdentifier: p.artNumber,
        HospitalNumber: p.hospitalNumber,
        NationalIdentityNumber: p.nin || '',
        Gender: p.sex,
        DateOfBirth: p.dob,
        StateOfOrigin: 'Akwa Ibom',
        LGA: p.lga,
      },
      HIVEncounter: {
        DateOfEnrollment: p.dateEnrolled,
        DateOfARTInitiation: p.dateArtInitiation,
        BaselineCD4: p.baselineCd4,
        WHOClinicalStage: p.whoClinicalStage,
        CurrentRegimenLine: p.regimenLine,
        CurrentRegimen: p.currentRegimen,
        CurrentStatus: p.currentArtStatus,
      },
      RegimenHistory: [
        {
          PrescriptionDate: p.lastPickupDate,
          RegimenCode: p.currentRegimen,
          DaysOfRefill: p.daysOfRefillSupplied,
          NextAppointmentDate: p.nextPickupDate,
          AdherenceRate: `${p.adherencePercentage}%`,
        },
      ],
      LaboratoryReport: [
        {
          TestDate: p.lastViralLoadDate,
          TestName: 'HIV Viral Load',
          ResultNumeric: p.lastViralLoadCopies,
          ResultInterpretation: p.viralSuppressed ? 'SUPPRESSED' : 'UNSUPPRESSED',
        },
        {
          TestDate: p.lastCd4Date,
          TestName: 'CD4 Count',
          ResultNumeric: p.lastCd4Count,
        },
      ],
      TuberculosisReport: {
        ScreeningStatus: p.tbScreeningStatus,
        TPTStatus: p.tbPreventiveTherapy,
      },
      PMTCTReport: {
        PregnancyStatus: p.isPregnant,
        InfantPCRStatus: p.infantPcrTestStatus,
      },
    })),
  };
}

export function downloadRadetCsv(facilityId: string) {
  const { summary, rows } = generateRadetReport(facilityId);
  const headers = [
    'S/N',
    'Hospital Number',
    'ART Unique ID',
    'NIN',
    'Sex',
    'DOB',
    'Age',
    'ART Initiation Date',
    'Regimen Line',
    'Current ARV Regimen',
    'Last Refill Date',
    'Refill Days (MMD)',
    'Next Appointment Date',
    'Current ART Status',
    'Last Viral Load (copies/mL)',
    'Viral Load Date',
    'Viral Suppression',
    'TB Screening',
    'TPT Status',
    'PMTCT Status',
  ];

  const csvRows = rows.map((r) => [
    r.sn,
    `"${r.hospitalNumber}"`,
    `"${r.artNumber}"`,
    `"${r.nin}"`,
    r.sex,
    r.dob,
    r.age,
    r.dateArtInitiated,
    `"${r.regimenLine}"`,
    `"${r.currentRegimen}"`,
    r.dateLastRefill,
    r.daysOfRefill,
    r.nextRefillDate,
    r.currentArtStatus,
    r.viralLoadCopies,
    r.dateLastViralLoad,
    `"${r.viralSuppression}"`,
    `"${r.tbScreening}"`,
    `"${r.tptStatus}"`,
    `"${r.pmtctStatus}"`,
  ].join(','));

  const csvContent = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `RADET_PEPFAR_${facilityId}_${summary.period}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadNdrJson(facilityId: string) {
  const ndr = generateNdrContainer(facilityId);
  const blob = new Blob([JSON.stringify(ndr, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `NDR_CONTAINER_${facilityId}_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
