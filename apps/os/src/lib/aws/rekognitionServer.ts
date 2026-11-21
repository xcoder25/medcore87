import {
  CompareFacesCommand,
  CreateFaceLivenessSessionCommand,
  DetectFacesCommand,
  GetFaceLivenessSessionResultsCommand,
  RekognitionClient,
  type FaceDetail,
} from '@aws-sdk/client-rekognition';
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
  accessKeyId: string;
  secretAccessKey: string;
  livenessSessionEnabled: boolean;
  isConfigured: boolean;
  authMethod: 'oidc_role' | 'iam_keys' | 'none';
}

export function getRekognitionConfig(): RekognitionConfig {
  const region =
    clean(process.env.MEDCORE_REKOGNITION_REGION) ||
    clean(process.env.REKOGNITION_REGION) ||
    clean(process.env.AWS_REGION) ||
    clean(process.env.MEDCORE_S3_REGION) ||
    clean(process.env.AWS_DEFAULT_REGION) ||
    'eu-west-1';

  const roleArn =
    clean(process.env.MEDCORE_REKOGNITION_ROLE_ARN) ||
    clean(process.env.REKOGNITION_AWS_ROLE_ARN) ||
    clean(process.env.AWS_ROLE_ARN) ||
    clean(process.env.MEDCORE_S3_ROLE_ARN);

  const accessKeyId =
    clean(process.env.MEDCORE_REKOGNITION_ACCESS_KEY_ID) ||
    clean(process.env.AWS_ACCESS_KEY_ID) ||
    clean(process.env.MEDCORE_S3_ACCESS_KEY_ID) ||
    clean(process.env.MEDCORE_AWS_ACCESS_KEY_ID);

  const secretAccessKey =
    clean(process.env.MEDCORE_REKOGNITION_SECRET_ACCESS_KEY) ||
    clean(process.env.AWS_SECRET_ACCESS_KEY) ||
    clean(process.env.MEDCORE_S3_SECRET_ACCESS_KEY) ||
    clean(process.env.MEDCORE_AWS_SECRET_ACCESS_KEY);

  const livenessSessionEnabled =
    clean(process.env.MEDCORE_REKOGNITION_LIVENESS_ENABLED).toLowerCase() === 'true';

  const hasOidc = Boolean(roleArn);
  const hasKeys = Boolean(accessKeyId && secretAccessKey);
  const authMethod = hasOidc ? 'oidc_role' : hasKeys ? 'iam_keys' : 'none';
  const isConfigured = hasOidc || hasKeys;

  return {
    region,
    roleArn: roleArn || undefined,
    accessKeyId,
    secretAccessKey,
    livenessSessionEnabled,
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

export async function createFaceLivenessSession(): Promise<{ sessionId: string | null }> {
  const client = getRekognitionClient();
  const res = await client.send(new CreateFaceLivenessSessionCommand({}));
  return { sessionId: res.SessionId || null };
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
    return 'Facial biometric verification service is unavailable or not yet authorized on this server. Use Fingerprint Passkey or Email OTP.';
  }
  return 'Facial biometric verification encountered a temporary service error. Please try again or use Email OTP.';
}
