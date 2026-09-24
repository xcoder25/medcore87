export type CpoeOrderCategory = 'LABORATORY' | 'MEDICATION' | 'RADIOLOGY' | 'NURSING' | 'CONSULT' | 'DIET' | 'PROCEDURE';

export type CpoePriority = 'ROUTINE' | 'URGENT' | 'STAT';

export type CpoeOrderStatus =
  | 'DRAFT'
  | 'ORDERED'
  | 'PHARMACY_VERIFIED'
  | 'SAMPLE_COLLECTED'
  | 'DISPENSED'
  | 'ADMINISTERED'
  | 'RESULT_READY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CpoeOrderItem {
  id: string;
  category: CpoeOrderCategory;
  name: string;
  code?: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  urgency: CpoePriority;
  instructions?: string;
  status: CpoeOrderStatus;
  orderedAt: string;
  orderedByDoctorId: string;
  orderedByDoctorName: string;
  targetDepartment: string;
  dispensedAt?: string;
  administeredAt?: string;
  resultSummary?: string;
}

export type IbomClinicalPathwayId =
  | 'SEVERE_MALARIA_PROTOCOL'
  | 'PRE_ECLAMPSIA_ECLAMPSIA_PROTOCOL'
  | 'SICKLE_CELL_VOC_PROTOCOL'
  | 'PEDIATRIC_SEPSIS_PROTOCOL'
  | 'EMERGENCY_CESAREAN_BUNDLE';

export interface IbomClinicalPathway {
  id: IbomClinicalPathwayId;
  title: string;
  description: string;
  targetCohort: string;
  clinicalRationale: string;
  items: Array<{
    category: CpoeOrderCategory;
    name: string;
    dosage?: string;
    route?: string;
    frequency?: string;
    instructions: string;
    urgency: CpoePriority;
  }>;
}
