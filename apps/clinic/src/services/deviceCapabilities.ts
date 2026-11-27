/**
 * Mobile device hardware & sensor bridges (Audio Capture, QR/Barcode Parsing, Notifications).
 * Gracefully degrades across Web browsers and React Native native shells without crashing when native modules are absent.
 */

export interface ParsedMedCoreQr {
  type: 'shid' | 'staff' | 'drug' | 'unknown';
  id: string;
  facilityId?: string;
  raw: string;
}

export function parseMedCoreQr(rawInput: string): ParsedMedCoreQr {
  const raw = rawInput.trim();
  const up = raw.toUpperCase();
  if (up.startsWith('MEDCORE:SHID:')) {
    const parts = raw.split(':');
    return {
      type: 'shid',
      id: (parts[2] || '').trim().toUpperCase(),
      facilityId: parts[3]?.trim().toUpperCase(),
      raw,
    };
  }
  if (up.startsWith('MEDCORE:BADGE:')) {
    const parts = raw.split(':');
    return {
      type: 'staff',
      id: (parts[2] || '').trim().toUpperCase(),
      facilityId: parts[3]?.trim().toUpperCase(),
      raw,
    };
  }
  if (up.startsWith('SHID-') || up.startsWith('PAT-')) {
    return { type: 'shid', id: up, raw };
  }
  if (up.startsWith('DRUG:') || up.startsWith('RX-') || /^\d{8,14}$/.test(up)) {
    return { type: 'drug', id: up.replace(/^DRUG:/, ''), raw };
  }
  return { type: 'unknown', id: raw, raw };
}

type ToastListener = (toast: { id: string; title: string; body: string }) => void;
const toastListeners = new Set<ToastListener>();

export function subscribeInAppNotifications(cb: ToastListener): () => void {
  toastListeners.add(cb);
  return () => {
    toastListeners.delete(cb);
  };
}

export function triggerLocalNotification(title: string, body: string): void {
  const payload = { id: `NOTIF-${Date.now().toString(36)}`, title, body };
  for (const cb of toastListeners) {
    cb(payload);
  }
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const N = window.Notification;
      if (N.permission === 'granted') {
        new N(title, { body });
      } else if (N.permission === 'default') {
        void N.requestPermission().then((perm) => {
          if (perm === 'granted') new N(title, { body });
        });
      }
    }
  } catch {
    /* ignore in native runtime */
  }
}

export interface WebAudioRecorderHandle {
  stop: () => Promise<{ audioBase64: string; mimeType: string } | null>;
}

export async function startWebAudioCapture(): Promise<WebAudioRecorderHandle | null> {
  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      return null;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: BlobPart[] = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.start(250);

    return {
      stop: () =>
        new Promise((resolve) => {
          recorder.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            try {
              const blob = new Blob(chunks, { type: mimeType });
              const reader = new FileReader();
              reader.onloadend = () => {
                const res = String(reader.result || '');
                const base64 = res.includes(',') ? res.split(',')[1] : res;
                resolve(base64 ? { audioBase64: base64, mimeType } : null);
              };
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            } catch {
              resolve(null);
            }
          };
          try {
            recorder.stop();
          } catch {
            resolve(null);
          }
        }),
    };
  } catch {
    return null;
  }
}
