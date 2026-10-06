/** Parse free-text Rx notes into structured SIG fields */
export interface ParsedSig {
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
}

export function parseRxNotes(notes?: string, drugName?: string): ParsedSig {
  const n = notes || '';
  const dose =
    (n.match(/Dose:\s*([^·]+)/i) || [])[1]?.trim() ||
    (drugName?.match(/(\d+\s*mg|\d+\s*ml|\d+\/\d+)/i) || [])[0] ||
    'As ordered';
  const frequency =
    (n.match(/Freq:\s*([^·]+)/i) || [])[1]?.trim() ||
    (n.match(/(once|twice|thrice|three times|daily|bd|tds|qds|nocte|mane)/i) || [])[0] ||
    'As directed';
  const route =
    (n.match(/Route:\s*([^·]+)/i) || [])[1]?.trim() ||
    (n.match(/\b(oral|po|iv|im|sc|topical|inh)\b/i) || [])[0] ||
    'PO';
  const duration =
    (n.match(/Duration:\s*([^·]+)/i) || [])[1]?.trim() ||
    (n.match(/(\d+\s*days?|\d+\s*weeks?)/i) || [])[0] ||
    'As ordered';
  return {
    dose: dose.trim(),
    frequency: frequency.trim(),
    route: route.trim().toUpperCase() === 'ORAL' ? 'PO' : route.trim(),
    duration: duration.trim(),
    instructions: n || 'Follow prescriber instructions',
  };
}
