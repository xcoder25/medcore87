/**
 * Secure clinical messaging — in-basket style, facility-scoped, realtime.
 * Not SMS; internal staff-to-staff + optional patient portal thread.
 */
import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';
import { firestoreSubscribeFacility } from './firebase';

export const MSG_KEY = 'medcore_os_secure_messages_v1';
export const MSG_EVT = 'medcore-secure-messages';

export type MessageThread = {
  id: string;
  facilityId: string;
  subject: string;
  participants: string[]; // badgeIds
  patientId?: string;
  patientName?: string;
  lastBody: string;
  lastAt: string;
  unreadBy: string[];
  priority: 'routine' | 'urgent' | 'critical';
};

export type SecureMessage = {
  id: string;
  threadId: string;
  facilityId: string;
  fromBadge: string;
  fromName: string;
  body: string;
  createdAt: string;
  attachments?: { name: string; url: string }[];
};

type Bag = { threads: MessageThread[]; messages: SecureMessage[] };

function read(facilityId: string): Bag {
  if (typeof window === 'undefined') return { threads: [], messages: [] };
  try {
    const raw = localStorage.getItem(`${MSG_KEY}:${facilityId}`);
    if (!raw) return { threads: [], messages: [] };
    const j = JSON.parse(raw) as Bag;
    return { threads: j.threads || [], messages: j.messages || [] };
  } catch {
    return { threads: [], messages: [] };
  }
}

function write(facilityId: string, bag: Bag) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${MSG_KEY}:${facilityId}`, JSON.stringify(bag));
  try {
    publishFacilityData(facilityId, MSG_KEY, bag);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(MSG_EVT, { detail: { facilityId } }));
}

export function listThreads(facilityId: string, badgeId?: string): MessageThread[] {
  const t = read(facilityId).threads;
  if (!badgeId) return t.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return t
    .filter((x) => x.participants.includes(badgeId))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function listMessages(facilityId: string, threadId: string): SecureMessage[] {
  return read(facilityId)
    .messages.filter((m) => m.threadId === threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function startThread(input: {
  facilityId: string;
  subject: string;
  fromBadge: string;
  fromName: string;
  toBadges: string[];
  body: string;
  patientId?: string;
  patientName?: string;
  priority?: MessageThread['priority'];
}): MessageThread {
  const bag = read(input.facilityId);
  const id = `THR-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();
  const thread: MessageThread = {
    id,
    facilityId: input.facilityId,
    subject: input.subject,
    participants: Array.from(new Set([input.fromBadge, ...input.toBadges])),
    patientId: input.patientId,
    patientName: input.patientName,
    lastBody: input.body,
    lastAt: now,
    unreadBy: input.toBadges.filter((b) => b !== input.fromBadge),
    priority: input.priority || 'routine',
  };
  const msg: SecureMessage = {
    id: `MSG-${Date.now().toString(36)}`,
    threadId: id,
    facilityId: input.facilityId,
    fromBadge: input.fromBadge,
    fromName: input.fromName,
    body: input.body,
    createdAt: now,
  };
  bag.threads.unshift(thread);
  bag.messages.push(msg);
  write(input.facilityId, bag);
  return thread;
}

export function replyToThread(input: {
  facilityId: string;
  threadId: string;
  fromBadge: string;
  fromName: string;
  body: string;
}): void {
  const bag = read(input.facilityId);
  const thread = bag.threads.find((t) => t.id === input.threadId);
  if (!thread) return;
  const now = new Date().toISOString();
  bag.messages.push({
    id: `MSG-${Date.now().toString(36)}`,
    threadId: input.threadId,
    facilityId: input.facilityId,
    fromBadge: input.fromBadge,
    fromName: input.fromName,
    body: input.body,
    createdAt: now,
  });
  thread.lastBody = input.body;
  thread.lastAt = now;
  thread.unreadBy = thread.participants.filter((b) => b !== input.fromBadge);
  write(input.facilityId, bag);
}

export function markThreadRead(facilityId: string, threadId: string, badgeId: string) {
  const bag = read(facilityId);
  const t = bag.threads.find((x) => x.id === threadId);
  if (!t) return;
  t.unreadBy = t.unreadBy.filter((b) => b !== badgeId);
  write(facilityId, bag);
}

export function subscribeMessages(facilityId: string, cb: () => void): () => void {
  const h = () => cb();
  window.addEventListener(MSG_EVT, h);
  const unsub = firestoreSubscribeFacility(facilityId, (data) => {
    const remote = data?.[MSG_KEY] as Bag | undefined;
    if (remote?.threads) {
      localStorage.setItem(`${MSG_KEY}:${facilityId}`, JSON.stringify(remote));
      cb();
    }
  });
  return () => {
    window.removeEventListener(MSG_EVT, h);
    unsub?.();
  };
}

// Ensure FACILITY_KEYS consumers don't break — key is free-form in publishFacilityData
void FACILITY_KEYS;
