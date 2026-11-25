/**
 * FHIR R4-oriented export stubs + DHIS2 event mapping + Paper-to-FHIR digitization mappers.
 * Not a full server — portable HL7 FHIR R4 JSON for HIE / DHIS2 adapters.
 */
import type { FacilityPatient } from './patientRegistryStore';
import type { ClinicalOrder } from './clinicalEventBus';
import type { ReceptionVisit } from './receptionOpsStore';

export type DigitizedRecordKind =
  | 'patient_folder'
  | 'handwritten_lab'
  | 'ultrasound_report'
  | 'mixed_chart';

export interface DigitizedLabObservation {
  code?: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: 'normal' | 'high' | 'low' | 'critical';
}

export interface DigitizedUltrasoundFindings {
  modality: string;
  studyDate?: string;
  gestationalAgeWeeks?: number | null;
  fetalHeartRateBpm?: number | null;
  placentaPosition?: string;
  organFindings: string[];
  impression: string;
  criticalAlert?: string;
}

export interface DigitizedPaperRecord {
  recordKind: DigitizedRecordKind;
  sourceLabel?: string;
  patientDemographics: {
    firstName: string;
    lastName: string;
    hospitalNumber?: string;
    dob?: string;
    sex?: 'Male' | 'Female' | 'Other';
    phone?: string;
    lga?: string;
    nhiaNumber?: string;
    bloodGroup?: string;
    genotype?: string;
    allergies?: string[];
    chronicConditions?: string[];
  };
  labObservations: DigitizedLabObservation[];
  ultrasoundFindings?: DigitizedUltrasoundFindings | null;
  diagnoses: Array<{ icd11Code?: string; display: string }>;
  medications: Array<{ name: string; dosage?: string; frequency?: string }>;
  clinicalSummary: string;
  panicAlerts: string[];
  confidence: number;
  warnings: string[];
}

export function patientToFhir(p: FacilityPatient) {
  return {
    resourceType: 'Patient',
    id: p.id,
    identifier: [
      { system: 'urn:medcore:hospital-number', value: p.hospitalNumber },
      ...(p.nin ? [{ system: 'urn:nigeria:nin', value: p.nin }] : []),
      ...(p.nhiaNumber ? [{ system: 'urn:nigeria:nhia', value: p.nhiaNumber }] : []),
    ],
    name: [{ use: 'official', family: p.lastName, given: [p.firstName, p.middleName].filter(Boolean) }],
    gender: p.sex === 'Male' ? 'male' : p.sex === 'Female' ? 'female' : 'other',
    birthDate: p.dob || undefined,
    telecom: p.phone ? [{ system: 'phone', value: p.phone }] : [],
    address: p.address
      ? [{ text: p.address, district: p.lga, state: p.state, country: 'NG' }]
      : [],
  };
}

export function orderToFhirServiceRequest(o: ClinicalOrder) {
  return {
    resourceType: 'ServiceRequest',
    id: o.id,
    status: o.status === 'resulted' ? 'completed' : o.status === 'cancelled' ? 'revoked' : 'active',
    intent: 'order',
    priority: o.priority === 'stat' ? 'stat' : o.priority === 'urgent' ? 'urgent' : 'routine',
    code: { text: o.name, coding: [{ code: o.code, display: o.name }] },
    subject: { reference: `Patient/${o.patientId}`, display: o.patientName },
    authoredOn: o.createdAt,
    requester: { display: o.orderedBy },
  };
}

export function visitToDhis2Event(v: ReceptionVisit, program = 'OPD') {
  return {
    program,
    orgUnit: v.facilityId,
    eventDate: v.checkedInAt.slice(0, 10),
    status: 'COMPLETED',
    dataValues: [
      { dataElement: 'patient_name', value: v.patientName },
      { dataElement: 'hospital_number', value: v.hospitalNumber },
      { dataElement: 'department', value: v.department },
      { dataElement: 'visit_type', value: v.visitType },
      { dataElement: 'queue_status', value: v.status },
    ],
  };
}

export function buildFhirBundle(resources: object[]) {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: resources.map((r) => ({ resource: r })),
  };
}

