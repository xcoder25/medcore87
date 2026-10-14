import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ─── Key-Pair Configuration ───────────────────────────────────────────────────
//
//  Production  → Set both env vars to PEM-encoded key strings:
//    MEDCORE_JWT_PRIVATE_KEY   (RSA private key, PKCS#8 PEM)
//    MEDCORE_JWT_PUBLIC_KEY    (RSA public key, SPKI PEM)
//
//  Development → Keys are auto-generated once per server process and cached in
//    memory. They are regenerated on every restart — tokens do not survive a
//    server restart in dev mode, which is intentional.
//
//  Optional file-based override (useful for local Docker / docker-compose):
//    MEDCORE_JWT_PRIVATE_KEY_FILE  (path to a PEM file)
//    MEDCORE_JWT_PUBLIC_KEY_FILE   (path to a PEM file)

const RSA_MODULUS_LENGTH = 2048; // NIST recommended minimum; use 4096 for HS-classified data

export interface RsaKeyPair {
  /** PKCS#8 PEM private key — used only server-side for signing */
  privateKeyPem: string;
  /** SPKI PEM public key — safe to expose on the /.well-known/jwks.json endpoint */
  publicKeyPem: string;
  /** Crypto key objects (faster than re-importing PEM each call) */
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  /** Key ID — included in JWT `kid` header for JWKS key rotation lookups */
  kid: string;
  /** ISO timestamp of when this key pair was generated / loaded */
  createdAt: string;
  /** 'env' | 'file' | 'ephemeral' */
  source: string;
}

/** Singleton — resolved once at module load time */
let _keyPair: RsaKeyPair | null = null;

/**
 * Reads a PEM string from an environment variable or falls back to a file path.
 * Returns null if neither is set.
 */
function readPemFromEnvOrFile(envKey: string, fileEnvKey: string): string | null {
  const envVal = process.env[envKey];
  if (envVal && envVal.trim().length > 0) {
    // Support escaped newlines passed as a single-line env var
    return envVal.replace(/\\n/g, '\n');
  }

  const filePath = process.env[fileEnvKey];
  if (filePath) {
    const resolved = path.resolve(filePath);
    if (fs.existsSync(resolved)) {
      return fs.readFileSync(resolved, 'utf8');
    }
    console.warn(`[jwtKeys] File specified by ${fileEnvKey} not found: ${resolved}`);
  }

  return null;
}

/**
 * Generates a fresh RSA-2048 key pair.
 * Called only when no production keys are configured.
 */
function generateEphemeralKeyPair(): RsaKeyPair {
  console.warn(
    '[jwtKeys] ⚠️  No RSA keys configured via environment variables. ' +
    'Generating an ephemeral RSA-2048 key pair for this process only. ' +
    'Set MEDCORE_JWT_PRIVATE_KEY and MEDCORE_JWT_PUBLIC_KEY in production.'
  );

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: RSA_MODULUS_LENGTH,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const privateKeyPem = privateKey as unknown as string;
  const publicKeyPem = publicKey as unknown as string;

  // Derive a stable kid from the public key fingerprint (first 8 hex chars of SHA-256)
  const kid = crypto
    .createHash('sha256')
    .update(publicKeyPem)
    .digest('hex')
    .slice(0, 16);

  return {
    privateKeyPem,
    publicKeyPem,
    privateKey: crypto.createPrivateKey(privateKeyPem),
    publicKey: crypto.createPublicKey(publicKeyPem),
    kid,
    createdAt: new Date().toISOString(),
    source: 'ephemeral',
  };
}

/**
 * Resolves the active RSA key pair (lazy singleton).
 * Order of precedence:
 *   1. Environment variables (MEDCORE_JWT_PRIVATE_KEY / MEDCORE_JWT_PUBLIC_KEY)
 *   2. PEM files referenced by MEDCORE_JWT_PRIVATE_KEY_FILE / MEDCORE_JWT_PUBLIC_KEY_FILE
 *   3. Auto-generated ephemeral pair (development only)
 */
export function getJwtKeyPair(): RsaKeyPair {
  if (_keyPair) return _keyPair;

  const privatePem = readPemFromEnvOrFile('MEDCORE_JWT_PRIVATE_KEY', 'MEDCORE_JWT_PRIVATE_KEY_FILE');
  const publicPem  = readPemFromEnvOrFile('MEDCORE_JWT_PUBLIC_KEY',  'MEDCORE_JWT_PUBLIC_KEY_FILE');

  if (privatePem && publicPem) {
    const privateKey = crypto.createPrivateKey(privatePem);
    const publicKey  = crypto.createPublicKey(publicPem);

    const kid = crypto
      .createHash('sha256')
      .update(publicPem)
      .digest('hex')
      .slice(0, 16);

    const source = process.env['MEDCORE_JWT_PRIVATE_KEY'] ? 'env' : 'file';
    console.info(`[jwtKeys] ✅ RS256 key pair loaded from ${source}. kid=${kid}`);

    _keyPair = {
      privateKeyPem: privatePem,
      publicKeyPem: publicPem,
      privateKey,
      publicKey,
      kid,
      createdAt: new Date().toISOString(),
      source,
    };
  } else {
    _keyPair = generateEphemeralKeyPair();
  }

  return _keyPair;
}

/**
 * Exports the public key in JWK (JSON Web Key) format, compatible with
 * JWKS (JSON Web Key Set) endpoints consumed by third-party verifiers.
 *
 * Structure:
 *   { keys: [ { kty, n, e, kid, alg, use } ] }
 */
export function getPublicJwks(): { keys: object[] } {
  const { publicKey, kid } = getJwtKeyPair();

  const jwk = publicKey.export({ format: 'jwk' }) as {
    kty: string; n: string; e: string;
  };

  return {
    keys: [
      {
        kty: jwk.kty,
        use: 'sig',
        alg: 'RS256',
        kid,
        n: jwk.n,
        e: jwk.e,
      },
    ],
  };
}

/**
 * Returns a compact summary of the current key configuration for logging /
 * health-check endpoints. Never includes the private key.
 */
export function getKeyInfo(): {
  algorithm: string;
  modulusLength: number;
  kid: string;
  source: string;
  createdAt: string;
} {
  const { kid, source, createdAt, publicKey } = getJwtKeyPair();
  const details = publicKey.asymmetricKeyDetails;
  return {
    algorithm: 'RS256',
    modulusLength: details?.modulusLength ?? RSA_MODULUS_LENGTH,
    kid,
    source,
    createdAt,
  };
}
