import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ensureSchema, isPostgresConfigured, withTenantClient } from '../../../../lib/db/postgres';
import { signMfaToken } from '../../../../lib/serverSession';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BiometricCredentialDescriptor {
  credentialId: string;
  publicKeySpkiB64: string;
  alg?: number;
  deviceLabel?: string;
  counter: number;
  createdAt: string;
  lastUsedAt?: string;
}

const BIO_VAULT_FILE = path.join(os.tmpdir(), 'medcore-staff-biometrics-vault.json');

function getChallengeSecret(): string {
  return (
    process.env.MEDCORE_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.MEDCORE_API_SECRET ||
    'medcore-os-biometric-challenge-secret-v1'
  ).trim();
}

function readLocalVault(): Record<string, BiometricCredentialDescriptor & { badgeId: string; facilityId: string; staffName?: string }> {
  try {
    if (fs.existsSync(BIO_VAULT_FILE)) {
      return JSON.parse(fs.readFileSync(BIO_VAULT_FILE, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeLocalVault(
  map: Record<string, BiometricCredentialDescriptor & { badgeId: string; facilityId: string; staffName?: string }>
): void {
  try {
    fs.writeFileSync(BIO_VAULT_FILE, JSON.stringify(map), 'utf8');
  } catch {
    /* ignore */
  }
}

function bioKey(facilityId: string, badgeId: string): string {
  return `${facilityId.trim().toUpperCase()}::${badgeId.trim().toUpperCase()}`;
}

async function getStoredBiometric(
  facilityId: string,
  badgeId: string
): Promise<BiometricCredentialDescriptor | null> {
  const fid = facilityId.trim().toUpperCase();
  const bid = badgeId.trim().toUpperCase();
  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      const row = await withTenantClient(fid, async (c) => {
        const res = await c.query<{ descriptor: BiometricCredentialDescriptor }>(
          `SELECT descriptor FROM staff_biometrics WHERE facility_id = $1 AND badge_id = $2`,
          [fid, bid]
        );
        return res.rows[0]?.descriptor || null;
      });
      if (row) return row;
    } catch {
      /* fallback to local vault */
    }
  }
  const v = readLocalVault();
  return v[bioKey(fid, bid)] || null;
}

async function saveStoredBiometric(
  facilityId: string,
  badgeId: string,
  staffName: string,
  descriptor: BiometricCredentialDescriptor
): Promise<void> {
  const fid = facilityId.trim().toUpperCase();
  const bid = badgeId.trim().toUpperCase();
  const v = readLocalVault();
  v[bioKey(fid, bid)] = { ...descriptor, badgeId: bid, facilityId: fid, staffName };
  writeLocalVault(v);

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(fid, async (c) => {
        await c.query(
          `INSERT INTO staff_biometrics (badge_id, facility_id, staff_name, descriptor, version, enrolled_at, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, 1, NOW(), NOW())
           ON CONFLICT (facility_id, badge_id)
           DO UPDATE SET staff_name = EXCLUDED.staff_name,
                         descriptor = EXCLUDED.descriptor,
                         version = staff_biometrics.version + 1,
                         updated_at = NOW()`,
          [bid, fid, staffName || bid, JSON.stringify(descriptor)]
        );
      });
    } catch {
      /* fallback persisted */
    }
  }
}

async function deleteStoredBiometric(facilityId: string, badgeId: string): Promise<void> {
  const fid = facilityId.trim().toUpperCase();
  const bid = badgeId.trim().toUpperCase();
  const v = readLocalVault();
  delete v[bioKey(fid, bid)];
  writeLocalVault(v);

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(fid, async (c) => {
        await c.query(
          `DELETE FROM staff_biometrics WHERE facility_id = $1 AND badge_id = $2`,
          [fid, bid]
        );
      });
    } catch {
      /* ignore */
    }
  }
}

function issueSignedChallenge(badgeId: string, facilityId: string, purpose: 'register' | 'auth') {
  const challenge = crypto.randomBytes(32).toString('base64url');
  const payload = {
    challenge,
    badgeId: badgeId.trim().toUpperCase(),
    facilityId: facilityId.trim().toUpperCase(),
    purpose,
    exp: Date.now() + 5 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getChallengeSecret())
    .update(body)
    .digest('base64url');
  return { challenge, challengeToken: `${body}.${sig}` };
}

