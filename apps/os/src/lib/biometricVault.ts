export interface FaceBiometricDescriptor {
  storageMode: 'object_storage' | 'inline_vault';
  objectKey?: string;
  referenceImageB64?: string;
  enrolledAt: string;
  qualityScore?: number;
  lastUsedAt?: string;
}

export interface UnifiedBiometricVault {
  version: 2;
  face?: FaceBiometricDescriptor;
}

/**
 * Normalize stored biometric vault records to facial biometric v2 descriptors.
 * Legacy device-passkey-only records return null.
 */
export function normalizeBiometricVault(raw: unknown): UnifiedBiometricVault | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if ('face' in obj && obj.face && typeof obj.face === 'object' && !Array.isArray(obj.face)) {
    return {
      version: 2,
      face: obj.face as FaceBiometricDescriptor,
    };
  }

  return null;
}
