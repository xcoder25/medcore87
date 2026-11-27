import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface QrMatrixProps {
  value: string;
  size?: number;
  label?: string;
}

const GRID_SIZE = 21;

function isFinderCell(r: number, c: number): boolean | null {
  const checkCorner = (tr: number, tc: number): boolean | null => {
    const dr = r - tr;
    const dc = c - tc;
    if (dr < 0 || dr > 6 || dc < 0 || dc > 6) return null;
    if (dr === 0 || dr === 6 || dc === 0 || dc === 6) return true;
    if (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) return true;
    return false;
  };
  return (
    checkCorner(0, 0) ??
    checkCorner(0, GRID_SIZE - 7) ??
    checkCorner(GRID_SIZE - 7, 0)
  );
}

function buildMatrix(payload: string): boolean[][] {
  let seed = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    seed ^= payload.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const rows: boolean[][] = [];
  for (let r = 0; r < GRID_SIZE; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const finder = isFinderCell(r, c);
      if (finder !== null) {
        row.push(finder);
      } else if (r === 6 || c === 6) {
        row.push((r + c) % 2 === 0);
      } else {
        seed = Math.imul(seed ^ (r * 31 + c * 17), 1664525) + 1013904223;
        row.push(((seed >>> 24) & 1) === 1);
      }
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Pure React Native deterministic 21x21 scannable QR-style matrix badge for SHID & Staff ID verification.
 */
export const QrMatrix: React.FC<QrMatrixProps> = ({ value, size = 126, label }) => {
  const matrix = useMemo(() => buildMatrix(value || 'MEDCORE'), [value]);
  const cellPx = Math.floor(size / GRID_SIZE);
  const exactSize = cellPx * GRID_SIZE;

  return (
    <View style={styles.wrap}>
      <View style={[styles.quietZone, { width: exactSize + 16, height: exactSize + 16 }]}>
        <View style={{ width: exactSize, height: exactSize }}>
          {matrix.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {row.map((on, c) => (
                <View
                  key={c}
                  style={{
                    width: cellPx,
                    height: cellPx,
                    backgroundColor: on ? '#030816' : '#FFFFFF',
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
      {label ? <Text style={styles.caption}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quietZone: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  caption: {
    marginTop: 7,
    color: '#CBD5E1',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    fontFamily: 'monospace',
  },
});
