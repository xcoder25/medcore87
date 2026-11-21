'use client';

import React, { useMemo } from 'react';
import QRCode from 'qrcode';

export type QrErrorLevel = 'L' | 'M' | 'Q' | 'H';

export interface ScannableQrCodeProps {
  /** String encoded into ISO/IEC 18004 QR matrix */
  value: string;
  /** Rendered width and height in CSS pixels */
  size?: number;
  /** Error correction level (default M) */
  level?: QrErrorLevel;
  /** Dark module fill color */
  fgColor?: string;
  /** Light background color */
  bgColor?: string;
  /** Quiet zone in modules (ISO/IEC 18004 requires >= 4) */
  quietZone?: number;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

interface QrMatrixResult {
  totalModules: number;
  pathD: string;
}

function buildQrSvgPath(
  value: string,
  level: QrErrorLevel,
  quietZone: number
): QrMatrixResult {
  const safeVal = value && value.trim().length > 0 ? value : 'https://medcore.ng/verify';
  const qr = QRCode.create(safeVal, { errorCorrectionLevel: level });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const totalModules = size + quietZone * 2;

  const segments: string[] = [];
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      const idx = y * size + x;
      if (data[idx]) {
        const startX = x;
        while (x < size && data[y * size + x]) {
          x++;
        }
        const runLen = x - startX;
        segments.push(`M${startX + quietZone} ${y + quietZone}h${runLen}v1h-${runLen}z`);
      } else {
        x++;
      }
    }
  }

  return {
    totalModules,
    pathD: segments.join(''),
  };
}

/**
 * Renders a standards-compliant, ISO/IEC 18004 scannable QR code as crisp SVG
 * with a mandatory 4-module quiet zone so any phone camera or 2D scanner reads it reliably.
 */
export function ScannableQrCode({
  value,
  size = 112,
  level = 'M',
  fgColor = '#0F172A',
  bgColor = '#FFFFFF',
  quietZone = 4,
  className,
  style,
  ariaLabel = 'Scannable MedCore Verification QR Code',
}: ScannableQrCodeProps) {
  const { totalModules, pathD } = useMemo(
    () => buildQrSvgPath(value, level, quietZone),
    [value, level, quietZone]
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${totalModules} ${totalModules}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={ariaLabel}
      className={className}
      data-qr-scannable="true"
      data-qr-value={value}
      style={{
        display: 'block',
        background: bgColor,
        borderRadius: 6,
        flexShrink: 0,
        ...style,
      }}
    >
      <rect width={totalModules} height={totalModules} fill={bgColor} />
      <path d={pathD} fill={fgColor} />
    </svg>
  );
}

/**
 * Draws an identical ISO/IEC 18004 QR code directly onto a high-DPI HTML5 Canvas
 * (used for 300-DPI CR80 Health Card PNG exports).
 */
export function drawQrToCanvas(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  targetSizePx: number,
  options?: {
    level?: QrErrorLevel;
    fgColor?: string;
    bgColor?: string;
    quietZone?: number;
  }
): void {
  const level = options?.level || 'M';
  const fgColor = options?.fgColor || '#0F172A';
  const bgColor = options?.bgColor || '#FFFFFF';
  const quietZone = options?.quietZone ?? 4;

  const safeVal = value && value.trim().length > 0 ? value : 'https://medcore.ng/verify';
  const qr = QRCode.create(safeVal, { errorCorrectionLevel: level });
  const modules = qr.modules.size;
  const data = qr.modules.data;
  const totalModules = modules + quietZone * 2;
  const cell = targetSizePx / totalModules;

  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, targetSizePx, targetSizePx);

  ctx.fillStyle = fgColor;
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (data[row * modules + col]) {
        const rx = Math.floor(x + (col + quietZone) * cell);
        const ry = Math.floor(y + (row + quietZone) * cell);
        const rw = Math.ceil(x + (col + quietZone + 1) * cell) - rx;
        const rh = Math.ceil(y + (row + quietZone + 1) * cell) - ry;
        ctx.fillRect(rx, ry, rw, rh);
      }
    }
  }
  ctx.restore();
}

export default ScannableQrCode;