/** Full facility FHIR collection for HIE / offline transfer */
export function exportFacilityFhirBundle(input: {
  patients: FacilityPatient[];
  orders: ClinicalOrder[];
  visits?: ReceptionVisit[];
}) {
  const resources: object[] = [];
  for (const p of input.patients) resources.push(patientToFhir(p));
  for (const o of input.orders) resources.push(orderToFhirServiceRequest(o));
  for (const v of input.visits || []) {
    resources.push({
      resourceType: 'Encounter',
      id: v.id,
      status: v.status === 'completed' || v.status === 'no_show' || v.status === 'cancelled' ? 'finished' : 'in-progress',
      class: { code: 'AMB', display: 'ambulatory' },
      subject: { display: v.patientName },
      period: { start: v.checkedInAt },
      serviceType: { text: v.department },
    });
  }
  return buildFhirBundle(resources);
}

export function labObservationToFhir(
  obs: DigitizedLabObservation,
  patientRef: string,
  index: number
) {
  const numericVal = Number.parseFloat(String(obs.value || '').replace(/[^\d.-]/g, ''));
  const interpCode =
    obs.flag === 'critical'
      ? 'AA'
      : obs.flag === 'high'
        ? 'H'
        : obs.flag === 'low'
          ? 'L'
          : 'N';

  return {
    resourceType: 'Observation',
    id: `obs-digitized-${index + 1}`,
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory',
          },
        ],
      },
    ],
    code: {
      coding: obs.code ? [{ system: 'http://loinc.org', code: obs.code, display: obs.testName }] : undefined,
      text: obs.testName,
    },
    subject: { reference: patientRef },
    ...(Number.isFinite(numericVal) && /^[\s<>~]*-?\d/.test(String(obs.value || ''))
      ? {
          valueQuantity: {
            value: numericVal,
            unit: obs.unit || '',
            system: 'http://unitsofmeasure.org',
          },
        }
      : { valueString: `${obs.value}${obs.unit ? ` ${obs.unit}` : ''}`.trim() }),
    interpretation: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: interpCode,
          },
        ],
      },
    ],
    ...(obs.referenceRange ? { referenceRange: [{ text: obs.referenceRange }] } : {}),
  };
}

