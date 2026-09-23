import { BreakGlassEvent, UserRole } from '@medcore/types';
import { auditLedger } from './auditLedger';

export class AccessControlService {
  private breakGlassEvents: BreakGlassEvent[] = [];

  /**
   * Evaluates if an actor with a given role and facility is permitted to perform an action on a resource
   */
  public authorize(
    actor: { id: string; role: UserRole; facilityId: string; scopes: string[] },
    action: 'READ' | 'WRITE' | 'DECRYPT' | 'TRANSACT' | 'SURVEILLANCE',
    resource: { type: string; id: string; facilityId?: string }
  ): { allowed: boolean; reason?: string } {
    // MOH Commissioner can view system surveillance and audit metrics, but not raw individual clinical charts without break-glass or court order
    if (actor.role === 'MOH_COMMISSIONER' || actor.role === 'REGULATORY_AUDITOR') {
      if (action === 'SURVEILLANCE' || resource.type === 'AUDIT' || resource.type === 'FACILITY') {
        return { allowed: true };
      }
      if (action === 'READ' && resource.type === 'PATIENT') {
        return {
          allowed: false,
          reason: 'MOH Commissioner role access to individual patient charts is restricted to de-identified telemetry. Use legal audit / break-glass for patient-specific inquiries.',
        };
      }
    }

    // Cashiers are restricted to billing and financial transactions
    if (actor.role === 'CASHIER') {
      if (resource.type === 'BILL' || resource.type === 'WALLET' || resource.type === 'TILL') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Cashier role cannot access clinical progress notes or diagnostic orders.' };
    }

    // Clinicians (Doctors & Nurses) can access patients within their registered facility
    if (actor.role === 'DOCTOR' || actor.role === 'NURSE') {
      if (!resource.facilityId || resource.facilityId === actor.facilityId) {
        return { allowed: true };
      }
      // Cross-facility access requires break-glass or verified referral
      const activeBreakGlass = this.breakGlassEvents.find(
        (bg) => bg.patientId === resource.id && bg.doctorId === actor.id && bg.status === 'ACTIVE'
      );
      if (activeBreakGlass) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Cross-facility clinical chart access requires an active Emergency Break-Glass authorization or formal referral.',
      };
    }

    return { allowed: true };
  }

  /**
   * Executes emergency Break-Glass protocol for life-threatening clinical emergencies
   */
  public triggerBreakGlass(params: {
    doctorId: string;
    doctorName: string;
    patientId: string;
    patientMRN: string;
    facilityId: string;
    justification: string;
    clinicalIndication: 'UNCONSCIOUS_TRAUMA' | 'CARDIAC_ARREST' | 'MASS_CASUALTY' | 'ACUTE_SURGICAL';
  }): BreakGlassEvent {
    const id = `BG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();

    // 1. Immediately log high-priority tamper-evident audit event
    const auditBlock = auditLedger.logEvent({
      actorId: params.doctorId,
      actorName: params.doctorName,
      actorRole: 'DOCTOR',
      facilityId: params.facilityId,
      action: 'BREAK_GLASS_ACCESS',
      resourceType: 'PATIENT',
      resourceId: params.patientId,
      reason: `EMERGENCY BREAK-GLASS: ${params.clinicalIndication} - ${params.justification}`,
      metadata: {
        breakGlassId: id,
        patientMRN: params.patientMRN,
        indication: params.clinicalIndication,
        severity: 'CRITICAL',
      },
    });

    const event: BreakGlassEvent = {
      id,
      doctorId: params.doctorId,
      doctorName: params.doctorName,
      patientId: params.patientId,
      patientMRN: params.patientMRN,
      facilityId: params.facilityId,
      justification: params.justification,
      clinicalIndication: params.clinicalIndication,
      timestamp,
      supervisorNotified: true,
      commissionerAlertSent: true,
      status: 'ACTIVE',
      auditBlockNumber: auditBlock.blockNumber,
    };

    this.breakGlassEvents.push(event);
    return event;
  }

  public getActiveBreakGlassEvents(): BreakGlassEvent[] {
    return this.breakGlassEvents.filter((e) => e.status === 'ACTIVE');
  }

  public getAllBreakGlassEvents(): BreakGlassEvent[] {
    return this.breakGlassEvents;
  }

  public acknowledgeBreakGlass(id: string, reviewerName: string): boolean {
    const event = this.breakGlassEvents.find((e) => e.id === id);
    if (!event) return false;
    event.status = 'SUPERVISOR_ACKNOWLEDGED';
    auditLedger.logEvent({
      actorId: reviewerName,
      actorName: reviewerName,
      actorRole: 'HOSPITAL_ADMIN',
      facilityId: event.facilityId,
      action: 'READ_PHI',
      resourceType: 'PATIENT',
      resourceId: event.patientId,
      reason: `Supervisor acknowledged emergency break-glass event ${id}`,
    });
    return true;
  }
}

export const accessControl = new AccessControlService();
