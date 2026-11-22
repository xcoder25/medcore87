import {
  CompareFacesCommand,
  CreateFaceLivenessSessionCommand,
  DetectFacesCommand,
  GetFaceLivenessSessionResultsCommand,
  RekognitionClient,
  type FaceDetail,
} from '@aws-sdk/client-rekognition';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { awsCredentialsProvider } from '@vercel/functions/oidc';

/**
 * Server-side Amazon Rekognition client & facial biometric verification helpers.
 * Supports Vercel OIDC federation and standard IAM access keys.
 * All public error messages remain strictly vendor-neutral.
 */

function clean(v: string | undefined | null): string {
  let val = String(v || '').trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

export interface RekognitionConfig {
  region: string;
  roleArn?: string;
  livenessRoleArn?: string;
  accessKeyId: string;
  secretAccessKey: string;
  livenessSessionEnabled: boolean;
  livenessMinConfidence: number;
  canMintLivenessCredentials: boolean;
  isConfigured: boolean;
  authMethod: 'oidc_role' | 'iam_keys' | 'none';
}

export function getRekognitionConfig(): RekognitionConfig {
  const rawRegion =
    clean(process.env.MEDCORE_REKOGNITION_AWS_REGION) ||
    clean(process.env.MEDCORE_REKOGNITION_REGION) ||
    clean(process.env.REKOGNITION_REGION) ||
    clean(process.env.MEDCORE_S3_AWS_REGION) ||
    clean(process.env.MEDCORE_S3_REGION) ||
    clean(process.env.AWS_REGION) ||
    clean(process.env.AWS_DEFAULT_REGION) ||
    'eu-west-1';

  // Amazon Rekognition is not available in some regions such as eu-north-1
  const region = rawRegion === 'eu-north-1' ? 'eu-west-1' : rawRegion;

  const roleArn =
    clean(process.env.MEDCORE_REKOGNITION_AWS_ROLE_ARN) ||
    clean(process.env.MEDCORE_REKOGNITION_ROLE_ARN) ||
    clean(process.env.REKOGNITION_AWS_ROLE_ARN) ||
    clean(process.env.AWS_ROLE_ARN) ||
    clean(process.env.MEDCORE_S3_AWS_ROLE_ARN) ||
    clean(process.env.MEDCORE_S3_ROLE_ARN) ||
    clean(process.env.MEDCORE_AWS_ROLE_ARN);

  const livenessRoleArn =
    clean(process.env.MEDCORE_REKOGNITION_LIVENESS_ROLE_ARN) ||
    clean(process.env.AWS_LIVENESS_IAM_ROLE_ARN) ||
    roleArn;

  const accessKeyId =
    clean(process.env.MEDCORE_REKOGNITION_AWS_ACCESS_KEY_ID) ||
    clean(process.env.MEDCORE_REKOGNITION_ACCESS_KEY_ID) ||
    clean(process.env.MEDCORE_S3_AWS_ACCESS_KEY_ID) ||
    clean(process.env.MEDCORE_S3_ACCESS_KEY_ID) ||
    clean(process.env.AWS_ACCESS_KEY_ID) ||
    clean(process.env.MEDCORE_AWS_ACCESS_KEY_ID);

  const secretAccessKey =
    clean(process.env.MEDCORE_REKOGNITION_AWS_SECRET_ACCESS_KEY) ||
    clean(process.env.MEDCORE_REKOGNITION_SECRET_ACCESS_KEY) ||
    clean(process.env.MEDCORE_S3_AWS_SECRET_ACCESS_KEY) ||
    clean(process.env.MEDCORE_S3_SECRET_ACCESS_KEY) ||
    clean(process.env.AWS_SECRET_ACCESS_KEY) ||
    clean(process.env.MEDCORE_AWS_SECRET_ACCESS_KEY);

  const livenessSessionEnabled =
    clean(process.env.MEDCORE_REKOGNITION_LIVENESS_ENABLED).toLowerCase() === 'true';

  const rawMinConf = Number(clean(process.env.MEDCORE_REKOGNITION_LIVENESS_MIN_CONFIDENCE));
  const livenessMinConfidence =
    Number.isFinite(rawMinConf) && rawMinConf > 0
      ? Math.max(50, Math.min(99, rawMinConf))
      : 85;

  const hasOidc = Boolean(roleArn);
  const hasKeys = Boolean(accessKeyId && secretAccessKey);
  const authMethod = hasOidc ? 'oidc_role' : hasKeys ? 'iam_keys' : 'none';
  const isConfigured = hasOidc || hasKeys;
  const canMintLivenessCredentials = Boolean(
    isConfigured && (authMethod === 'oidc_role' || livenessRoleArn)
  );

  return {
    region,
    roleArn: roleArn || undefined,
    livenessRoleArn: livenessRoleArn || undefined,
    accessKeyId,
    secretAccessKey,
    livenessSessionEnabled,
    livenessMinConfidence,
    canMintLivenessCredentials,
    isConfigured,
    authMethod,
  };
}

export function isRekognitionConfigured(): boolean {
  return getRekognitionConfig().isConfigured;
}

let cachedClient: { key: string; client: RekognitionClient } | null = null;

export function resetRekognitionClient(): void {
  cachedClient = null;
}

export function getRekognitionClient(): RekognitionClient {
  const cfg = getRekognitionConfig();
  const cacheKey = `${cfg.authMethod}:${cfg.region}:${cfg.roleArn || cfg.accessKeyId || 'none'}`;
  if (cachedClient && cachedClient.key === cacheKey) {
    return cachedClient.client;
  }

  let client: RekognitionClient;
  if (cfg.authMethod === 'oidc_role' && cfg.roleArn) {
    client = new RekognitionClient({
      region: cfg.region,
      credentials: awsCredentialsProvider({
        roleArn: cfg.roleArn,
        clientConfig: { region: cfg.region },
      }),
    });
  } else if (cfg.authMethod === 'iam_keys') {
    client = new RekognitionClient({
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  } else {
    client = new RekognitionClient({ region: cfg.region });
  }

  cachedClient = { key: cacheKey, client };
  return client;
}

export type FaceLivenessPrompt = 'smile' | 'turn_left' | 'turn_right';

export const FACE_LIVENESS_PROMPTS: Record<FaceLivenessPrompt, string> = {
  smile: 'Smile clearly toward the camera',
  turn_left: 'Turn your head slightly to the left',
  turn_right: 'Turn your head slightly to the right',
};

export interface FaceQualityEvaluation {
  ok: boolean;
  reason?: string;
  qualityScore?: number;
  face?: FaceDetail;
}

/**
 * Evaluate a single DetectFaces result list for biometric enrollment or neutral frame matching.
 */
export function evaluateFaceQuality(faceDetails: FaceDetail[] | undefined): FaceQualityEvaluation {
  const faces = Array.isArray(faceDetails) ? faceDetails : [];
  if (faces.length === 0) {
    return {
      ok: false,
      reason: 'No face detected. Center your face inside the oval guide in good lighting and try again.',
    };
  }
  if (faces.length > 1) {
    return {
      ok: false,
      reason: 'Multiple faces detected. Ensure only one person is visible in the camera frame.',
    };
  }

  const face = faces[0];
  const confidence = Number(face.Confidence ?? 0);
  if (confidence < 95) {
    return {
      ok: false,
      reason: 'Face could not be detected clearly enough. Move closer to the camera in brighter lighting.',
    };
  }

  if (face.EyesOpen?.Value === false && Number(face.EyesOpen?.Confidence ?? 0) >= 80) {
    return {
      ok: false,
      reason: 'Please keep both eyes open while capturing your facial biometric.',
    };
  }

  if (face.Sunglasses?.Value === true && Number(face.Sunglasses?.Confidence ?? 0) >= 80) {
    return {
      ok: false,
      reason: 'Please remove sunglasses or tinted eyewear before capturing your facial biometric.',
    };
  }

  const yaw = Math.abs(Number(face.Pose?.Yaw ?? 0));
  const pitch = Math.abs(Number(face.Pose?.Pitch ?? 0));
  const roll = Math.abs(Number(face.Pose?.Roll ?? 0));
  if (yaw > 25 || pitch > 22 || roll > 25) {
    return {
      ok: false,
      reason: 'Please look directly toward the camera with your head level.',
    };
  }

  const brightness = Number(face.Quality?.Brightness ?? 50);
  const sharpness = Number(face.Quality?.Sharpness ?? 50);
  if (brightness < 20) {
    return {
      ok: false,
      reason: 'Lighting is too dim for biometric capture. Move to a brighter area and try again.',
    };
  }
  if (sharpness < 15) {
    return {
      ok: false,
      reason: 'Camera frame is slightly blurry. Hold steady for a moment and retry.',
    };
  }

  const qualityScore = Math.round(
    Math.min(100, (confidence * 0.4 + Math.min(100, brightness) * 0.3 + Math.min(100, sharpness) * 0.3))
  );
  return { ok: true, qualityScore, face };
}

export interface ActiveLivenessEvaluation {
  ok: boolean;
  reason?: string;
  yawDelta?: number;
}

/**
 * Verify that the challenge frame reflects a genuine live facial/pose change relative to the neutral frame.
 */
export function evaluateActiveLiveness(
  neutralFace: FaceDetail,
  challengeFace: FaceDetail,
  prompt: FaceLivenessPrompt
): ActiveLivenessEvaluation {
  const neutralYaw = Number(neutralFace.Pose?.Yaw ?? 0);
  const challengeYaw = Number(challengeFace.Pose?.Yaw ?? 0);
  const yawDelta = Math.abs(challengeYaw - neutralYaw);

  if (prompt === 'smile') {
    const challengeSmiling = Boolean(challengeFace.Smile?.Value);
    const challengeSmileConf = Number(challengeFace.Smile?.Confidence ?? 0);
    const neutralSmileConf = neutralFace.Smile?.Value ? Number(neutralFace.Smile?.Confidence ?? 0) : 0;
    if (challengeSmiling && (challengeSmileConf >= 65 || challengeSmileConf - neutralSmileConf >= 20)) {
      return { ok: true, yawDelta };
    }
    return {
      ok: false,
      reason: 'Liveness check did not detect a clear smile on the second capture. Please smile clearly and retry.',
      yawDelta,
    };
  }

  // Absolute yaw delta accommodates both mirrored selfie previews and raw camera streams cleanly
  // while reliably blocking static photos held up to the camera.
  if (yawDelta >= 10) {
    return { ok: true, yawDelta };
  }
  return {
    ok: false,
    reason:
      prompt === 'turn_left'
        ? 'Please turn your head noticeably to the left during the second capture so liveness can be confirmed.'
        : 'Please turn your head noticeably to the right during the second capture so liveness can be confirmed.',
    yawDelta,
  };
}

export interface FaceProbeResult {
  ok: boolean;
  faceDetected: boolean;
  readyForNeutral: boolean;
  livenessMatched: boolean;
  guidance: string;
  qualityScore?: number;
  pose?: { yaw: number; pitch: number; roll: number };
  smiling?: boolean;
  smileConfidence?: number;
  engine: 'cloud_vision' | 'standard';
}

export interface FaceProbeOptions {
  stage?: 'enroll' | 'neutral' | 'liveness';
  prompt?: FaceLivenessPrompt;
  neutralPoseYaw?: number;
  neutralSmileConfidence?: number;
}

/**
 * Evaluate a single DetectFaces frame during hands-free auto-scanning to provide
 * live positioning guidance and trigger automatic step transitions cleanly.
 */
export function evaluateFaceProbe(
  faceDetails: FaceDetail[] | undefined,
  opts: FaceProbeOptions = {}
): FaceProbeResult {
  const stage = opts.stage || 'neutral';
  const faces = Array.isArray(faceDetails) ? faceDetails : [];

  if (faces.length === 0) {
    return {
      ok: true,
      faceDetected: false,
      readyForNeutral: false,
      livenessMatched: false,
      guidance: 'Position your face inside the oval guide.',
      engine: 'cloud_vision',
    };
  }

  if (faces.length > 1) {
    return {
      ok: true,
      faceDetected: true,
      readyForNeutral: false,
      livenessMatched: false,
      guidance: 'Multiple faces detected. Only one person should be in view.',
      engine: 'cloud_vision',
    };
  }

  const face = faces[0];
  const yaw = Number(face.Pose?.Yaw ?? 0);
  const pitch = Number(face.Pose?.Pitch ?? 0);
  const roll = Number(face.Pose?.Roll ?? 0);
  const smiling = Boolean(face.Smile?.Value);
  const smileConfidence = Number(face.Smile?.Confidence ?? 0);
  const boxWidth = Number(face.BoundingBox?.Width ?? 0);

  if (boxWidth > 0 && boxWidth < 0.14) {
    return {
      ok: true,
      faceDetected: true,
      readyForNeutral: false,
      livenessMatched: false,
      guidance: 'Move slightly closer to the camera.',
      pose: { yaw, pitch, roll },
      smiling,
      smileConfidence,
      engine: 'cloud_vision',
    };
  }

  if (boxWidth > 0 && boxWidth > 0.85) {
    return {
      ok: true,
      faceDetected: true,
      readyForNeutral: false,
      livenessMatched: false,
      guidance: 'Move slightly back so your full face fits inside the oval.',
      pose: { yaw, pitch, roll },
      smiling,
      smileConfidence,
      engine: 'cloud_vision',
    };
  }

  if (stage === 'enroll' || stage === 'neutral') {
    const quality = evaluateFaceQuality(faces);
    if (!quality.ok) {
      return {
        ok: true,
        faceDetected: true,
        readyForNeutral: false,
        livenessMatched: false,
        guidance: quality.reason || 'Center your face and look straight ahead.',
        pose: { yaw, pitch, roll },
        smiling,
        smileConfidence,
        engine: 'cloud_vision',
      };
    }

    return {
      ok: true,
      faceDetected: true,
      readyForNeutral: true,
      livenessMatched: false,
      guidance:
        stage === 'enroll'
          ? 'Face aligned — enrolling automatically…'
          : 'Front view aligned — capturing automatically…',
      qualityScore: quality.qualityScore,
      pose: { yaw, pitch, roll },
      smiling,
      smileConfidence,
      engine: 'cloud_vision',
    };
  }

  // stage === 'liveness'
  if (Number(face.Confidence ?? 0) < 90) {
    return {
      ok: true,
      faceDetected: true,
      readyForNeutral: true,
      livenessMatched: false,
      guidance: 'Keep your face well lit inside the oval.',
      pose: { yaw, pitch, roll },
      smiling,
      smileConfidence,
      engine: 'cloud_vision',
    };
  }

  const prompt = opts.prompt || 'smile';
  const neutralSmileConf = Number(opts.neutralSmileConfidence ?? 0);
  const neutralFace: FaceDetail = {
    Pose: { Yaw: Number(opts.neutralPoseYaw ?? 0) },
    Smile: {
      Value: neutralSmileConf >= 65,
      Confidence: neutralSmileConf,
    },
  };
  const liveness = evaluateActiveLiveness(neutralFace, face, prompt);
  if (liveness.ok) {
    return {
      ok: true,
      faceDetected: true,
      readyForNeutral: true,
      livenessMatched: true,
      guidance: 'Liveness confirmed — verifying identity…',
      pose: { yaw, pitch, roll },
      smiling,
      smileConfidence,
      engine: 'cloud_vision',
    };
  }

  return {
    ok: true,
    faceDetected: true,
    readyForNeutral: true,
    livenessMatched: false,
    guidance: FACE_LIVENESS_PROMPTS[prompt],
    pose: { yaw, pitch, roll },
    smiling,
    smileConfidence,
    engine: 'cloud_vision',
  };
}

export async function probeFaceFrame(
  imageBuffer: Buffer,
  opts: FaceProbeOptions = {}
): Promise<FaceProbeResult> {
  const client = getRekognitionClient();
  const res = await client.send(
    new DetectFacesCommand({
      Image: { Bytes: imageBuffer },
      Attributes: ['ALL'],
    })
  );
  return evaluateFaceProbe(res.FaceDetails, opts);
}

export async function assessFaceQuality(imageBuffer: Buffer): Promise<FaceQualityEvaluation> {
  const client = getRekognitionClient();
  const res = await client.send(
    new DetectFacesCommand({
      Image: { Bytes: imageBuffer },
      Attributes: ['ALL'],
    })
  );
  return evaluateFaceQuality(res.FaceDetails);
}

export async function verifyActiveLiveness(
  neutralBuffer: Buffer,
  challengeBuffer: Buffer,
  prompt: FaceLivenessPrompt
): Promise<{ ok: boolean; similarity?: number; reason?: string }> {
  if (Buffer.compare(neutralBuffer, challengeBuffer) === 0) {
    return {
      ok: false,
      reason: 'Liveness requires two distinct frames. Complete the requested camera movement and try again.',
    };
  }

  const client = getRekognitionClient();
  const [neutralRes, challengeRes, pairCompareRes] = await Promise.all([
    client.send(new DetectFacesCommand({ Image: { Bytes: neutralBuffer }, Attributes: ['ALL'] })),
    client.send(new DetectFacesCommand({ Image: { Bytes: challengeBuffer }, Attributes: ['ALL'] })),
    client.send(
      new CompareFacesCommand({
        SourceImage: { Bytes: neutralBuffer },
        TargetImage: { Bytes: challengeBuffer },
        SimilarityThreshold: 88,
        QualityFilter: 'AUTO',
      })
    ),
  ]);

  const neutralQuality = evaluateFaceQuality(neutralRes.FaceDetails);
  if (!neutralQuality.ok || !neutralQuality.face) {
    return { ok: false, reason: neutralQuality.reason || 'Neutral camera frame did not pass quality checks.' };
  }

  const challengeFaces = Array.isArray(challengeRes.FaceDetails) ? challengeRes.FaceDetails : [];
  if (challengeFaces.length === 0) {
    return { ok: false, reason: 'No face was visible during the liveness step. Keep your face centered.' };
  }
  if (challengeFaces.length > 1) {
    return { ok: false, reason: 'Multiple faces appeared during the liveness check. Ensure only you are in view.' };
  }

  const challengeFace = challengeFaces[0];
  if (Number(challengeFace.Confidence ?? 0) < 90) {
    return { ok: false, reason: 'Liveness frame was unclear. Keep your face well lit and retry.' };
  }

  const pairMatches = Array.isArray(pairCompareRes.FaceMatches) ? pairCompareRes.FaceMatches : [];
  const pairSimilarity = pairMatches.reduce((max, m) => Math.max(max, Number(m.Similarity ?? 0)), 0);
  if (pairSimilarity < 88) {
    return {
      ok: false,
      reason: 'The same person must remain in front of the camera for both captures.',
    };
  }

  const livenessCheck = evaluateActiveLiveness(neutralQuality.face, challengeFace, prompt);
  if (!livenessCheck.ok) {
    return { ok: false, reason: livenessCheck.reason };
  }

  return { ok: true, similarity: pairSimilarity };
}

export async function compareFaceWithReference(
  liveBuffer: Buffer,
  referenceBuffer: Buffer,
  similarityThreshold = 92
): Promise<{ matched: boolean; similarity: number; faceMatchCount: number }> {
  const client = getRekognitionClient();
  const res = await client.send(
    new CompareFacesCommand({
      SourceImage: { Bytes: referenceBuffer },
      TargetImage: { Bytes: liveBuffer },
      SimilarityThreshold: similarityThreshold,
      QualityFilter: 'AUTO',
    })
  );

  const matches = Array.isArray(res.FaceMatches) ? res.FaceMatches : [];
  const best = matches.reduce((max, m) => Math.max(max, Number(m.Similarity ?? 0)), 0);
  return {
    matched: matches.length > 0 && best >= similarityThreshold,
    similarity: best,
    faceMatchCount: matches.length,
  };
}

export interface TemporaryLivenessCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
  region: string;
}

const LIVENESS_ONLY_SESSION_POLICY = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Action: 'rekognition:StartFaceLivenessSession',
      Resource: '*',
    },
  ],
});