export function ultrasoundDiagnosticReportToFhir(
  us: DigitizedUltrasoundFindings,
  patientRef: string
) {
  return {
    resourceType: 'DiagnosticReport',
    id: 'diag-ultrasound-1',
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: 'RAD',
            display: 'Radiology / Ultrasound',
          },
        ],
      },
    ],
    code: {
      text: us.modality || 'External Ultrasound Scan Report',
    },
    subject: { reference: patientRef },
    effectiveDateTime: us.studyDate || new Date().toISOString().slice(0, 10),
    conclusion: [
      us.gestationalAgeWeeks != null ? `Gestational Age: ${us.gestationalAgeWeeks} weeks.` : '',
      us.fetalHeartRateBpm != null ? `Fetal Heart Rate: ${us.fetalHeartRateBpm} bpm.` : '',
      us.placentaPosition ? `Placenta: ${us.placentaPosition}.` : '',
      us.organFindings.length ? `Findings: ${us.organFindings.join('; ')}.` : '',
      us.impression ? `Impression: ${us.impression}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

export function conditionToFhir(
  diag: { icd11Code?: string; display: string },
  patientRef: string,
  index: number
) {
  return {
    resourceType: 'Condition',
    id: `cond-digitized-${index + 1}`,
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
        },
      ],
    },
    code: {
      coding: diag.icd11Code
        ? [{ system: 'http://id.who.int/icd/release/11/mms', code: diag.icd11Code, display: diag.display }]
        : undefined,
      text: diag.display,
    },
    subject: { reference: patientRef },
  };
}

export function medicationRequestToFhir(
  med: { name: string; dosage?: string; frequency?: string },
  patientRef: string,
  index: number
) {
  return {
    resourceType: 'MedicationRequest',
    id: `medreq-digitized-${index + 1}`,
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: { text: med.name },
    subject: { reference: patientRef },
    dosageInstruction: [
      {
        text: [med.dosage, med.frequency].filter(Boolean).join(' · ') || 'As directed',
      },
    ],
  };
}

export function digitizedRecordToFhirBundle(
  record: DigitizedPaperRecord,
  facilityId = 'FAC-ONBOARD'
) {
  const safeIdSlug =
    (record.patientDemographics.hospitalNumber || `${record.patientDemographics.firstName}-${record.patientDemographics.lastName}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'digitized-patient';
  const patientId = `pat-${safeIdSlug}`;
  const patientRef = `Patient/${patientId}`;

  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    identifier: [
      ...(record.patientDemographics.hospitalNumber
        ? [{ system: 'urn:medcore:hospital-number', value: record.patientDemographics.hospitalNumber }]
        : []),
      ...(record.patientDemographics.nhiaNumber
        ? [{ system: 'urn:nigeria:nhia', value: record.patientDemographics.nhiaNumber }]
        : []),
    ],
    name: [
      {
        use: 'official',
        family: record.patientDemographics.lastName || 'Unknown',
        given: [record.patientDemographics.firstName || 'Legacy'],
      },
    ],
    gender:
      record.patientDemographics.sex === 'Male'
        ? 'male'
        : record.patientDemographics.sex === 'Female'
          ? 'female'
          : 'other',
    ...(record.patientDemographics.dob ? { birthDate: record.patientDemographics.dob } : {}),
    ...(record.patientDemographics.phone
      ? { telecom: [{ system: 'phone', value: record.patientDemographics.phone }] }
      : {}),
    ...(record.patientDemographics.lga
      ? { address: [{ district: record.patientDemographics.lga, state: 'Akwa Ibom', country: 'NG' }] }
      : {}),
  };

  const docRefResource = {
    resourceType: 'DocumentReference',
    id: `doc-onboard-${safeIdSlug}`,
    status: 'current',
    type: { text: `Digitized ${record.recordKind.replace(/_/g, ' ')}` },
    subject: { reference: patientRef },
    date: new Date().toISOString(),
    custodian: { display: facilityId },
    description: record.sourceLabel || record.clinicalSummary,
  };

  const resources: object[] = [patientResource, docRefResource];
  record.labObservations.forEach((obs, idx) => {
    resources.push(labObservationToFhir(obs, patientRef, idx));
  });
  if (record.ultrasoundFindings) {
    resources.push(ultrasoundDiagnosticReportToFhir(record.ultrasoundFindings, patientRef));
  }
  record.diagnoses.forEach((diag, idx) => {
    resources.push(conditionToFhir(diag, patientRef, idx));
  });
  record.medications.forEach((med, idx) => {
    resources.push(medicationRequestToFhir(med, patientRef, idx));
  });

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
      tag: [
        {
          system: 'https://medcore.aks.gov.ng/fhir/onboarding-ocr',
          code: record.recordKind,
        },
      ],
    },
    entry: resources.map((resource) => ({ resource })),
  };
}

