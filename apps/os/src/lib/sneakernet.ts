/**
 * MedCore Sneakernet USB Sync Utility (Total Infrastructure Blackout Strategy)
 * Technical Brief Section 2.C: Native File System Access API + AES-256-GCM Encrypted EMR Packages
 */

import { patientCacheStore, offlineMutationStore, PatientRecord } from '../hooks/usePatientData';

export interface SneakernetPackage {
  header: {
    system: 'MedCore EMR';
    version: '1.0';
    facilityId: string;
    stationId: string;
    exportedAt: string;
    exportDoctorOrStaffId?: string;
    checksum: string;
  };
  payload: {
    mutations: any[];
    patients: PatientRecord[];
  };
}

export interface EncryptedContainer {
  format: 'MEDCORE_SNEAKERNET_V1';
  saltHex: string;
  ivHex: string;
  ciphertextHex: string;
  facilityId: string;
  timestamp: string;
}

// ─── Web Crypto AES-GCM Helpers ──────────────────────────────────────────────

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

async function calculateSHA256(data: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return bufToHex(hashBuf);
}

// ─── Export Pipeline ─────────────────────────────────────────────────────────

export async function exportSneakernetPackageToUSB(options: {
  passphrase?: string;
  facilityId?: string;
  stationId?: string;
  staffId?: string;
}): Promise<{ fileName: string; totalMutations: number; totalPatients: number }> {
  const facilityId = options.facilityId || 'AKS-SEC-001';
  const stationId = options.stationId || (typeof window !== 'undefined' ? window.location.hostname : 'STATION-01');
  const staffId = options.staffId || 'MED-STAFF';
  const passphrase = options.passphrase || 'medcore-offline-secret-aks';

  // 1. Collect offline mutations
  const mutations: any[] = [];
  await offlineMutationStore.iterate((value) => {
    mutations.push(value);
  });

  // 2. Collect cached patient records
  const patients: PatientRecord[] = [];
  await patientCacheStore.iterate((value: PatientRecord) => {
    patients.push(value);
  });

  const payloadString = JSON.stringify({ mutations, patients });
  const checksum = await calculateSHA256(payloadString);

  const pkg: SneakernetPackage = {
    header: {
      system: 'MedCore EMR',
      version: '1.0',
      facilityId,
      stationId,
      exportedAt: new Date().toISOString(),
      exportDoctorOrStaffId: staffId,
      checksum,
    },
    payload: {
      mutations,
      patients,
    },
  };

  // 3. Encrypt package using AES-256-GCM
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const plaintext = new TextEncoder().encode(JSON.stringify(pkg));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  const container: EncryptedContainer = {
    format: 'MEDCORE_SNEAKERNET_V1',
    saltHex: bufToHex(salt.buffer),
    ivHex: bufToHex(iv.buffer),
    ciphertextHex: bufToHex(ciphertextBuffer),
    facilityId,
    timestamp: new Date().toISOString(),
  };

  const fileBlob = new Blob([JSON.stringify(container, null, 2)], {
    type: 'application/json',
  });

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suggestedFileName = `medcore-blackout-sync-${facilityId}-${timestampStr}.emrpkg`;

  // 4. Save to USB drive via File System Access API if available
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: suggestedFileName,
        types: [
          {
            description: 'MedCore Encrypted EMR Package (*.emrpkg, *.json)',
            accept: {
              'application/json': ['.emrpkg', '.json'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(fileBlob);
      await writable.close();
      return { fileName: suggestedFileName, totalMutations: mutations.length, totalPatients: patients.length };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Export cancelled by clinician.');
      }
      console.warn('[Sneakernet] showSaveFilePicker fallback:', err);
    }
  }

  // Fallback to standard browser download anchor
  const url = URL.createObjectURL(fileBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { fileName: suggestedFileName, totalMutations: mutations.length, totalPatients: patients.length };
}

// ─── Import Pipeline ─────────────────────────────────────────────────────────

export async function importSneakernetPackageFromUSB(passphrase = 'medcore-offline-secret-aks'): Promise<{
  packageHeader: SneakernetPackage['header'];
  importedMutations: number;
  importedPatients: number;
}> {
  let fileText = '';

  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'MedCore Encrypted EMR Package (*.emrpkg, *.json)',
            accept: {
              'application/json': ['.emrpkg', '.json'],
            },
          },
        ],
        multiple: false,
      });
      const file = await handle.getFile();
      fileText = await file.text();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Import cancelled by clinician.');
      }
      throw err;
    }
  } else {
    // Hidden file input fallback
    fileText = await new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.emrpkg,.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return reject(new Error('No file selected'));
        resolve(await file.text());
      };
      input.click();
    });
  }

  const container: EncryptedContainer = JSON.parse(fileText);
  if (container.format !== 'MEDCORE_SNEAKERNET_V1') {
    throw new Error('Invalid format: File is not a recognized MedCore encrypted package.');
  }

  // Decrypt
  const salt = hexToBuf(container.saltHex);
  const iv = hexToBuf(container.ivHex);
  const ciphertext = hexToBuf(container.ciphertextHex);

  const key = await deriveKey(passphrase, salt);
  let decryptedBuf: ArrayBuffer;
  try {
    decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
  } catch {
    throw new Error('Decryption failed: Incorrect passphrase or corrupted EMR container.');
  }

  const plaintext = new TextDecoder().decode(decryptedBuf);
  const pkg: SneakernetPackage = JSON.parse(plaintext);

  // Check integrity
  const calculatedChecksum = await calculateSHA256(JSON.stringify(pkg.payload));
  if (calculatedChecksum !== pkg.header.checksum) {
    throw new Error('Cryptographic checksum mismatch! EMR payload may have been tampered with or corrupted.');
  }

  // Restore mutations to local queue
  let mutationCount = 0;
  for (const mut of pkg.payload.mutations) {
    if (mut && mut.id) {
      await offlineMutationStore.setItem(mut.id, mut);
      mutationCount++;
    }
  }

  // Restore patients to local cache
  let patientCount = 0;
  for (const patient of pkg.payload.patients) {
    if (patient && patient.id) {
      await patientCacheStore.setItem(patient.id, patient);
      patientCount++;
    }
  }

  return {
    packageHeader: pkg.header,
    importedMutations: mutationCount,
    importedPatients: patientCount,
  };
}