/**
 * Mint short-lived AWS STS credentials strictly scoped to `rekognition:StartFaceLivenessSession`
 * for browser streaming without Cognito. Never exposes long-lived IAM keys to the client.
 */
export async function getTemporaryLivenessCredentials(): Promise<TemporaryLivenessCredentials> {
  const cfg = getRekognitionConfig();
  const targetRoleArn = cfg.livenessRoleArn || cfg.roleArn;

  if (cfg.authMethod === 'oidc_role' && targetRoleArn) {
    const baseRoleArn = cfg.roleArn || targetRoleArn;
    const baseProvider = awsCredentialsProvider({
      roleArn: baseRoleArn,
      clientConfig: { region: cfg.region },
    });

    if (cfg.livenessRoleArn && cfg.roleArn && cfg.livenessRoleArn !== cfg.roleArn) {
      const sts = new STSClient({ region: cfg.region, credentials: baseProvider });
      const assumed = await sts.send(
        new AssumeRoleCommand({
          RoleArn: cfg.livenessRoleArn,
          RoleSessionName: 'medcore-liveness-web',
          DurationSeconds: 900,
          Policy: LIVENESS_ONLY_SESSION_POLICY,
        })
      );
      const creds = assumed.Credentials;
      if (!creds?.AccessKeyId || !creds?.SecretAccessKey || !creds?.SessionToken) {
        throw new Error('Failed to mint scoped temporary liveness credentials.');
      }
      return {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretAccessKey,
        sessionToken: creds.SessionToken,
        expiration: (creds.Expiration || new Date(Date.now() + 900_000)).toISOString(),
        region: cfg.region,
      };
    }

    const oidcCreds = await baseProvider();
    if (!oidcCreds?.accessKeyId || !oidcCreds?.secretAccessKey || !oidcCreds?.sessionToken) {
      throw new Error('OIDC provider did not return temporary STS session credentials.');
    }
    return {
      accessKeyId: oidcCreds.accessKeyId,
      secretAccessKey: oidcCreds.secretAccessKey,
      sessionToken: oidcCreds.sessionToken,
      expiration: (oidcCreds.expiration || new Date(Date.now() + 900_000)).toISOString(),
      region: cfg.region,
    };
  }

  if (cfg.authMethod === 'iam_keys' && cfg.livenessRoleArn) {
    const sts = new STSClient({
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
    const assumed = await sts.send(
      new AssumeRoleCommand({
        RoleArn: cfg.livenessRoleArn,
        RoleSessionName: 'medcore-liveness-web',
        DurationSeconds: 900,
        Policy: LIVENESS_ONLY_SESSION_POLICY,
      })
    );
    const creds = assumed.Credentials;
    if (!creds?.AccessKeyId || !creds?.SecretAccessKey || !creds?.SessionToken) {
      throw new Error('Failed to assume scoped temporary liveness role.');
    }
    return {
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretAccessKey,
      sessionToken: creds.SessionToken,
      expiration: (creds.Expiration || new Date(Date.now() + 900_000)).toISOString(),
      region: cfg.region,
    };
  }

  throw new Error('Temporary liveness credentials require an IAM role ARN.');
}

export async function createFaceLivenessSession(): Promise<{
  sessionId: string | null;
  region: string;
}> {
  const cfg = getRekognitionConfig();
  const client = getRekognitionClient();
  const res = await client.send(new CreateFaceLivenessSessionCommand({}));
  return { sessionId: res.SessionId || null, region: cfg.region };
}

export async function getFaceLivenessSessionResult(sessionId: string): Promise<{
  status: string;
  confidence: number;
  referenceBytes?: Uint8Array;
}> {
  const client = getRekognitionClient();
  const res = await client.send(new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }));
  return {
    status: String(res.Status || 'UNKNOWN'),
    confidence: Number(res.Confidence ?? 0),
    referenceBytes: res.ReferenceImage?.Bytes,
  };
}