export function parsePaperRecordDeterministic(
  rawText: string,
  recordKind: DigitizedRecordKind = 'mixed_chart'
): DigitizedPaperRecord {
  const text = String(rawText || '').trim();
  const warnings: string[] = [];
  const panicAlerts: string[] = [];

  const grab = (re: RegExp): string => {
    const m = text.match(re);
    return m?.[1]?.trim() || '';
  };

  const fullName =
    grab(/(?:Patient\s*Name|Name)\s*[:\-]\s*([^\n,;]+)/i) || 'Unassigned Legacy Patient';
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || 'Legacy';
  const lastName = nameParts.slice(1).join(' ') || 'Patient';

  const hospitalNumber = grab(/(?:Folder\s*(?:No|Number|#)|Hosp(?:ital)?\s*(?:No|Number|#)|MRN)\s*[:\-]\s*([A-Z0-9\-\/]+)/i) || undefined;
  const dob = grab(/(?:DOB|Date\s*of\s*Birth)\s*[:\-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) || undefined;
  const sexRaw = grab(/(?:Sex|Gender)\s*[:\-]\s*(Male|Female|M|F)/i).toUpperCase();
  const sex: 'Male' | 'Female' | 'Other' =
    sexRaw === 'M' || sexRaw === 'MALE' ? 'Male' : sexRaw === 'F' || sexRaw === 'FEMALE' ? 'Female' : 'Other';
  const phone = grab(/(?:Phone|Tel|Mobile|GSM)\s*[:\-]\s*([+0-9\s-]{8,16})/i) || undefined;
  const lga = grab(/(?:LGA|Local\s*Gov(?:ernment)?)\s*[:\-]\s*([^\n,;]+)/i) || undefined;
  const nhiaNumber = grab(/(?:AKSHIA|NHIA|HMO)\s*(?:ID|No|Number)?\s*[:\-]\s*([A-Z0-9\-\/]+)/i) || undefined;
  const bloodGroup = grab(/Blood\s*Group\s*[:\-]\s*((?:A|B|AB|O)[+-]?)/i) || undefined;
  const genotype = grab(/Genotype\s*[:\-]\s*(AA|AS|SS|AC|SC)/i).toUpperCase() || undefined;
  const allergyLine = grab(/Allerg(?:y|ies)\s*[:\-]\s*([^\n]+)/i);
  const allergies = allergyLine && !/^none|nil|nka$/i.test(allergyLine)
    ? allergyLine.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const labObservations: DigitizedLabObservation[] = [];

  const hbMatch = text.match(/(?:\bHb\b|Haemoglobin|Hemoglobin)\s*[:\-=]?\s*(\d+(?:\.\d+)?)\s*(g\/d[Ll])?/i);
  if (hbMatch) {
    const val = Number.parseFloat(hbMatch[1]);
    const flag: DigitizedLabObservation['flag'] =
      val < 7 ? 'critical' : val < 11 ? 'low' : val > 17.5 ? 'high' : 'normal';
    if (flag === 'critical') panicAlerts.push(`Critical anaemia detected on scanned lab: Hb ${val} g/dL.`);
    labObservations.push({
      code: '718-7',
      testName: 'Haemoglobin (Hb)',
      value: String(hbMatch[1]),
      unit: hbMatch[2] || 'g/dL',
      referenceRange: '11.5 - 16.5 g/dL',
      flag,
    });
  }

  const wbcMatch = text.match(/\bWBC\b\s*[:\-=]?\s*(\d+(?:\.\d+)?)\s*(x10\^9\/L|\/uL)?/i);
  if (wbcMatch) {
    const val = Number.parseFloat(wbcMatch[1]);
    labObservations.push({
      code: '6690-2',
      testName: 'White Blood Cell Count (WBC)',
      value: String(wbcMatch[1]),
      unit: wbcMatch[2] || 'x10^9/L',
      referenceRange: '4.0 - 11.0 x10^9/L',
      flag: val > 20 || val < 2 ? 'critical' : val > 11 ? 'high' : val < 4 ? 'low' : 'normal',
    });
  }

  const pltMatch = text.match(/(?:Platelets|PLT)\s*[:\-=]?\s*(\d+(?:\.\d+)?)\s*(x10\^9\/L|x10\^3\/uL)?/i);
  if (pltMatch) {
    const val = Number.parseFloat(pltMatch[1]);
    const flag: DigitizedLabObservation['flag'] = val < 50 ? 'critical' : val < 150 ? 'low' : 'normal';
    if (flag === 'critical') panicAlerts.push(`Critical thrombocytopenia: Platelets ${val} x10^9/L.`);
    labObservations.push({
      code: '777-3',
      testName: 'Platelets',
      value: String(pltMatch[1]),
      unit: pltMatch[2] || 'x10^9/L',
      referenceRange: '150 - 450 x10^9/L',
      flag,
    });
  }

  const glucoseMatch = text.match(/(?:FBS|RBS|Glucose|Blood\s*Sugar)\s*[:\-=]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L|mg\/dL)?/i);
  if (glucoseMatch) {
    const val = Number.parseFloat(glucoseMatch[1]);
    const unit = glucoseMatch[2] || 'mmol/L';
    const isMmol = unit.toLowerCase().includes('mmol');
    const flag: DigitizedLabObservation['flag'] = isMmol
      ? val < 3 || val >= 18
        ? 'critical'
        : val > 7.8
          ? 'high'
          : 'normal'
      : val < 54 || val >= 325
        ? 'critical'
        : val > 140
          ? 'high'
          : 'normal';
    if (flag === 'critical') panicAlerts.push(`Critical glycaemic value: ${val} ${unit}.`);
    labObservations.push({
      code: '2345-7',
      testName: 'Blood Glucose',
      value: String(glucoseMatch[1]),
      unit,
      referenceRange: isMmol ? '3.9 - 7.8 mmol/L' : '70 - 140 mg/dL',
      flag,
    });
  }

  const kMatch = text.match(/(?:Potassium|K\+)\s*[:\-=]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L)?/i);
  if (kMatch) {
    const val = Number.parseFloat(kMatch[1]);
    const flag: DigitizedLabObservation['flag'] =
      val >= 6.0 || val <= 2.8 ? 'critical' : val > 5.2 ? 'high' : val < 3.5 ? 'low' : 'normal';
    if (flag === 'critical') panicAlerts.push(`Critical serum potassium: K+ ${val} mmol/L.`);
    labObservations.push({
      code: '2823-3',
      testName: 'Serum Potassium (K+)',
      value: String(kMatch[1]),
      unit: 'mmol/L',
      referenceRange: '3.5 - 5.2 mmol/L',
      flag,
    });
  }

  const crMatch = text.match(/(?:Creatinine|Cr)\s*[:\-=]?\s*(\d+(?:\.\d+)?)\s*(umol\/L|mg\/dL)?/i);
  if (crMatch) {
    const val = Number.parseFloat(crMatch[1]);
    const unit = crMatch[2] || 'umol/L';
    const isCritical = unit.toLowerCase().includes('umol') ? val >= 300 : val >= 3.4;
    if (isCritical) panicAlerts.push(`Critical renal impairment indicator: Creatinine ${val} ${unit}.`);
    labObservations.push({
      code: '2160-0',
      testName: 'Serum Creatinine',
      value: String(crMatch[1]),
      unit,
      referenceRange: unit.toLowerCase().includes('umol') ? '60 - 110 umol/L' : '0.7 - 1.2 mg/dL',
      flag: isCritical ? 'critical' : val > 110 ? 'high' : 'normal',
    });
  }

  const mpMatch = text.match(/(?:Malaria\s*(?:RDT|MP|Parasite)|RDT)\s*[:\-=]?\s*(Positive|\+{1,3}|Negative|Seen|Not\s*seen)/i);
  if (mpMatch) {
    const pos = /pos|\+|seen/i.test(mpMatch[1]) && !/not\s*seen/i.test(mpMatch[1]);
    labObservations.push({
      code: '51587-4',
      testName: 'Malaria Parasite / RDT',
      value: mpMatch[1],
      flag: pos ? 'high' : 'normal',
    });
  }

  let ultrasoundFindings: DigitizedUltrasoundFindings | null = null;
  if (recordKind === 'ultrasound_report' || /ultrasound|uss|scan|gestational|placenta|fhr|fetal/i.test(text)) {
    const gaMatch = text.match(/(?:GA|Gestational\s*Age|EGA)\s*[:\-=]?\s*(\d{1,2}(?:\.\d+)?)\s*(?:wks|weeks?)/i);
    const fhrMatch = text.match(/(?:FHR|Fetal\s*Heart(?:\s*Rate)?)\s*[:\-=]?\s*(\d{2,3})\s*(?:bpm)?/i);
    const placentaRaw = grab(/Placenta(?:l)?(?:\s*Position|\s*Site)?\s*[:\-]\s*([^\n.;]+)/i);
    const impression =
      grab(/(?:Impression|Conclusion|Scan\s*Summary)\s*[:\-]\s*([^\n]+)/i) ||
      'External ultrasound findings digitized for obstetric/radiology review.';

    const gaWeeks = gaMatch ? Number.parseFloat(gaMatch[1]) : null;
    const fhrBpm = fhrMatch ? Number.parseInt(fhrMatch[1], 10) : null;
    const organFindings: string[] = [];
    if (gaWeeks !== null) organFindings.push(`Gestational age estimated at ${gaWeeks} weeks`);
    if (fhrBpm !== null) organFindings.push(`Fetal cardiac activity at ${fhrBpm} bpm`);
    if (placentaRaw) organFindings.push(`Placenta: ${placentaRaw}`);

    let criticalAlert: string | undefined;
    if (/previa|praevia|abruption|ectopic|free\s*fluid|rupture/i.test(`${placentaRaw} ${impression} ${text}`)) {
      criticalAlert = 'High-risk obstetric ultrasound finding detected (placenta previa/abruption or ectopic alert) — immediate OB/GYN review required.';
      panicAlerts.push(criticalAlert);
    }
    if (fhrBpm !== null && (fhrBpm < 110 || fhrBpm > 165)) {
      const fhrMsg = `Abnormal fetal heart rate (${fhrBpm} bpm) outside 110–160 bpm safe band.`;
      criticalAlert = criticalAlert ? `${criticalAlert} ${fhrMsg}` : fhrMsg;
      panicAlerts.push(fhrMsg);
    }

    ultrasoundFindings = {
      modality: /obstetric|fhr|placenta|ga/i.test(text) ? 'Obstetric Ultrasound Scan' : 'Abdominopelvic Ultrasound Scan',
      gestationalAgeWeeks: gaWeeks,
      fetalHeartRateBpm: fhrBpm,
      placentaPosition: placentaRaw || undefined,
      organFindings,
      impression,
      criticalAlert,
    };
  }

  const diagnoses: Array<{ icd11Code?: string; display: string }> = [];
  const dxRaw = grab(/(?:Diagnosis|Diagnoses|Assessment|Dx)\s*[:\-]\s*([^\n]+)/i);
  if (dxRaw) {
    dxRaw.split(/[;,]/).forEach((d) => {
      const clean = d.trim();
      if (!clean) return;
      const icd = /malaria/i.test(clean)
        ? '1F40'
        : /hypertens/i.test(clean)
          ? 'BA00'
          : /diabet/i.test(clean)
            ? '5A11'
            : /anaemia|anemia/i.test(clean)
              ? '3A00'
              : /placenta/i.test(clean)
                ? 'JA88'
                : undefined;
      diagnoses.push({ icd11Code: icd, display: clean });
    });
  }

  const medications: Array<{ name: string; dosage?: string; frequency?: string }> = [];
  const rxBlock = text.match(/(?:Medications?|Current\s*Meds|Rx|Drugs?)\s*[:\-]\s*([\s\S]{3,400})/i);
  if (rxBlock) {
    const lines = rxBlock[1]
      .split(/\n|;/)
      .map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter((s) => s.length >= 3 && !/^(impression|diagnosis|allerg|signature)/i.test(s))
      .slice(0, 8);
    for (const l of lines) {
      const doseM = l.match(/(\d+\s*(?:mg|g|ml|iu|tab|tabs|caps?))/i);
      const freqM = l.match(/\b(OD|BD|TDS|QDS|STAT|NOCTE|PRN|daily|twice daily|three times daily)\b/i);
      medications.push({
        name: l,
        dosage: doseM?.[1],
        frequency: freqM?.[1],
      });
    }
  }

  if (labObservations.length === 0 && !ultrasoundFindings && diagnoses.length === 0) {
    warnings.push('Structured clinical fields were sparse in plain text; review manually before committing.');
  }

  return {
    recordKind,
    patientDemographics: {
      firstName,
      lastName,
      hospitalNumber,
      dob,
      sex,
      phone,
      lga,
      nhiaNumber,
      bloodGroup,
      genotype,
      allergies,
      chronicConditions: diagnoses.map((d) => d.display),
    },
    labObservations,
    ultrasoundFindings,
    diagnoses,
    medications,
    clinicalSummary:
      panicAlerts.length > 0
        ? `Digitized ${recordKind.replace(/_/g, ' ')} with ${panicAlerts.length} critical alert(s) requiring immediate clinician attention.`
        : `Digitized ${recordKind.replace(/_/g, ' ')} containing ${labObservations.length} lab observation(s), ${diagnoses.length} diagnosis(es), and ${medications.length} medication(s).`,
    panicAlerts,
    confidence: text.length > 40 ? 0.88 : 0.62,
    warnings,
  };
}

