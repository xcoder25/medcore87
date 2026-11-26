import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildMerkleTree,
  generateMerkleProof,
  verifyMerkleProof,
  type MerkleAnchorReceipt,
} from '../../../../lib/merkleAnchorEngine';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../../../../lib/serverSession';
import {
  ensureSchema,
  isPostgresConfigured,
  withTenantClient,
} from '../../../../lib/db/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ANCHOR_VAULT = path.join(os.tmpdir(), 'medcore-merkle-anchors-v1.json');
const AUDIT_VAULT = path.join(os.tmpdir(), 'medcore-audit-ledger-v1.json');

interface StoredAnchorBundle {
  receipt: MerkleAnchorReceipt;
  leafHashes: string[];
}

let memAnchors: StoredAnchorBundle[] | null = null;

function readAnchors(): StoredAnchorBundle[] {
  if (memAnchors) return [...memAnchors];
  try {
    if (fs.existsSync(ANCHOR_VAULT)) {
      const parsed = JSON.parse(fs.readFileSync(ANCHOR_VAULT, 'utf8'));
      if (Array.isArray(parsed)) {
        memAnchors = parsed as StoredAnchorBundle[];
        return [...memAnchors];
      }
    }
  } catch {
    // ignore
  }
  memAnchors = [];
  return [];
}

function writeAnchors(items: StoredAnchorBundle[]): void {
  memAnchors = [...items];
  try {
    fs.writeFileSync(ANCHOR_VAULT, JSON.stringify(items), 'utf8');
  } catch {
    // ignore
  }
}

async function readFacilityAuditHashes(facilityId: string): Promise<string[]> {
  const hashes: string[] = [];

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(facilityId, async (c) => {
        const res = await c.query<{ row_hash: string }>(
          `SELECT row_hash FROM clinical_audit_ledger WHERE facility_id = $1 ORDER BY created_at ASC LIMIT 500`,
          [facilityId]
        );
        for (const r of res.rows) {
          if (r.row_hash) hashes.push(r.row_hash);
        }
      });
    } catch {
      // fall through to local vault
    }
  }

  if (hashes.length === 0) {
    try {
      if (fs.existsSync(AUDIT_VAULT)) {
        const parsed = JSON.parse(fs.readFileSync(AUDIT_VAULT, 'utf8')) as Record<
          string,
          Array<{ rowHash?: string }>
        >;
        const rows = parsed[facilityId] || [];
        for (const row of rows) {
          if (row.rowHash) hashes.push(row.rowHash);
        }
      }
    } catch {
      // ignore
    }
  }

  return hashes;
}

export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || 'IGH-EKT').trim().toUpperCase();
  const targetHash = (req.nextUrl.searchParams.get('hash') || '').trim().toLowerCase();

  let bundles = readAnchors().filter((b) => !facilityId || b.receipt.facilityId === facilityId);

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(facilityId, async (c) => {
        const res = await c.query<{
          anchor_id: string;
          facility_id: string;
          leaf_count: number;
          merkle_root: string;
          ledger_start_hash: string;
          ledger_end_hash: string;
          network: MerkleAnchorReceipt['network'];
          external_tx_hash: string | null;
          status: MerkleAnchorReceipt['status'];
          leaf_hashes: string[];
          anchored_at: Date;
        }>(
          `SELECT anchor_id, facility_id, leaf_count, merkle_root, ledger_start_hash, ledger_end_hash,
                  network, external_tx_hash, status, leaf_hashes, anchored_at
           FROM merkle_anchors WHERE facility_id = $1 ORDER BY anchored_at DESC LIMIT 100`,
          [facilityId]
        );
        if (res.rows.length > 0) {
          bundles = res.rows.map((r) => ({
            receipt: {
              anchorId: r.anchor_id,
              facilityId: r.facility_id,
              anchoredAt: new Date(r.anchored_at).toISOString(),
              leafCount: Number(r.leaf_count || 0),
              merkleRoot: r.merkle_root,
              ledgerStartHash: r.ledger_start_hash,
              ledgerEndHash: r.ledger_end_hash,
              network: r.network,
              externalTxHash: r.external_tx_hash,
              status: r.status,
              zeroPhiCertified: true,
            },
            leafHashes: Array.isArray(r.leaf_hashes) ? r.leaf_hashes : [],
          }));
        }
      });
    } catch {
      // fall back cleanly to vault
    }
  }

  if (targetHash) {
    for (const bundle of bundles) {
      const proofRes = generateMerkleProof(bundle.leafHashes, targetHash);
      if (proofRes.found) {
        const verified = verifyMerkleProof(targetHash, proofRes.proof, bundle.receipt.merkleRoot);
        return NextResponse.json({
          ok: true,
          verified,
          hash: targetHash,
          anchor: bundle.receipt,
          proof: proofRes.proof,
        });
      }
    }
    return NextResponse.json({
      ok: true,
      verified: false,
      hash: targetHash,
      anchor: bundles[0]?.receipt || null,
      proof: [],
      message: 'Hash has not been included in a sealed Merkle anchor batch yet.',
    });
  }

  return NextResponse.json({
    ok: true,
    facilityId,
    latestAnchor: bundles[0]?.receipt || null,
    anchors: bundles.map((b) => b.receipt),
    totalAnchors: bundles.length,
  });
}

