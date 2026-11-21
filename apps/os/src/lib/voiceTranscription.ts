'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Clean & normalize Nigerian hospital/clinical terminology from spoken ASR text.
 */
export function cleanMedicalTranscript(raw: string): string {
  if (!raw) return '';
  let s = raw.trim().replace(/\s+/g, ' ');
  const replacements: Array<[RegExp, string]> = [
    [/\bparacetamols?\b/gi, 'Paracetamol'],
    [/\bcoartem\b/gi, 'Coartem (Artemether-Lumefantrine)'],
    [/\baquamarine\b/gi, 'AkwaRemit'],
    [/\bakwa remit\b/gi, 'AkwaRemit'],
    [/\bakwa ibom\b/gi, 'Akwa Ibom'],
    [/\bs p o 2\b/gi, 'SpO2'],
    [/\bspo2\b/gi, 'SpO2'],
    [/\bb p\b/gi, 'BP'],
    [/\bblood pressure\b/gi, 'BP'],
    [/\bmillimeter(s)? of mercury\b/gi, 'mmHg'],
    [/\be[\s-]*mar\b/gi, 'e-MAR'],
    [/\bicu step down\b/gi, 'ICU step-down'],
    [/\bs[\s-]*h[\s-]*i[\s-]*d\b/gi, 'SHID'],
    [/\bnhia\b/gi, 'NHIA'],
  ];
  for (const [re, rep] of replacements) {
    s = s.replace(re, rep);
  }
  return s;
}

export interface AccurateVoiceState {
  supported: boolean;
  listening: boolean;
  transcribing: boolean;
  interimText: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

export function useAccurateVoiceInput(opts: {
  roleHint?: string;
  onTranscript: (text: string) => void;
}): AccurateVoiceState {
  const { roleHint = 'clinician', onTranscript } = opts;
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechFinalRef = useRef<string>('');
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    const hasMedia = Boolean(navigator?.mediaDevices?.getUserMedia);
    const hasSpeech = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
    setSupported(hasMedia || hasSpeech);
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
    };
  }, []);

  const finishRecordingBlob = useCallback(
    async (chunks: Blob[], mimeType: string, speechFallback: string) => {
      const cleanedFallback = cleanMedicalTranscript(speechFallback);
      if (!chunks.length) {
        if (cleanedFallback) onTranscriptRef.current(cleanedFallback);
        setTranscribing(false);
        return;
      }

      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
      if (blob.size < 800) {
        if (cleanedFallback) onTranscriptRef.current(cleanedFallback);
        setTranscribing(false);
        return;
      }

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Audio read error'));
          reader.readAsDataURL(blob);
        });
        const audioBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
        const res = await fetch('/api/ai/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: mimeType || 'audio/webm',
            roleHint,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          transcript?: string;
        };
        if (res.ok && json.ok && json.transcript?.trim()) {
          onTranscriptRef.current(cleanMedicalTranscript(json.transcript));
          setTranscribing(false);
          return;
        }
      } catch {
        /* offline / timeout — fall back to browser speech transcript */
      }

      if (cleanedFallback) {
        onTranscriptRef.current(cleanedFallback);
      } else {
        setError('Could not hear speech clearly. Try speaking closer to your microphone.');
      }
      setTranscribing(false);
    },
    [roleHint]
  );

  const stopListening = useCallback(() => {
    setListening(false);
    try {
      recognitionRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      setTranscribing(true);
      try {
        recorderRef.current.stop();
      } catch {
        setTranscribing(false);
      }
    } else if (speechFinalRef.current.trim()) {
      onTranscriptRef.current(cleanMedicalTranscript(speechFinalRef.current));
      speechFinalRef.current = '';
      setInterimText('');
    }
  }, []);

  const startListening = useCallback(async () => {
    if (listening || transcribing) return;
    setError(null);
    setInterimText('');
    speechFinalRef.current = '';
    chunksRef.current = [];

    // 1. Live Web Speech preview (when browser supports it)
    try {
      const w = window as unknown as {
        SpeechRecognition?: any;
        webkitSpeechRecognition?: any;
      };
      const SpeechCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (SpeechCtor) {
        const rec = new SpeechCtor();
        rec.lang = 'en-NG';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (event: any) => {
          let finalSeg = '';
          let interimSeg = '';
          for (let i = 0; i < event.results.length; i++) {
            const text = event.results[i]?.[0]?.transcript || '';
            if (event.results[i].isFinal) finalSeg += text + ' ';
            else interimSeg += text;
          }
          if (finalSeg.trim()) speechFinalRef.current = finalSeg.trim();
          setInterimText((finalSeg + interimSeg).trim());
        };
        rec.onerror = () => {
          /* MediaRecorder handles audio capture */
        };
        rec.start();
        recognitionRef.current = rec;
      }
    } catch {
      /* ignore speech API failure */
    }

    // 2. High-fidelity MediaRecorder capture for /api/ai/transcribe refinement
    try {
      if (navigator?.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
        const recorder = preferredMime
          ? new MediaRecorder(stream, { mimeType: preferredMime })
          : new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          const mime = recorder.mimeType || preferredMime || 'audio/webm';
          const captured = [...chunksRef.current];
          const speechCopy = speechFinalRef.current || interimText;
          chunksRef.current = [];
          try {
            stream.getTracks().forEach((t) => t.stop());
          } catch {
            /* ignore */
          }
          streamRef.current = null;
          setInterimText('');
          void finishRecordingBlob(captured, mime, speechCopy);
        };
        recorder.start(250);
      }
      setListening(true);
    } catch {
      if (!recognitionRef.current) {
        setError('Microphone permission is required for Voice-to-Text.');
      } else {
        setListening(true);
      }
    }
  }, [listening, transcribing, finishRecordingBlob, interimText]);

  const toggleListening = useCallback(() => {
    if (listening) stopListening();
    else void startListening();
  }, [listening, stopListening, startListening]);

  return {
    supported,
    listening,
    transcribing,
    interimText,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
