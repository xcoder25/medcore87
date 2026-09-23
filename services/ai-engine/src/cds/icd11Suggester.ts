/**
 * MedCore ICD-11 Suggester
 * Fuzzy text search against local ICD-11 linearization table
 */

import lookup from '../data/icd11-lookup.json';

interface ICD11Entry {
  code: string;
  title: string;
  synonyms: string[];
}

export interface ICD11Match {
  code: string;
  title: string;
  score: number;  // 0-100 relevance
}

const db = lookup as ICD11Entry[];

function similarity(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 75;
  if (q.includes(t)) return 65;
  // Partial word match
  const queryWords = q.split(/\s+/);
  const textWords  = t.split(/[\s,()\/]+/);
  const matches = queryWords.filter(w => w.length > 2 && textWords.some(tw => tw.includes(w) || w.includes(tw)));
  return matches.length > 0 ? Math.min(60, Math.round((matches.length / queryWords.length) * 60)) : 0;
}

export function searchICD11(query: string, limit = 8): ICD11Match[] {
  if (!query || query.trim().length < 2) return [];

  const results: ICD11Match[] = [];

  for (const entry of db) {
    let best = similarity(query, entry.title);
    best = Math.max(best, similarity(query, entry.code));
    for (const syn of entry.synonyms) {
      best = Math.max(best, similarity(query, syn));
    }

    if (best >= 30) {
      results.push({ code: entry.code, title: entry.title, score: best });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get full entry by code
 */
export function getICD11ByCode(code: string): ICD11Entry | undefined {
  return db.find(e => e.code.toUpperCase() === code.toUpperCase());
}
