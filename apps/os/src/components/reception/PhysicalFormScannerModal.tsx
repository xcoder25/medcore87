'use client';

import React, { useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
} from 'lucide-react';

export interface ScannedRegistrationFields {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob?: string;
  ageYears?: string;
  sex?: 'M' | 'F' | 'Other' | '';
  phone?: string;
  altPhone?: string;
  email?: string;
  nin?: string;
  lga?: string;
  ward?: string;
  address?: string;
  bloodGroup?: string;
  genotype?: string;
  maritalStatus?: string;
  occupation?: string;
  religion?: string;
  nextOfKinName?: string;
  nextOfKinRel?: string;
  nextOfKinPhone?: string;
  insuranceProvider?: string;
  nhiaNumber?: string;
  allergies?: string;
  chronicConditions?: string;
  currentMedications?: string;
  confidence?: number;
  notes?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApplyFields: (fields: ScannedRegistrationFields) => void;
}

async function compressToJpegBase64(fileOrCanvas: File | HTMLCanvasElement): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  let canvas: HTMLCanvasElement;
  if (fileOrCanvas instanceof HTMLCanvasElement) {
    canvas = fileOrCanvas;
  } else {
    const imgUrl = URL.createObjectURL(fileOrCanvas);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Could not decode image file'));
        el.src = imgUrl;
      });
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  }
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return {
    base64: dataUrl.replace(/^data:image\/[^;]+;base64,/, ''),
    mimeType: 'image/jpeg',
    previewUrl: dataUrl,
  };
}

export const PhysicalFormScannerModal: React.FC<Props> = ({ open, onClose, onApplyFields }) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ScannedRegistrationFields | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  if (!open) return null;

  const stopCamera = () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    streamRef.current = null;
    setCameraActive(false);
  };

  const closeCleanly = () => {
    stopCamera();
    onClose();
  };

  const runScan = async (imageBase64: string, mimeType: string, preview: string) => {
    setPreviewUrl(preview);
    setScanning(true);
    setError(null);
    setExtracted(null);
    try {
      const res = await fetch('/api/ai/scan-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        fields?: ScannedRegistrationFields;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.fields) {
        setError(json.error || 'Could not extract fields from this image. Ensure handwriting or print is well-lit and sharp.');
        return;
      }
      setExtracted(json.fields);
    } catch {
      setError('Network error while scanning form. Check connection or enter fields manually.');
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    stopCamera();
    try {
      const { base64, mimeType, previewUrl: url } = await compressToJpegBase64(file);
      await runScan(base64, mimeType, url);
    } catch (e) {
      setError((e as Error)?.message || 'Unsupported image format.');
    }
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 60);
    } catch {
      setError('Camera permission denied or unavailable. Use "Upload Paper Photo" instead.');
    }
  };

  const captureFromCamera = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    const { base64, mimeType, previewUrl: url } = await compressToJpegBase64(canvas);
    await runScan(base64, mimeType, url);
  };

  const EDITABLE_KEYS: Array<[keyof ScannedRegistrationFields, string]> = [
    ['firstName', 'First Name'],
    ['middleName', 'Middle Name'],
    ['lastName', 'Last Name'],
    ['dob', 'Date of Birth (YYYY-MM-DD)'],
    ['sex', 'Sex (M/F)'],
    ['phone', 'Phone Number'],
    ['nin', 'NIN (11 Digits)'],
    ['lga', 'LGA'],
    ['ward', 'Ward'],
    ['address', 'Residential Address'],
    ['bloodGroup', 'Blood Group'],
    ['genotype', 'Genotype'],
    ['nextOfKinName', 'Next of Kin Name'],
    ['nextOfKinPhone', 'Next of Kin Phone'],
    ['insuranceProvider', 'Insurance / HMO'],
    ['nhiaNumber', 'NHIA / Insurance ID'],
    ['allergies', 'Known Allergies'],
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 18,
          width: '100%',
          maxWidth: 780,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(15,23,42,0.35)',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #0369A1 100%)',
            color: '#FFFFFF',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={19} color="#38BDF8" />
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Celestia AI Paper Form Scanner</div>
              <div style={{ fontSize: 12, color: '#BAE6FD' }}>
                Snap or upload a filled hospital registration card/form to auto-populate EMR fields
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCleanly}
            style={{ background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                background: '#0284C7',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <Upload size={15} /> Upload / Mobile Camera Photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => {
                  void handleFileChange(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
            </label>

            {!cameraActive ? (
              <button
                type="button"
                onClick={() => void startCamera()}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  color: '#0F172A',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <Camera size={15} /> Use Live Webcam / Desk Camera
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void captureFromCamera()}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <Camera size={15} /> Capture & Extract Form
              </button>
            )}
          </div>

          {cameraActive && (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #0284C7', background: '#000' }}>
              <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 280, objectFit: 'cover' }} />
            </div>
          )}

          {scanning && (
            <div style={{ padding: 20, borderRadius: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 10, color: '#1D4ED8', fontWeight: 700, fontSize: 13 }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Celestia Vision AI is reading handwritten & printed fields on the paper form…
            </div>
          )}

          {error && (
            <div style={{ padding: 12, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="#DC2626" />
              {error}
            </div>
          )}

          {extracted && (
            <div style={{ display: 'grid', gridTemplateColumns: previewUrl ? 'minmax(180px, 240px) minmax(0, 1fr)' : '1fr', gap: 16 }}>
              {previewUrl && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>SCANNED FORM</div>
                  <img
                    src={previewUrl}
                    alt="Scanned registration form"
                    style={{ width: '100%', borderRadius: 10, border: '1px solid #CBD5E1', objectFit: 'cover' }}
                  />
                  {typeof extracted.confidence === 'number' && (
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#059669' }}>
                      Extraction Confidence: {Math.round(extracted.confidence * 100)}%
                    </div>
                  )}
                </div>
              )}

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
                  Review & Edit Extracted Patient Fields
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {EDITABLE_KEYS.map(([key, label]) => (
                    <label key={key} style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                      {label}
                      <input
                        type="text"
                        value={String(extracted[key] ?? '')}
                        onChange={(e) =>
                          setExtracted((prev) => ({ ...(prev || {}), [key]: e.target.value }))
                        }
                        style={{
                          width: '100%',
                          marginTop: 3,
                          padding: '6px 9px',
                          borderRadius: 7,
                          border: '1px solid #CBD5E1',
                          fontSize: 12,
                          color: '#0F172A',
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {extracted && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
              <button
                type="button"
                onClick={closeCleanly}
                style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyFields(extracted);
                  closeCleanly();
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: 9,
                  border: 'none',
                  background: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CheckCircle2 size={15} /> Autofill EMR Registration Form
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