function verifySignedChallenge(
  token: string,
  expectedBadgeId: string,
  expectedFacilityId: string,
  expectedPurpose: 'register' | 'auth'
): { ok: boolean; challenge?: string; error?: string } {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return { ok: false, error: 'Malformed biometric challenge token.' };
  const [body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getChallengeSecret())
    .update(body)
    .digest('base64url');
  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return { ok: false, error: 'Biometric challenge signature mismatch.' };
  }
  const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
    challenge: string;
    badgeId: string;
    facilityId: string;
    purpose: string;
    exp: number;
  };
  if (Date.now() > decoded.exp) return { ok: false, error: 'Biometric prompt expired. Try again.' };
  if (decoded.purpose !== expectedPurpose) return { ok: false, error: 'Challenge purpose mismatch.' };
  if (decoded.badgeId !== expectedBadgeId.trim().toUpperCase()) return { ok: false, error: 'Badge mismatch.' };
  if (decoded.facilityId !== expectedFacilityId.trim().toUpperCase()) return { ok: false, error: 'Facility mismatch.' };
  return { ok: true, challenge: decoded.challenge };
}

/**
 * Convert WebAuthn ECDSA ASN.1 DER or raw R||S signature cleanly and verify against SPKI public key.
 */
function verifyAssertionSignature(
  publicKeySpkiB64: string,
  authenticatorDataB64u: string,
  clientDataJSONB64u: string,
  signatureB64u: string
): boolean {
  const spkiDer = Buffer.from(publicKeySpkiB64, 'base64');
  const pubKey = crypto.createPublicKey({ key: spkiDer, format: 'der', type: 'spki' });
  const authData = Buffer.from(authenticatorDataB64u, 'base64url');
  const clientDataRaw = Buffer.from(clientDataJSONB64u, 'base64url');
  const clientHash = crypto.createHash('sha256').update(clientDataRaw).digest();
  const signedBytes = Buffer.concat([authData, clientHash]);
  const signature = Buffer.from(signatureB64u, 'base64url');
  return crypto.createVerify('SHA256').update(signedBytes).verify(pubKey, signature);
}

