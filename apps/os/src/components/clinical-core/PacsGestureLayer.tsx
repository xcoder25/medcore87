'use client';

/**
 * PacsGestureLayer — Invisible MediaPipe hand-tracking for PACS viewer.
 *
 * Runs the webcam entirely off-screen (detached video element, never attached
 * to the DOM tree) so the clinician sees no distracting mirror camera preview.
 *
 * Gesture vocabulary:
 *   • Pinch-to-zoom  — thumb (L4) + index (L8) distance while middle (L12) is spread
 *   • Flat-palm pan  — index-tip drag while NOT pinching
 *
 * Returns null — zero DOM output.
 * Loads MediaPipe Hands runtime via CDN dynamically to keep the Next.js bundle light
 * and bypass webpack parsing limits for pre-compiled WASM/CJS glue.
 */

import { useEffect, useRef } from 'react';

interface PacsGestureProps {
  /** Scale multiplier callback: values >1 zoom in, <1 zoom out */
  onZoom: (scaleFactor: number) => void;
  /** Canvas-space pixel delta callback for panning the DICOM viewport */
  onPan: (deltaX: number, deltaY: number) => void;
}

/** Loads the standalone MediaPipe Hands script on-demand in the browser */
function loadMediaPipeHands(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  const w = window as any;
  if (w.Hands) return Promise.resolve(w.Hands);

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src*="@mediapipe/hands"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve((window as any).Hands));
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => {
      if ((window as any).Hands) {
        resolve((window as any).Hands);
      } else {
        reject(new Error('MediaPipe Hands not defined'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load MediaPipe Hands from CDN'));
    document.head.appendChild(script);
  });
}

export default function PacsGestureLayer({ onZoom, onPan }: PacsGestureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prevPinchDistRef = useRef<number | null>(null);
  const prevPanPosRef = useRef<{ x: number; y: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    let handsInstance: any = null;
    let stream: MediaStream | null = null;
    let destroyed = false;

    // 1. Create a detached, off-screen hidden video element
    const video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-9999px;left:-9999px;';
    videoRef.current = video;

    const bootstrap = async () => {
      try {
        const HandsConstructor = await loadMediaPipeHands();
        if (destroyed || !HandsConstructor) return;

        const hands = new HandsConstructor({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.75, // Higher confidence for clinical environment
          minTrackingConfidence: 0.75,
        });

        hands.onResults((results: any) => {
          if (
            !results.multiHandLandmarks ||
            results.multiHandLandmarks.length === 0
          ) {
            prevPinchDistRef.current = null;
            prevPanPosRef.current = null;
            return;
          }

          const landmarks = results.multiHandLandmarks[0];
          const thumb = landmarks[4];
          const index = landmarks[8];
          const middle = landmarks[12];

          // 1. PINCH-TO-ZOOM (Thumb + Index Distance)
          const pinchDistance = Math.hypot(index.x - thumb.x, index.y - thumb.y);
          const isPinching = Math.hypot(middle.x - index.x, middle.y - index.y) > 0.05;

          if (isPinching) {
            if (prevPinchDistRef.current !== null) {
              const deltaZoom = pinchDistance / prevPinchDistRef.current;
              if (Math.abs(1 - deltaZoom) > 0.02) {
                onZoom(deltaZoom);
              }
            }
            prevPinchDistRef.current = pinchDistance;
            prevPanPosRef.current = null;
            return;
          }

          // 2. FLAT-PALM PANNING (Index drag)
          if (prevPanPosRef.current !== null) {
            const deltaX = (index.x - prevPanPosRef.current.x) * -500;
            const deltaY = (index.y - prevPanPosRef.current.y) * 500;
            if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
              onPan(deltaX, deltaY);
            }
          }
          prevPanPosRef.current = { x: index.x, y: index.y };
          prevPinchDistRef.current = null;
        });

        handsInstance = hands;

        // 2. Connect camera stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: 30 },
        });
        if (destroyed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        video.srcObject = stream;
        await video.play();

        // 3. Process video frames
        const processFrames = () => {
          if (destroyed) return;
          if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            hands.send({ image: video }).catch(() => {});
          }
          rafIdRef.current = requestAnimationFrame(processFrames);
        };
        processFrames();
      } catch (err) {
        // Camera unavailable or denied — fails gracefully without disrupting clinical workflow
        console.debug('[PacsGestureLayer] Safe fallback:', err);
      }
    };

    bootstrap();

    return () => {
      destroyed = true;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      try {
        handsInstance?.close?.();
      } catch {}
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [onZoom, onPan]);

  return null;
}
