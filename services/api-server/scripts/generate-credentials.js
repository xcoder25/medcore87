/**
 * MedCore Credential Generator
 * ─────────────────────────────
 * Generates all required environment credentials:
 *   1. RSA-2048 key pair (RS256 JWT signing)
 *   2. HMAC-SHA256 secret  (audit ledger block signatures)
 *   3. AES-256 master key  (PHI field-level encryption)
 *
 * Run once, copy the output into your .env file.
 * Keep the private key and secrets OUT of source control.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── 1. RSA-2048 key pair ──────────────────────────────────────────────────────
console.log('\n🔐 Generating RSA-2048 key pair (this takes a moment)...');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Collapse PEM newlines to \n literal so the whole thing fits on one env line
const privatePemEscaped = privateKey.replace(/\n/g, '\\n');
const publicPemEscaped  = publicKey.replace(/\n/g, '\\n');

// ── 2. HMAC secret for audit ledger (64 random hex chars = 256-bit) ───────────
const auditHmacSecret = crypto.randomBytes(32).toString('hex');

// ── 3. AES-256-GCM master key (32 random bytes → base64) ─────────────────────
const aesKey = crypto.randomBytes(32).toString('base64');

// ── 4. Kid (fingerprint of public key) ───────────────────────────────────────
const kid = crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 16);

// ── Output ────────────────────────────────────────────────────────────────────
const envBlock = `
# ═══════════════════════════════════════════════════════════════════════════════
# MedCore M87 — Security Credentials
# Generated: ${new Date().toISOString()}
# KID (key fingerprint): ${kid}
#
# ⚠️  NEVER commit this file to git.
#     Add .env to .gitignore immediately.
# ═══════════════════════════════════════════════════════════════════════════════

# ── RS256 JWT Signing Keys ─────────────────────────────────────────────────────
# Private key: used ONLY by the api-server to sign JWTs. Keep secret.
MEDCORE_JWT_PRIVATE_KEY="${privatePemEscaped}"

# Public key: safe to publish on the /jwks endpoint for external token verification.
MEDCORE_JWT_PUBLIC_KEY="${publicPemEscaped}"

# ── Audit Ledger HMAC-SHA256 Secret ───────────────────────────────────────────
# Separate from JWT — signs each SHA-256 audit block for tamper detection.
MEDCORE_AUDIT_HMAC_SECRET="${auditHmacSecret}"

# ── AES-256-GCM Field-Level PHI Encryption Key ────────────────────────────────
# Used to encrypt patient names, NIN, diagnoses, lab results, etc., at rest.
MEDCORE_ENCRYPTION_MASTER_KEY="${aesKey}"
`.trimStart();

// ── Write to .env file ────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env');  // services/api-server/.env

const alreadyExists = fs.existsSync(envPath);

if (alreadyExists) {
  // Back up existing .env before overwriting
  const backup = envPath + `.backup-${Date.now()}`;
  fs.copyFileSync(envPath, backup);
  console.log(`\n📦 Existing .env backed up → ${backup}`);
}

fs.writeFileSync(envPath, envBlock, 'utf8');

console.log('\n✅  Credentials written to:', envPath);
console.log('\n─── Values (also in the .env file) ───────────────────────────────────────\n');
console.log(`KID                         : ${kid}`);
console.log(`MEDCORE_AUDIT_HMAC_SECRET   : ${auditHmacSecret}`);
console.log(`MEDCORE_ENCRYPTION_MASTER_KEY: ${aesKey}`);
console.log('\n🔑 RSA Private Key (PKCS#8):\n');
console.log(privateKey);
console.log('\n🔓 RSA Public Key (SPKI):\n');
console.log(publicKey);
console.log('\n─────────────────────────────────────────────────────────────────────────');
console.log('⚠️  Make sure services/api-server/.env (or the root .env) is in .gitignore!');
console.log('   Add this line to .gitignore if not already there:  .env*\n');
