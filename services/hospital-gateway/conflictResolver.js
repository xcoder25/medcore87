/**
 * MedCore Deterministic Clinical Conflict Avoidance Engine
 * Technical Brief Section 3.B: Field-Level Delta Parsing & Clinical Verification Dispatch
 *
 * EMR software CANNOT apply standard 'Last Write Wins' (LWW) resolution algorithms
 * due to strict patient safety criteria (e.g., dosage modifications, allergy updates).
 */

const crypto = require('crypto');

// In-memory verification queue for physician/nurse resolution
const clinicalVerificationQueue = new Map();

/**
 * Sensitive fields that strictly require clinical verification if concurrent edits occur.
 */
const CLINICAL_SENSITIVE_FIELDS = [
  'dosage',
  'dose',
  'medication',
  'prescriptions',
  'allergies',
  'diagnosis',
  'icd10',
  'notes',
  'chartNotes',
  'vitals',
  'treatmentPlan'
];

/**
 * Deep equality check for primitives and objects
 */
function isEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Performs field-level delta parsing between local record, cloud incoming record, and base snapshot.
 * Returns { mergedRecord, isConflict, conflictReport }
 */
function evaluateClinicalDelta({ localRecord, incomingRecord, baseRecord = {} }) {
  if (!localRecord) {
    return {
      mergedRecord: { ...incomingRecord, is_conflict: false },
      isConflict: false,
      conflictReport: null
    };
  }

  const merged = { ...localRecord };
  const conflicts = [];
  const allKeys = Array.from(new Set([...Object.keys(localRecord), ...Object.keys(incomingRecord)]));

  for (const key of allKeys) {
    // Skip metadata internal flags
    if (key === 'is_conflict' || key === 'conflictDetails' || key === 'lastModified') continue;

    const localVal = localRecord[key];
    const incomingVal = incomingRecord[key];
    const baseVal = baseRecord[key];

    // If identical values, no conflict
    if (isEqual(localVal, incomingVal)) {
      continue;
    }

    const localModified = !isEqual(localVal, baseVal);
    const incomingModified = !isEqual(incomingVal, baseVal);

    if (incomingModified && !localModified) {
      // Clean safe incoming update (local hasn't touched it)
      merged[key] = incomingVal;
    } else if (localModified && !incomingModified) {
      // Local modification retained
      merged[key] = localVal;
    } else if (localModified && incomingModified) {
      // Both modified the identical field!
      const isSensitive = CLINICAL_SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f));

      const conflictItem = {
        conflictId: `CONF-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        patientId: localRecord.id,
        patientName: localRecord.name || 'Unknown Patient',
        field: key,
        localValue: localVal,
        incomingValue: incomingVal,
        baseValue: baseVal,
        isSensitive,
        timestamp: new Date().toISOString()
      };

      conflicts.push(conflictItem);
    }
  }

  if (conflicts.length > 0) {
    // HALT auto-merge for conflicted properties
    const conflictId = `VERIF-${Date.now().toString(36)}-${localRecord.id}`;
    const conflictReport = {
      conflictId,
      patientId: localRecord.id,
      patientName: localRecord.name || 'Unknown Patient',
      mrn: localRecord.mrn || 'N/A',
      conflicts,
      detectedAt: new Date().toISOString(),
      status: 'AWAITING_CLINICIAN_REVIEW'
    };

    clinicalVerificationQueue.set(conflictId, conflictReport);

    merged.is_conflict = true;
    merged.conflictDetails = conflictReport;

    return {
      mergedRecord: merged,
      isConflict: true,
      conflictReport
    };
  }

  merged.is_conflict = false;
  return {
    mergedRecord: merged,
    isConflict: false,
    conflictReport: null
  };
}

function getVerificationQueue() {
  return Array.from(clinicalVerificationQueue.values());
}

function resolveConflict({ conflictId, clinicianId, resolutionChoice, customValue }) {
  const item = clinicalVerificationQueue.get(conflictId);
  if (!item) return null;

  item.status = 'RESOLVED';
  item.resolvedBy = clinicianId;
  item.resolvedAt = new Date().toISOString();
  item.resolutionChoice = resolutionChoice; // 'USE_LOCAL' | 'USE_INCOMING' | 'CUSTOM'
  item.finalValue = customValue;

  clinicalVerificationQueue.delete(conflictId);
  return item;
}

module.exports = {
  evaluateClinicalDelta,
  getVerificationQueue,
  resolveConflict,
  CLINICAL_SENSITIVE_FIELDS
};
