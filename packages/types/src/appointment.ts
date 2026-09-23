export type AppointmentStatus = 'requested' | 'confirmed' | 'checked_in' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
export type AppointmentType = 'in_person' | 'telehealth' | 'home_visit' | 'procedure';

export interface Appointment {
  id: string;
  patientId: string;
  clinicianId: string;
  department: string;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledAt: string;
  durationMinutes: number;
  reason: string;
  preVisitInstructions?: string[];
  reminderSent: boolean;
  virtualRoomUrl?: string;
}
