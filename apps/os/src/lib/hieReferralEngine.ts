/**
 * Cross-Hospital Live Referral & Bed-Lock HIE Network Engine (`apps/os`).
 * Zero-randomness HL7 FHIR R4 referral bundle builder, target bed reservation lock,
 * and closed-loop receiving hospital outcome state machine.
 */

export type HieReferralStatus =
  | 'pending_acceptance'
  | 'bed_locked'
  | 'in_transit'
  | 'arrived_admitted'
  | 'completed_discharged'
  | 'declined';

export type HieBedCategory =
  | 'ICU'
  | 'Maternity / Labour'
  | 'Emergency Resus'
  | 'General Ward'
  | 'NICU';

export interface HieBedReservation {
  bedLockId: string;
  targetFacilityId: string;
  targetFacilityName: string;
  ward: string;
  bedCategory: HieBedCategory;
  reservedUntil: string;
  confirmedBy?: string;
}

export interface HieReferralPacket {
  id: string;
  createdAt: string;
  updatedAt: string;
  referringFacilityId: string;
  referringFacilityName: string;
  targetFacilityId: string;
  targetFacilityName: string;
  specialty: string;
  priority: 'routine' | 'urgent' | 'emergency';
  status: HieReferralStatus;
  patientConsentToken: string;
  patientShid?: string;
  patientName: string;
  hospitalNumber: string;
  clinicalSummary: string;
  vitalsSnapshot?: {
    bp?: string;
    pulse?: number;
    spo2?: number;
    tempC?: number;
    news2?: number;
    shockIndex?: number;
  };
  allergies?: string[];
  medsGiven?: string[];
  fhirSummaryBundle: Record<string, unknown>;
  bedReservation?: HieBedReservation;
  receivingFeedback?: {
    outcomeSummary: string;
    admittedWard?: string;
    updatedBy: string;
    updatedAt: string;
  };
}

export interface CreateHieReferralInput {
  referringFacilityId: string;
  referringFacilityName: string;
  targetFacilityId: string;
  targetFacilityName: string;
  specialty: string;
  priority: 'routine' | 'urgent' | 'emergency';
  patientName: string;
  hospitalNumber: string;
  patientShid?: string;
  patientConsentToken?: string;
  clinicalSummary: string;
  vitalsSnapshot?: HieReferralPacket['vitalsSnapshot'];
  allergies?: string[];
  medsGiven?: string[];
  requestBedLock?: boolean;
  bedCategory?: HieBedCategory;
  ward?: string;
  nowIso?: string;
}

function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
}

export function buildHieReferralPacket(input: CreateHieReferralInput): HieReferralPacket {
  const nowIso = input.nowIso || new Date().toISOString();
  const nowMs = Date.parse(nowIso) || Date.now();
  const seed = `${input.referringFacilityId}|${input.targetFacilityId}|${input.hospitalNumber}|${input.specialty}|${nowIso}`;
  const hash = stableHash(seed);
  const id = `HIE-REF-${hash}`;
  const consentToken =
    input.patientConsentToken?.trim() ||
    `CONSENT-${stableHash(`${input.hospitalNumber}|${input.patientShid || ''}|${nowIso.slice(0, 10)}`)}`;

  const patientRef = `Patient/${input.hospitalNumber.replace(/[^a-zA-Z0-9_-]/g, '') || 'HIE-PT'}`;
  const nameParts = String(input.patientName || 'Patient').trim().split(/\s+/);
  const given = nameParts.slice(0, -1).length ? nameParts.slice(0, -1) : [nameParts[0] || 'Patient'];
  const family = nameParts.length > 1 ? nameParts[nameParts.length - 1] : 'Unknown';

  const entries: Array<{ resource: Record<string, unknown> }> = [
    {
      resource: {
        resourceType: 'Patient',
        id: patientRef.replace('Patient/', ''),
        identifier: [
          { system: 'urn:medcore:hospital-number', value: input.hospitalNumber },
          ...(input.patientShid ? [{ system: 'urn:aks:shid', value: input.patientShid }] : []),
        ],
        name: [{ use: 'official', family, given }],
      },
    },
    {
      resource: {
        resourceType: 'ServiceRequest',
        id: `sr-${id.toLowerCase()}`,
        status: 'active',
        intent: 'order',
        priority: input.priority === 'emergency' ? 'stat' : input.priority === 'urgent' ? 'urgent' : 'routine',
        category: [{ text: 'Inter-facility HIE Referral' }],
        code: { text: `${input.specialty} Specialist Referral` },
        subject: { reference: patientRef, display: input.patientName },
        authoredOn: nowIso,
        requester: { display: `${input.referringFacilityName} (${input.referringFacilityId})` },
        performer: [{ display: `${input.targetFacilityName} (${input.targetFacilityId})` }],
        note: [{ text: input.clinicalSummary }],
      },
    },
    {
      resource: {
        resourceType: 'Consent',
        id: `consent-${hash.toLowerCase()}`,
        status: 'active',
        scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }] },
        patient: { reference: patientRef },
        dateTime: nowIso,
        provision: { type: 'permit', data: [{ meaning: 'related', reference: { display: consentToken } }] },
      },
    },
  ];

  if (input.vitalsSnapshot) {
    const v = input.vitalsSnapshot;
    entries.push({
      resource: {
        resourceType: 'Observation',
        id: `obs-vitals-${hash.toLowerCase()}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        code: { text: 'Pre-transfer Clinical Vitals & Acuity Snapshot' },
        subject: { reference: patientRef },
        effectiveDateTime: nowIso,
        valueString: [
          v.bp ? `BP ${v.bp}` : '',
          typeof v.pulse === 'number' ? `PR ${v.pulse} bpm` : '',
          typeof v.spo2 === 'number' ? `SpO2 ${v.spo2}%` : '',
          typeof v.tempC === 'number' ? `Temp ${v.tempC}C` : '',
          typeof v.news2 === 'number' ? `NEWS2 ${v.news2}` : '',
          typeof v.shockIndex === 'number' ? `SI ${v.shockIndex}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      },
    });
  }

  for (const al of input.allergies || []) {
    if (!al.trim()) continue;
    entries.push({
      resource: {
        resourceType: 'AllergyIntolerance',
        clinicalStatus: { coding: [{ code: 'active' }] },
        code: { text: al.trim() },
        patient: { reference: patientRef },
      },
    });
  }

  const bedReservation: HieBedReservation | undefined = input.requestBedLock
    ? {
        bedLockId: `BED-LOCK-${hash}`,
        targetFacilityId: input.targetFacilityId,
        targetFacilityName: input.targetFacilityName,
        bedCategory: input.bedCategory || (/obstet|matern|anc/i.test(input.specialty) ? 'Maternity / Labour' : input.priority === 'emergency' ? 'Emergency Resus' : 'General Ward'),
        ward: input.ward || (/icu/i.test(input.bedCategory || '') ? 'Adult ICU Bay' : /matern/i.test(input.specialty) ? 'Labour & High-Risk Obstetric Ward' : 'Acute Receiving Bay'),
        reservedUntil: new Date(nowMs + 4 * 60 * 60 * 1000).toISOString(),
      }
    : undefined;

  return {
    id,
    createdAt: nowIso,
    updatedAt: nowIso,
    referringFacilityId: input.referringFacilityId,
    referringFacilityName: input.referringFacilityName,
    targetFacilityId: input.targetFacilityId,
    targetFacilityName: input.targetFacilityName,
    specialty: input.specialty,
    priority: input.priority,
    status: bedReservation ? 'bed_locked' : 'pending_acceptance',
    patientConsentToken: consentToken,
    patientShid: input.patientShid,
    patientName: input.patientName,
    hospitalNumber: input.hospitalNumber,
    clinicalSummary: input.clinicalSummary,
    vitalsSnapshot: input.vitalsSnapshot,
    allergies: input.allergies || [],
    medsGiven: input.medsGiven || [],
    fhirSummaryBundle: {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: nowIso,
      meta: {
        profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
        tag: [{ system: 'https://medcore.aks.gov.ng/fhir/hie-referral', code: id }],
      },
      entry: entries,
    },
    bedReservation,
  };
}

