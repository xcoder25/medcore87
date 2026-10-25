/**
 * FHIR R4-oriented export stubs + DHIS2 event mapping for MoH pipelines.
 * Not a full server — portable JSON for HIE / DHIS2 adapters.
 */
import type { FacilityPatient } from './patientRegistryStore';
import type { ClinicalOrder } from './clinicalEventBus';
import type { ReceptionVisit } from './receptionOpsStore';

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