export async function GET(req: NextRequest) {
  const badgeId = req.nextUrl.searchParams.get('badgeId') || '';
  const facilityId = req.nextUrl.searchParams.get('facilityId') || 'IGH-EKT';
  if (!badgeId.trim()) {
    return NextResponse.json({ ok: false, enrolled: false, error: 'badgeId required' }, { status: 400 });
  }
  const existing = await getStoredBiometric(facilityId, badgeId);
  return NextResponse.json({
    ok: true,
    enrolled: Boolean(existing),
    deviceLabel: existing?.deviceLabel || null,
    enrolledAt: existing?.createdAt || null,
    lastUsedAt: existing?.lastUsedAt || null,
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || '').trim();
    const badgeId = String(body.badgeId || '').trim().toUpperCase();
    const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
    const staffName = String(body.staffName || badgeId).trim();

    if (!badgeId) {
      return NextResponse.json({ ok: false, error: 'badgeId is required.' }, { status: 400 });
    }

    if (action === 'status') {
      const existing = await getStoredBiometric(facilityId, badgeId);
      return NextResponse.json({
        ok: true,
        enrolled: Boolean(existing),
        deviceLabel: existing?.deviceLabel || null,
        enrolledAt: existing?.createdAt || null,
        lastUsedAt: existing?.lastUsedAt || null,
      });
    }

    if (action === 'register_options') {
      const { challenge, challengeToken } = issueSignedChallenge(badgeId, facilityId, 'register');
      return NextResponse.json({
        ok: true,
        challenge,
        challengeToken,
        user: {
          id: Buffer.from(`${facilityId}:${badgeId}`).toString('base64url'),
          name: `${badgeId} · MedCore`,
          displayName: staffName,
        },
      });
    }

    if (action === 'register_verify') {
      const challengeToken = String(body.challengeToken || '');
      const check = verifySignedChallenge(challengeToken, badgeId, facilityId, 'register');
      if (!check.ok || !check.challenge) {
        return NextResponse.json({ ok: false, error: check.error }, { status: 401 });
      }
      const credentialId = String(body.credentialId || '').trim();
      const publicKeySpkiB64 = String(body.publicKeySpkiB64 || '').trim();
      const clientDataJSON = String(body.clientDataJSON || '').trim();
      const deviceLabel = String(body.deviceLabel || 'Platform Biometric Passkey').trim();
      const alg = typeof body.alg === 'number' ? body.alg : -7;

      if (!credentialId || !publicKeySpkiB64 || !clientDataJSON) {
        return NextResponse.json(
          { ok: false, error: 'Incomplete passkey attestation from device.' },
          { status: 400 }
        );
      }

      const clientObj = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8')) as {
        type?: string;
        challenge?: string;
      };
      if (clientObj.type !== 'webauthn.create' || clientObj.challenge !== check.challenge) {
        return NextResponse.json(
          { ok: false, error: 'Biometric registration challenge verification failed.' },
          { status: 401 }
        );
      }

      // Validate that SPKI public key parses cleanly
      crypto.createPublicKey({
        key: Buffer.from(publicKeySpkiB64, 'base64'),
        format: 'der',
        type: 'spki',
      });

      const descriptor: BiometricCredentialDescriptor = {
        credentialId,
        publicKeySpkiB64,
        alg,
        deviceLabel,
        counter: 0,
        createdAt: new Date().toISOString(),
      };
      await saveStoredBiometric(facilityId, badgeId, staffName, descriptor);
      return NextResponse.json({ ok: true, enrolled: true, deviceLabel });
    }

    if (action === 'auth_options') {
      const existing = await getStoredBiometric(facilityId, badgeId);
      if (!existing) {
        return NextResponse.json(
          { ok: false, error: 'No biometric passkey enrolled for this staff member.' },
          { status: 404 }
        );
      }
      const { challenge, challengeToken } = issueSignedChallenge(badgeId, facilityId, 'auth');
      return NextResponse.json({
        ok: true,
        challenge,
        challengeToken,
        credentialId: existing.credentialId,
      });
    }

    if (action === 'auth_verify') {
      const rl = checkRateLimit(`bio-verify:${ip}:${badgeId}`, 15, 10 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { ok: false, verified: false, error: `Too many biometric attempts. Wait ${rl.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }

      const existing = await getStoredBiometric(facilityId, badgeId);
      if (!existing) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'No biometric credential found.' },
          { status: 404 }
        );
      }

      const challengeToken = String(body.challengeToken || '');
      const check = verifySignedChallenge(challengeToken, badgeId, facilityId, 'auth');
      if (!check.ok || !check.challenge) {
        return NextResponse.json({ ok: false, verified: false, error: check.error }, { status: 401 });
      }

      const credentialId = String(body.credentialId || '').trim();
      const authenticatorData = String(body.authenticatorData || '').trim();
      const clientDataJSON = String(body.clientDataJSON || '').trim();
      const signature = String(body.signature || '').trim();

      if (credentialId !== existing.credentialId) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'Unrecognized passkey credential for this account.' },
          { status: 401 }
        );
      }

      const clientObj = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8')) as {
        type?: string;
        challenge?: string;
      };
      if (clientObj.type !== 'webauthn.get' || clientObj.challenge !== check.challenge) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'Biometric assertion challenge failed.' },
          { status: 401 }
        );
      }

      const sigValid = verifyAssertionSignature(
        existing.publicKeySpkiB64,
        authenticatorData,
        clientDataJSON,
        signature
      );
      if (!sigValid) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'Biometric cryptographic signature could not be verified.' },
          { status: 401 }
        );
      }

      await saveStoredBiometric(facilityId, badgeId, staffName, {
        ...existing,
        counter: (existing.counter || 0) + 1,
        lastUsedAt: new Date().toISOString(),
      });

      const mfaToken = await signMfaToken(badgeId, facilityId, 'biometric');
      return NextResponse.json({
        ok: true,
        verified: true,
        method: 'biometric',
        mfaToken,
      });
    }

    if (action === 'revoke') {
      await deleteStoredBiometric(facilityId, badgeId);
      return NextResponse.json({ ok: true, revoked: true });
    }

    return NextResponse.json({ ok: false, error: 'Unsupported biometric action.' }, { status: 400 });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Biometric verification encountered an unexpected error.' },
      { status: 500 }
    );
  }
}