export type HieReferralAction =
  | 'accept_and_lock_bed'
  | 'mark_in_transit'
  | 'confirm_arrival_admission'
  | 'close_loop_outcome'
  | 'decline';

export function transitionHieReferral(
  packet: HieReferralPacket,
  action: HieReferralAction,
  meta: {
    actorName?: string;
    bedCategory?: HieBedCategory;
    ward?: string;
    outcomeSummary?: string;
    nowIso?: string;
  } = {}
): HieReferralPacket {
  const nowIso = meta.nowIso || new Date().toISOString();
  const nowMs = Date.parse(nowIso) || Date.now();
  const actor = meta.actorName || 'Receiving Triage Lead';

  if (action === 'accept_and_lock_bed') {
    const hash = stableHash(`${packet.id}|LOCK|${nowIso}`);
    return {
      ...packet,
      status: 'bed_locked',
      updatedAt: nowIso,
      bedReservation: {
        bedLockId: packet.bedReservation?.bedLockId || `BED-LOCK-${hash}`,
        targetFacilityId: packet.targetFacilityId,
        targetFacilityName: packet.targetFacilityName,
        bedCategory: meta.bedCategory || packet.bedReservation?.bedCategory || 'Emergency Resus',
        ward: meta.ward || packet.bedReservation?.ward || 'Acute Receiving / Emergency Bay',
        reservedUntil: new Date(nowMs + 4 * 60 * 60 * 1000).toISOString(),
        confirmedBy: actor,
      },
    };
  }

  if (action === 'mark_in_transit') {
    return {
      ...packet,
      status: 'in_transit',
      updatedAt: nowIso,
    };
  }

  if (action === 'confirm_arrival_admission') {
    return {
      ...packet,
      status: 'arrived_admitted',
      updatedAt: nowIso,
      receivingFeedback: {
        outcomeSummary: meta.outcomeSummary || `Patient received & admitted at ${packet.targetFacilityName}.`,
        admittedWard: meta.ward || packet.bedReservation?.ward || 'Inpatient Admission Ward',
        updatedBy: actor,
        updatedAt: nowIso,
      },
    };
  }

  if (action === 'close_loop_outcome') {
    return {
      ...packet,
      status: 'completed_discharged',
      updatedAt: nowIso,
      receivingFeedback: {
        outcomeSummary:
          meta.outcomeSummary ||
          `Specialist intervention completed at ${packet.targetFacilityName}; patient stabilized and referred back to ${packet.referringFacilityName} for follow-up.`,
        admittedWard: meta.ward || packet.receivingFeedback?.admittedWard || packet.bedReservation?.ward,
        updatedBy: actor,
        updatedAt: nowIso,
      },
    };
  }

  return {
    ...packet,
    status: 'declined',
    updatedAt: nowIso,
    receivingFeedback: {
      outcomeSummary: meta.outcomeSummary || 'Referral redirected by receiving desk due to bed capacity.',
      updatedBy: actor,
      updatedAt: nowIso,
    },
  };
}
