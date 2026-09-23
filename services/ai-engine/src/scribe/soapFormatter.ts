/**
 * MedCore SOAP Note Formatter
 * Converts unstructured clinical dictation into structured SOAP format
 */

export interface SOAPNote {
  subjective: {
    chiefComplaint: string;
    historyOfPresentingIllness: string;
    pastMedicalHistory: string;
    medications: string;
    allergies: string;
    socialHistory: string;
  };
  objective: {
    vitals: string;
    generalAppearance: string;
    systemicExamination: string;
    investigations: string;
  };
  assessment: {
    primaryDiagnosis: string;
    differentialDiagnoses: string;
    problemList: string;
  };
  plan: {
    investigations: string;
    medications: string;
    procedures: string;
    referrals: string;
    followUp: string;
    patientEducation: string;
  };
  generatedAt: string;
  confidence: number;  // 0-100
}

// Keyword patterns for section extraction
const SECTION_PATTERNS = {
  chiefComplaint:    /(?:complaints?\s+of|presenting\s+with|c\/o|complains?\s+of)\s+([^.]+)/i,
  hpi:               /(?:history\s+of|started|began|for\s+(?:the\s+)?(?:past|last))\s+([^.]+)/i,
  pmh:               /(?:past\s+(?:medical\s+)?history|known\s+(?:case|to\s+have)|background\s+of)\s*[:\-]?\s*([^.]+)/i,
  currentMeds:       /(?:currently\s+on|taking|on\s+(?:medications?|drugs?))\s*[:\-]?\s*([^.]+)/i,
  allergies:         /(?:allergies?|allergic\s+to|NKDA)\s*[:\-]?\s*([^.]+)/i,
  vitals:            /(?:vitals?|observations?|obs)\s*[:\-]?\s*([^.]+(?:\n[^.]+)*)/i,
  exam:              /(?:examination|on\s+examination|clinical\s+findings?)\s*[:\-]?\s*([^.]+)/i,
  plan:              /(?:plan|management|to\s+do|will)\s*[:\-]?\s*([^.]+)/i,
  diagnosis:         /(?:diagnosis|impression|assessment|working\s+diagnosis|diagnosed\s+with)\s*[:\-]?\s*([^.]+)/i,
  investigations:    /(?:investigations?|tests?|order|request)\s*[:\-]?\s*([^.]+)/i,
  medications:       /(?:medications?|prescribe|start|initiate|give)\s*[:\-]?\s*([^.]+)/i,
  referral:          /(?:refer|referral|consult)\s*[:\-]?\s*([^.]+)/i,
  followUp:          /(?:follow\s*up|review\s+in|return\s+in|RV\s+in)\s+([^.]+)/i,
};

function extract(text: string, pattern: RegExp): string {
  const m = text.match(pattern);
  return m ? m[1].trim().replace(/\n/g, ' ').substring(0, 300) : '';
}

/**
 * Format raw clinical text into structured SOAP note
 * Works offline — no LLM required. Can be upgraded with Gemini API.
 */
export function formatSOAP(rawText: string): SOAPNote {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // Extract mentions of common drugs for medication list
  const drugMentions: string[] = [];
  const commonDrugs = [
    'amoxicillin','metronidazole','artemether','lumefantrine','paracetamol','ibuprofen',
    'amlodipine','lisinopril','metformin','atorvastatin','omeprazole','azithromycin',
    'gentamicin','ceftriaxone','ciprofloxacin','diazepam','morphine','tramadol',
    'furosemide','spironolactone','hydralazine','nifedipine','methyldopa',
    'ferrous sulphate','folic acid','vitamin c','zinc',
  ];
  for (const drug of commonDrugs) {
    if (lower.includes(drug)) drugMentions.push(drug);
  }

  const chiefComplaint = extract(text, SECTION_PATTERNS.chiefComplaint)
    || text.split(/[.!?]/)[0].trim().substring(0, 150);

  const hpi = extract(text, SECTION_PATTERNS.hpi)
    || text.substring(0, 400);

  const vitals = extract(text, SECTION_PATTERNS.vitals)
    || 'Vitals as recorded in observation chart.';

  const diagnosis = extract(text, SECTION_PATTERNS.diagnosis)
    || 'Working diagnosis pending further evaluation.';

  const planText = extract(text, SECTION_PATTERNS.plan) || '';

  return {
    subjective: {
      chiefComplaint: chiefComplaint || 'As per presenting complaint.',
      historyOfPresentingIllness: hpi,
      pastMedicalHistory: extract(text, SECTION_PATTERNS.pmh) || 'Not documented.',
      medications: extract(text, SECTION_PATTERNS.currentMeds) || (drugMentions.length > 0 ? drugMentions.join(', ') : 'Nil regular medications.'),
      allergies: extract(text, SECTION_PATTERNS.allergies) || 'No known drug allergies (NKDA).',
      socialHistory: lower.includes('smok') ? 'Smoker.' : lower.includes('alcohol') ? 'Alcohol use noted.' : 'Not documented.',
    },
    objective: {
      vitals,
      generalAppearance: extract(text, SECTION_PATTERNS.exam).split('.')[0] || 'Patient assessed — general appearance as noted.',
      systemicExamination: extract(text, SECTION_PATTERNS.exam) || 'Systemic examination pending / as documented.',
      investigations: extract(text, SECTION_PATTERNS.investigations) || 'Results awaited.',
    },
    assessment: {
      primaryDiagnosis: diagnosis,
      differentialDiagnoses: 'Differentials to be reviewed with AI CDS.',
      problemList: [
        diagnosis,
        ...(lower.includes('hypertension') ? ['Hypertension'] : []),
        ...(lower.includes('diabetes') ? ['Diabetes mellitus'] : []),
        ...(lower.includes('sepsis') ? ['Sepsis (suspected)'] : []),
      ].join('; '),
    },
    plan: {
      investigations: extract(text, SECTION_PATTERNS.investigations) || planText || 'FBC, U&E, LFTs, urinalysis.',
      medications: drugMentions.length > 0
        ? `Prescribed: ${drugMentions.join(', ')}. Review EML compliance.`
        : extract(text, SECTION_PATTERNS.medications) || 'As prescribed.',
      procedures: lower.includes('iv') || lower.includes('cannula') ? 'IV access. IV fluids as ordered.' : 'None immediate.',
      referrals: extract(text, SECTION_PATTERNS.referral) || 'No immediate referrals.',
      followUp: extract(text, SECTION_PATTERNS.followUp) || 'Review in clinic or as clinically indicated.',
      patientEducation: lower.includes('explained') ? 'Diagnosis and plan explained to patient.' : 'Patient education provided.',
    },
    generatedAt: new Date().toISOString(),
    confidence: Math.min(95, 40 + (text.length > 200 ? 30 : 0) + (chiefComplaint.length > 10 ? 15 : 0) + (diagnosis.length > 10 ? 10 : 0)),
  };
}
