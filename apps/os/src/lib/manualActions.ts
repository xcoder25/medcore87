/**
 * Every manual button should call this so the action is live:
 * toast + live-action bus + optional audit trail.
 */
import { emitLiveAction } from './liveActions';
import { appendAudit } from './auditLogStore';

export type ManualActionInput = {
  message: string;
  module?: string;
  facilityId?: string;
  actor?: string;
  actorBadge?: string;
  entity?: string;
  entityId?: string;
  detail?: string;
};

export function runManualAction(input: ManualActionInput) {
  emitLiveAction(input.message, { module: input.module });
  if (input.facilityId) {
    try {
      appendAudit({
        facilityId: input.facilityId,
        actor: input.actor || 'Staff',
        actorBadge: input.actorBadge,
        action: 'manual_action',
        entity: input.entity || input.module || 'ui',
        entityId: input.entityId,
        detail: input.detail || input.message,
      });
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('medcore-toast', {
        detail: { message: input.message, at: new Date().toISOString() },
      })
    );
  }
}

/** Replace browser alert() with live action + soft toast */
export function liveAlert(message: string, module?: string, facilityId?: string) {
  runManualAction({ message, module, facilityId, actor: 'Staff' });
}