export async function POST(req: NextRequest) {
  // Enforce authenticated session cookie on anchor writes (or header injection after middleware)
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  const headerFac = req.headers.get('x-medcore-facility-id');
  if (!session && !headerFac) {
    return NextResponse.json({ ok: false, error: 'Authenticated hospital session required to anchor ledger.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    facilityId?: string;
    leafHashes?: string[];
  };
  const facilityId = String(body.facilityId || session?.facilityId || headerFac || 'IGH-EKT')
    .trim()
    .toUpperCase();

  const hashes =
    Array.isArray(body.leafHashes) && body.leafHashes.length > 0
      ? body.leafHashes.map((h) => String(h).trim().toLowerCase()).filter(Boolean)
      : await readFacilityAuditHashes(facilityId);

  const tree = buildMerkleTree(hashes);
  const anchoredAt = new Date().toISOString();
  const anchorId = `MRK-${facilityId}-${Date.now().toString(36).toUpperCase()}`;

  let network: MerkleAnchorReceipt['network'] = 'local_cryptographic_seal';
  let externalTxHash: string | null = null;
  let status: MerkleAnchorReceipt['status'] = 'sealed_local';

  const webhookUrl = (process.env.MERKLE_ANCHOR_WEBHOOK_URL || '').trim();
  if (webhookUrl) {
    try {
      const anchorRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.MERKLE_ANCHOR_API_KEY
            ? { Authorization: `Bearer ${process.env.MERKLE_ANCHOR_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          anchorId,
          facilityId,
          merkleRoot: tree.root,
          leafCount: hashes.length,
          anchoredAt,
          zeroPhiCertified: true,
        }),
      });
      if (anchorRes.ok) {
        const resJson = (await anchorRes.json().catch(() => ({}))) as {
          txHash?: string;
          network?: MerkleAnchorReceipt['network'];
        };
        if (resJson.txHash) {
          externalTxHash = String(resJson.txHash);
          network = resJson.network || 'polygon_pos_l2';
          status = 'anchored_onchain';
        }
      }
    } catch {
      // fall back cleanly to local cryptographic seal
    }
  }

  const receipt: MerkleAnchorReceipt = {
    anchorId,
    facilityId,
    anchoredAt,
    leafCount: hashes.length,
    merkleRoot: tree.root,
    ledgerStartHash: hashes[0] || 'GENESIS_00000000000000000000000000000000',
    ledgerEndHash: hashes[hashes.length - 1] || tree.root,
    network,
    externalTxHash,
    status,
    zeroPhiCertified: true,
  };

  const current = readAnchors();
  const leafList = hashes.length > 0 ? hashes : [tree.root];
  writeAnchors([{ receipt, leafHashes: leafList }, ...current].slice(0, 200));

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(facilityId, async (c) => {
        await c.query(
          `INSERT INTO merkle_anchors (
             anchor_id, facility_id, leaf_count, merkle_root, ledger_start_hash,
             ledger_end_hash, network, external_tx_hash, status, leaf_hashes, anchored_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::timestamptz)
           ON CONFLICT (facility_id, anchor_id) DO NOTHING`,
          [
            receipt.anchorId,
            facilityId,
            receipt.leafCount,
            receipt.merkleRoot,
            receipt.ledgerStartHash,
            receipt.ledgerEndHash,
            receipt.network,
            receipt.externalTxHash,
            receipt.status,
            JSON.stringify(leafList),
            receipt.anchoredAt,
          ]
        );
      });
    } catch {
      // fail soft to server vault
    }
  }

  return NextResponse.json({ ok: true, anchor: receipt }, { status: 201 });
}