export function isRekognitionAuthError(err: unknown): boolean {
  const e = err as { name?: string; Code?: string; message?: string } | undefined;
  const code = String(e?.name || e?.Code || '').toLowerCase();
  const msg = String(e?.message || '').toLowerCase();
  return (
    code.includes('accessdenied') ||
    code.includes('unrecognizedclient') ||
    code.includes('invalidsignature') ||
    code.includes('expiredtoken') ||
    code.includes('credentialsprovider') ||
    code.includes('notauthorized') ||
    code.includes('optinrequired') ||
    code.includes('subscriptionrequired') ||
    code.includes('endpointconnection') ||
    msg.includes('security token') ||
    msg.includes('credentials') ||
    msg.includes('not authorized') ||
    msg.includes('could not load credentials')
  );
}

/**
 * Translate provider SDK exceptions into safe, vendor-neutral clinical workstation messages.
 */
export function toSafeBiometricError(err: unknown): string {
  const e = err as { name?: string; Code?: string; message?: string } | undefined;
  const code = String(e?.name || e?.Code || '').toLowerCase();
  const msg = String(e?.message || '').toLowerCase();

  if (code.includes('invalidimageformat') || msg.includes('invalid image')) {
    return 'Unsupported camera image format. Please use JPEG or PNG and try again.';
  }
  if (code.includes('imagetoolarge')) {
    return 'Captured facial image is too large. Please retry from the camera dialog.';
  }
  if (code.includes('invalidparameter')) {
    return 'Camera frame could not be analyzed clearly. Center your face in good lighting and retry.';
  }
  if (code.includes('throttling') || code.includes('provisionedthroughput')) {
    return 'Biometric verification service is momentarily busy. Please wait a few seconds and retry.';
  }
  if (
    code.includes('accessdenied') ||
    code.includes('unrecognizedclient') ||
    code.includes('invalidsignature') ||
    code.includes('credential') ||
    msg.includes('security token') ||
    msg.includes('credentials')
  ) {
    return 'Facial biometric verification service is unavailable or not yet authorized on this server. Use Email OTP.';
  }
  return 'Facial biometric verification encountered a temporary service error. Please try again or use Email OTP.';
}
