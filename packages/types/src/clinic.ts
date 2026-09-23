export interface StaffMember {
  id: string;
  employeeNumber: string;
  fullName: string;
  role: 'doctor' | 'nurse' | 'surgeon' | 'radiologist' | 'pharmacist' | 'admin';
  department: string;
  specialty?: string;
  onDuty: boolean;
  activeShift?: {
    shiftId: string;
    start: string;
    end: string;
    ward: string;
  };
}

export interface HandoverNote {
  id: string;
  patientId: string;
  authorStaffId: string;
  recipientStaffId?: string;
  timestamp: string;
  sbar: {
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
  };
  codeStatus: 'FULL_CODE' | 'DNR' | 'DNI';
  priority: 'routine' | 'urgent' | 'critical';
}

export interface ClinicalTask {
  id: string;
  patientId: string;
  assignedToStaffId: string;
  title: string;
  category: 'medication' | 'lab_draw' | 'vitals' | 'consult' | 'discharge';
  priority: 'low' | 'medium' | 'high' | 'stat';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueAt: string;
}
