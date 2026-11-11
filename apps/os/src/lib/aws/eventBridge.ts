import { EventBridgeClient, PutEventsCommand, PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { awsCredentialsProvider } from '@vercel/functions/oidc';

/**
 * Pillar 2: Workflow Synchronization & Event Brokerage
 *
 * Connects MedCore OS to Amazon EventBridge custom event bus (`medcore-emr-bus`).
 * Enforces the "Database-First, Event-Second" architectural execution flow:
 * Once an Aurora PostgreSQL write succeeds, the event is immediately emitted
 * to EventBridge for asynchronous cross-department routing.
 */

function clean(v: string | undefined | null): string {
  let val = String(v || '').trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

export interface EventBridgeConfig {
  busName: string;
  region: string;
  roleArn?: string;
  accessKeyId: string;
  secretAccessKey: string;
  isConfigured: boolean;
  authMethod: 'oidc_role' | 'iam_keys' | 'none';
}

export function getEventBridgeConfig(): EventBridgeConfig {
  const busName =
    clean(process.env.EVENTBRIDGE_BUS_NAME) ||
    clean(process.env.MEDCORE_EVENTBRIDGE_BUS) ||
    'medcore-emr-bus';

  const region =
    clean(process.env.AWS_REGION) ||
    clean(process.env.MEDCORE_S3_REGION) ||
    clean(process.env.AWS_DEFAULT_REGION) ||
    'eu-west-1';

  const roleArn =
    clean(process.env.AWS_ROLE_ARN) ||
    clean(process.env.MEDCORE_S3_ROLE_ARN);

  const accessKeyId =
    clean(process.env.AWS_ACCESS_KEY_ID) ||
    clean(process.env.MEDCORE_S3_ACCESS_KEY_ID) ||
    clean(process.env.MEDCORE_AWS_ACCESS_KEY_ID);

  const secretAccessKey =
    clean(process.env.AWS_SECRET_ACCESS_KEY) ||
    clean(process.env.MEDCORE_S3_SECRET_ACCESS_KEY) ||
    clean(process.env.MEDCORE_AWS_SECRET_ACCESS_KEY);

  const hasOidc = Boolean(roleArn);
  const hasKeys = Boolean(accessKeyId && secretAccessKey);
  const isConfigured = hasOidc || hasKeys;
  const authMethod = hasOidc ? 'oidc_role' : hasKeys ? 'iam_keys' : 'none';

  return {
    busName,
    region,
    roleArn: roleArn || undefined,
    accessKeyId,
    secretAccessKey,
    isConfigured,
    authMethod,
  };
}

let eventBridgeClientInstance: EventBridgeClient | null = null;

export function getEventBridgeClient(): EventBridgeClient {
  if (eventBridgeClientInstance) return eventBridgeClientInstance;
  const config = getEventBridgeConfig();

  if (config.authMethod === 'oidc_role' && config.roleArn) {
    eventBridgeClientInstance = new EventBridgeClient({
      region: config.region,
      credentials: awsCredentialsProvider({
        roleArn: config.roleArn,
      }),
    });
    return eventBridgeClientInstance;
  }

  eventBridgeClientInstance = new EventBridgeClient({
    region: config.region,
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }
      : {}),
  });

  return eventBridgeClientInstance;
}

export interface MedCoreDomainEvent<T = Record<string, any>> {
  source:
    | 'medcore.emr.reception'
    | 'medcore.emr.triage'
    | 'medcore.emr.clinical'
    | 'medcore.emr.billing'
    | 'medcore.emr.pharmacy'
    | 'medcore.emr.lab'
    | 'medcore.emr.admin'
    | 'medcore.emr.staff';
  detailType:
    | 'PatientRegistered'
    | 'VitalsRecorded'
    | 'ClinicalOrderCreated'
    | 'InvoiceGenerated'
    | 'PaymentConfirmed'
    | 'PrescriptionDispensed'
    | 'LabResultAuthorized'
    | 'PatientAdmitted'
    | 'PatientDischarged'
    | 'StaffRegistered';
  detail: T;
  facilityId?: string;
  traceId?: string;
}

/**
 * Publish a structured domain event to the Amazon EventBridge Custom Bus.
 * Enforces Database-First, Event-Second pattern.
 */
export async function publishMedCoreEvent<T = Record<string, any>>(
  event: MedCoreDomainEvent<T>
): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  const config = getEventBridgeConfig();

  if (!config.isConfigured) {
    console.info(`[EventBridge (Local/Simulated)] ${event.source} -> ${event.detailType}:`, JSON.stringify(event.detail));
    return { ok: true, eventId: `sim-${Date.now().toString(36)}` };
  }

  try {
    const client = getEventBridgeClient();
    const entry: PutEventsRequestEntry = {
      EventBusName: config.busName,
      Source: event.source,
      DetailType: event.detailType,
      Detail: JSON.stringify({
        ...event.detail,
        facilityId: event.facilityId || 'IGH-EKT',
        publishedAt: new Date().toISOString(),
        traceId: event.traceId || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
      Time: new Date(),
    };

    const command = new PutEventsCommand({
      Entries: [entry],
    });

    const response = await client.send(command);
    const resultEntry = response.Entries?.[0];

    if (resultEntry?.ErrorCode) {
      console.error('[EventBridge publish error]', resultEntry.ErrorCode, resultEntry.ErrorMessage);
      return { ok: false, error: resultEntry.ErrorMessage || resultEntry.ErrorCode };
    }

    return {
      ok: true,
      eventId: resultEntry?.EventId,
    };
  } catch (err: any) {
    console.error('[EventBridge publish exception]', err);
    return { ok: false, error: err?.message || 'Failed to dispatch event to EventBridge' };
  }
}

