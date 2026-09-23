import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  TextInput,
  Animated,
  Easing,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const patLogo = require('./assets/patmedcore.png');
const ariseLogo = require('./assets/arise_logo.png');
const heroBgImg = require('./assets/hero_bg.jpg');
const doctorMaleImg = require('./assets/doctor_male.jpg');
const doctorFemaleImg = require('./assets/doctor_female.jpg');
const hospitalHeroImg = require('./assets/hospital_hero.jpg');

export type AppStage = 'splash1' | 'splash2' | 'auth' | 'main';
export type AuthSheetMode = 'none' | 'login' | 'signup';
export type TabType = 'home' | 'appointments' | 'health' | 'records' | 'profile';
export type Language = 'EN' | 'AR' | 'ES' | 'FR';

export type SubView =
  | 'none'
  | 'bookStep1'
  | 'bookStep2'
  | 'bookSuccess'
  | 'prescriptions'
  | 'labResults'
  | 'notifications'
  | 'settings'
  | 'personalInfo'
  | 'medicalHistory'
  | 'chat'
  | 'referrals'
  // Phase 1
  | 'emergency'
  | 'healthCard'
  | 'billing'
  | 'medReminders'
  // Phase 2
  | 'vitals'
  | 'feedback'
  | 'tourismHub'
  | 'immunization'
  // Phase 3
  | 'family'
  | 'mentalHealth'
  | 'healthEdu';

export interface DoctorInfo {
  id: string;
  name: string;
  specialty: string;
  category: 'General Practice' | 'Cardiologist' | 'Pediatrician' | 'Dermatologist';
  facility: string;
  facilityCode: string;
  nextDate: string;
  rating: string;
  initials: string;
  avatarColor: string;
  photo: 'male' | 'female';
}

export const AVAILABLE_DOCTORS: DoctorInfo[] = [
  {
    id: '1',
    name: 'Dr. James Okafor',
    specialty: 'General Practitioner',
    category: 'General Practice',
    facility: 'General Hospital Abak',
    facilityCode: 'ABK-001',
    nextDate: 'Mon, 9 Sep 2025',
    rating: '4.9',
    initials: 'JO',
    avatarColor: '#0284C7',
    photo: 'male',
  },
  {
    id: '2',
    name: 'Dr. Sarah Bello',
    specialty: 'Cardiologist',
    category: 'Cardiologist',
    facility: 'Ibom Specialist Hospital',
    facilityCode: 'UYO-002',
    nextDate: 'Fri, 13 Sep 2025',
    rating: '4.8',
    initials: 'SB',
    avatarColor: '#E11D48',
    photo: 'female',
  },
  {
    id: '3',
    name: 'Dr. Daniel Musa',
    specialty: 'Pediatrician',
    category: 'Pediatrician',
    facility: 'Immanuel General Hospital',
    facilityCode: 'EKT-001',
    nextDate: 'Tue, 17 Sep 2025',
    rating: '4.9',
    initials: 'DM',
    avatarColor: '#10B981',
    photo: 'male',
  },
  {
    id: '4',
    name: 'Dr. Amina Yusuf',
    specialty: 'Dermatologist',
    category: 'Dermatologist',
    facility: 'General Hospital Ikot Ekpene',
    facilityCode: 'IKE-001',
    nextDate: 'Thu, 19 Sep 2025',
    rating: '4.7',
    initials: 'AY',
    avatarColor: '#8B5CF6',
    photo: 'female',
  },
];

interface Message {
  id: string;
  sender: 'doctor' | 'patient';
  text: string;
  time: string;
}

export interface HospitalFacility {
  code: string;
  name: string;
  lga: string;
  tier: 'General Hospital' | 'Cottage Hospital' | 'Specialist Hospital' | 'Teaching Hospital';
  rating: string;
}

// Akwa Ibom State Hospital Directory: Arranged alphabetically by LGA starting from Abak
export const AKWA_IBOM_HOSPITALS: HospitalFacility[] = [
  { code: 'ABK-001', name: 'General Hospital Abak', lga: 'Abak', tier: 'General Hospital', rating: '4.8' },
  { code: 'ABK-002', name: 'Cottage Hospital Midim', lga: 'Abak', tier: 'Cottage Hospital', rating: '4.6' },
  { code: 'ABK-003', name: "St. Theresa's Catholic Hospital Abak", lga: 'Abak', tier: 'General Hospital', rating: '4.5' },
  { code: 'EBO-001', name: 'Cottage Hospital Okoroete', lga: 'Eastern Obolo', tier: 'Cottage Hospital', rating: '4.4' },
  { code: 'EKT-001', name: 'Immanuel General Hospital', lga: 'Eket', tier: 'General Hospital', rating: '4.9' },
  { code: 'EKT-002', name: 'Cottage Hospital Ikot Eket', lga: 'Eket', tier: 'Cottage Hospital', rating: '4.5' },
  { code: 'ESE-001', name: 'Cottage Hospital Uquo', lga: 'Esit Eket', tier: 'Cottage Hospital', rating: '4.4' },
  { code: 'ESU-001', name: 'General Hospital Ikpe Annang', lga: 'Essien Udim', tier: 'General Hospital', rating: '4.7' },
  { code: 'ESU-002', name: 'Cottage Hospital Ukana', lga: 'Essien Udim', tier: 'Cottage Hospital', rating: '4.8' },
  { code: 'ETE-001', name: 'General Hospital Utu Etim Ekpo', lga: 'Etim Ekpo', tier: 'General Hospital', rating: '4.5' },
  { code: 'ETN-001', name: 'General Hospital Etinan', lga: 'Etinan', tier: 'General Hospital', rating: '4.7' },
  { code: 'IBN-001', name: 'Cottage Hospital Ibeno', lga: 'Ibeno', tier: 'Cottage Hospital', rating: '4.6' },
  { code: 'IBA-001', name: 'General Hospital Asutan', lga: 'Ibesikpo Asutan', tier: 'General Hospital', rating: '4.6' },
  { code: 'IBI-001', name: 'General Hospital Ibiono Ibom', lga: 'Ibiono Ibom', tier: 'General Hospital', rating: '4.5' },
  { code: 'IKA-001', name: 'Cottage Hospital Ika', lga: 'Ika', tier: 'Cottage Hospital', rating: '4.4' },
  { code: 'IKO-001', name: 'General Hospital Ibiaku Ntok Okpo', lga: 'Ikono', tier: 'General Hospital', rating: '4.6' },
  { code: 'IKT-001', name: 'General Hospital Ikot Abasi', lga: 'Ikot Abasi', tier: 'General Hospital', rating: '4.7' },
  { code: 'IKE-001', name: 'General Hospital Ikot Ekpene', lga: 'Ikot Ekpene', tier: 'General Hospital', rating: '4.9' },
  { code: 'INI-001', name: 'Cottage Hospital Odoro Ikpe', lga: 'Ini', tier: 'Cottage Hospital', rating: '4.5' },
  { code: 'ITU-001', name: 'Mary Slessor Hospital Itu', lga: 'Itu', tier: 'General Hospital', rating: '4.8' },
  { code: 'MBO-001', name: 'Cottage Hospital Enwang', lga: 'Mbo', tier: 'Cottage Hospital', rating: '4.4' },
  { code: 'MKE-001', name: 'General Hospital Mkpat Enin', lga: 'Mkpat Enin', tier: 'General Hospital', rating: '4.6' },
  { code: 'NSA-001', name: 'Cottage Hospital Odot', lga: 'Nsit Atai', tier: 'Cottage Hospital', rating: '4.4' },
  { code: 'NSI-001', name: 'Cottage Hospital Afaha Offiong', lga: 'Nsit Ibom', tier: 'Cottage Hospital', rating: '4.5' },
  { code: 'NSU-001', name: 'Cottage Hospital Ikot Ebak', lga: 'Nsit Ubium', tier: 'Cottage Hospital', rating: '4.5' },
  { code: 'OBA-001', name: 'General Hospital Nto Edino', lga: 'Obot Akara', tier: 'General Hospital', rating: '4.6' },
  { code: 'OKO-001', name: 'General Hospital Amamong', lga: 'Okobo', tier: 'General Hospital', rating: '4.5' },
  { code: 'ONN-001', name: 'General Hospital Awa', lga: 'Onna', tier: 'General Hospital', rating: '4.8' },
  { code: 'ORO-001', name: 'General Hospital Oron', lga: 'Oron', tier: 'General Hospital', rating: '4.7' },
  { code: 'ORA-001', name: 'General Hospital Ikot Okoro', lga: 'Oruk Anam', tier: 'General Hospital', rating: '4.6' },
  { code: 'UDU-001', name: 'Cottage Hospital Udung Uko', lga: 'Udung Uko', tier: 'Cottage Hospital', rating: '4.4' },
  { code: 'UKF-001', name: 'General Hospital Ikot Akpa Nkuk', lga: 'Ukanafun', tier: 'General Hospital', rating: '4.6' },
  { code: 'URU-001', name: 'Methodist Hospital Ituk Mbang', lga: 'Uruan', tier: 'General Hospital', rating: '4.8' },
  { code: 'URO-001', name: 'Cottage Hospital Urue Offong', lga: 'Urue Offong/Oruko', tier: 'Cottage Hospital', rating: '4.4' },
  { code: 'UYO-001', name: 'University of Uyo Teaching Hospital (UUTH)', lga: 'Uyo', tier: 'Teaching Hospital', rating: '4.9' },
  { code: 'UYO-002', name: 'Ibom Specialist Hospital Uyo', lga: 'Uyo', tier: 'Specialist Hospital', rating: '4.9' },
  { code: 'UYO-003', name: "St. Luke's Hospital Anua-Uyo", lga: 'Uyo', tier: 'General Hospital', rating: '4.7' },
];

// All 31 Akwa Ibom LGAs listed alphabetically
export const AKS_LGAS: string[] = [
  'Abak',
  'Eastern Obolo',
  'Eket',
  'Esit Eket',
  'Essien Udim',
  'Etim Ekpo',
  'Etinan',
  'Ibeno',
  'Ibesikpo Asutan',
  'Ibiono Ibom',
  'Ika',
  'Ikono',
  'Ikot Abasi',
  'Ikot Ekpene',
  'Ini',
  'Itu',
  'Mbo',
  'Mkpat Enin',
  'Nsit Atai',
  'Nsit Ibom',
  'Nsit Ubium',
  'Obot Akara',
  'Okobo',
  'Onna',
  'Oron',
  'Oruk Anam',
  'Udung Uko',
  'Ukanafun',
  'Uruan',
  'Urue Offong/Oruko',
  'Uyo',
];

// =========================================================================
// OFFICIAL CLINICAL DIAGNOSTIC REPORTS DATASET (Openable Medical Documents)
// =========================================================================
export interface DiagnosticParameter {
  name: string;
  value: string;
  unit: string;
  refRange: string;
  status: 'Normal' | 'Optimal' | 'Desirable' | 'Normal Limits';
}

export interface DiagnosticReport {
  id: string;
  testCode: string;
  title: string;
  category: string;
  date: string;
  time: string;
  facility: string;
  facilityCode: string;
  orderingDoctor: string;
  labDirector: string;
  specimen: string;
  accessionNumber: string;
  status: 'Normal' | 'Optimal' | 'Verified';
  clinicalSummary: string;
  parameters: DiagnosticParameter[];
}

export const DIAGNOSTIC_REPORTS: DiagnosticReport[] = [
  {
    id: 'cbc-001',
    testCode: 'CBC-5DIFF',
    title: 'Complete Blood Count (CBC) with 5-Part Differential',
    category: 'Clinical Hematology',
    date: '5 Aug 2025',
    time: '08:15 AM',
    facility: 'General Hospital Abak (ABK-001) • Pathology Lab Unit',
    facilityCode: 'ABK-001',
    orderingDoctor: 'Dr. James Okafor, MBBS, FMCP (MDC-7741)',
    labDirector: 'Dr. K. N. Akpabio, MBBS, FMCPath (Chief Pathologist)',
    specimen: 'Whole Blood (K2-EDTA Anticoagulated)',
    accessionNumber: 'ABK-LAB-2025-08892',
    status: 'Normal',
    clinicalSummary:
      'Normal complete blood profile. Erythrocytic indices (MCV, MCH, MCHC) demonstrate normocytic, normochromic RBCs. White blood cell count and differential distribution are within healthy physiological limits. Platelet count adequate with normal morphological distribution. No evidence of cytopenia, infection, or anemia.',
    parameters: [
      { name: 'White Blood Cell Count (WBC)', value: '6.4', unit: '×10^9/L', refRange: '4.0 – 11.0', status: 'Normal' },
      { name: 'Red Blood Cell Count (RBC)', value: '4.52', unit: '×10^12/L', refRange: '4.0 – 5.2', status: 'Normal' },
      { name: 'Hemoglobin (Hb)', value: '13.8', unit: 'g/dL', refRange: '12.0 – 16.0', status: 'Normal' },
      { name: 'Hematocrit / PCV', value: '41.2', unit: '%', refRange: '36.0 – 46.0', status: 'Normal' },
      { name: 'Platelet Count (PLT)', value: '248', unit: '×10^9/L', refRange: '150 – 450', status: 'Normal' },
      { name: 'Mean Corpuscular Volume (MCV)', value: '89.5', unit: 'fL', refRange: '80.0 – 100.0', status: 'Normal' },
      { name: 'Mean Corpuscular Hemoglobin (MCH)', value: '30.5', unit: 'pg', refRange: '27.0 – 33.0', status: 'Normal' },
      { name: 'Neutrophils', value: '58.4', unit: '%', refRange: '40.0 – 75.0', status: 'Normal' },
      { name: 'Lymphocytes', value: '32.6', unit: '%', refRange: '20.0 – 45.0', status: 'Normal' },
      { name: 'Monocytes', value: '6.2', unit: '%', refRange: '2.0 – 10.0', status: 'Normal' },
      { name: 'Eosinophils', value: '2.4', unit: '%', refRange: '1.0 – 6.0', status: 'Normal' },
      { name: 'Basophils', value: '0.4', unit: '%', refRange: '0.0 – 1.0', status: 'Normal' },
    ],
  },
  {
    id: 'fbs-002',
    testCode: 'FBS-METAB',
    title: 'Fasting Blood Sugar (FBS) & Glycemic Panel',
    category: 'Clinical Biochemistry',
    date: '5 Aug 2025',
    time: '08:15 AM',
    facility: 'General Hospital Abak (ABK-001) • Biochemistry Section',
    facilityCode: 'ABK-001',
    orderingDoctor: 'Dr. James Okafor, MBBS, FMCP (MDC-7741)',
    labDirector: 'Dr. K. N. Akpabio, MBBS, FMCPath (Chief Pathologist)',
    specimen: 'Fluoride Oxalate Plasma (10-hr Overnight Fast)',
    accessionNumber: 'ABK-LAB-2025-08893',
    status: 'Optimal',
    clinicalSummary:
      'Glycemic status is well-regulated and within optimal non-diabetic range. Fasting plasma glucose of 5.2 mmol/L is well within normal clinical threshold. HbA1c of 5.4% indicates optimal long-term glucose homeostasis with low estimated 10-year cardiometabolic risk.',
    parameters: [
      { name: 'Fasting Plasma Glucose (FBS)', value: '5.2', unit: 'mmol/L', refRange: '3.9 – 5.6', status: 'Optimal' },
      { name: 'Glycated Hemoglobin (HbA1c)', value: '5.4', unit: '%', refRange: '< 5.7', status: 'Optimal' },
      { name: 'Estimated Avg Glucose (eAG)', value: '5.8', unit: 'mmol/L', refRange: '3.8 – 6.5', status: 'Normal' },
      { name: 'Fasting Serum Insulin', value: '7.8', unit: 'µIU/mL', refRange: '2.6 – 24.9', status: 'Normal' },
      { name: 'HOMA-IR (Insulin Resistance)', value: '1.8', unit: 'index', refRange: '< 2.5', status: 'Optimal' },
    ],
  },
  {
    id: 'lipid-003',
    testCode: 'LIPID-FULL',
    title: 'Comprehensive Serum Lipid Profile & Risk Index',
    category: 'Clinical Biochemistry',
    date: '20 Jun 2025',
    time: '08:30 AM',
    facility: 'General Hospital Abak (ABK-001) • Biochemistry Section',
    facilityCode: 'ABK-001',
    orderingDoctor: 'Dr. Sarah Bello, FWACS (MDC-9921)',
    labDirector: 'Dr. K. N. Akpabio, MBBS, FMCPath (Chief Pathologist)',
    specimen: 'Fasting Serum (12-hr Overnight Fast)',
    accessionNumber: 'ABK-LAB-2025-06741',
    status: 'Normal',
    clinicalSummary:
      'Favorable lipid and atherogenic risk profile. Total cholesterol-to-HDL ratio is optimal at 3.2. Serum triglycerides and low-density lipoprotein levels meet desirable targets for primary cardiovascular prevention.',
    parameters: [
      { name: 'Total Cholesterol', value: '4.6', unit: 'mmol/L', refRange: '< 5.2', status: 'Desirable' },
      { name: 'HDL Cholesterol (Protective)', value: '1.42', unit: 'mmol/L', refRange: '> 1.20', status: 'Optimal' },
      { name: 'LDL Cholesterol (Calculated)', value: '2.48', unit: 'mmol/L', refRange: '< 3.36', status: 'Optimal' },
      { name: 'Serum Triglycerides', value: '1.24', unit: 'mmol/L', refRange: '< 1.70', status: 'Normal' },
      { name: 'Non-HDL Cholesterol', value: '3.18', unit: 'mmol/L', refRange: '< 3.80', status: 'Desirable' },
      { name: 'Total Chol / HDL Ratio', value: '3.2', unit: 'ratio', refRange: '< 4.5', status: 'Optimal' },
    ],
  },
  {
    id: 'urine-004',
    testCode: 'URINE-ANALYSIS',
    title: 'Automated & Microscopic Urinalysis Diagnostic Examination',
    category: 'Clinical Pathology',
    date: '3 Apr 2025',
    time: '09:10 AM',
    facility: 'General Hospital Abak (ABK-001) • Pathology Lab Unit',
    facilityCode: 'ABK-001',
    orderingDoctor: 'Dr. James Okafor, MBBS, FMCP (MDC-7741)',
    labDirector: 'Dr. K. N. Akpabio, MBBS, FMCPath (Chief Pathologist)',
    specimen: 'Mid-stream Clean Catch Urine (10mL)',
    accessionNumber: 'ABK-LAB-2025-04109',
    status: 'Normal',
    clinicalSummary:
      'Urinalysis examination is completely normal. No evidence of proteinuria, microhematuria, glucosuria, or bacteriuria. Urine concentration, pH, and sediment analysis demonstrate healthy renal tubule function and intact urinary tract barriers.',
    parameters: [
      { name: 'Color & Clarity', value: 'Straw / Clear', unit: 'Visual', refRange: 'Clear', status: 'Normal' },
      { name: 'Specific Gravity', value: '1.018', unit: '—', refRange: '1.005 – 1.030', status: 'Normal' },
      { name: 'pH', value: '6.2', unit: 'pH', refRange: '4.5 – 8.0', status: 'Normal' },
      { name: 'Protein', value: 'Negative', unit: 'mg/dL', refRange: 'Negative', status: 'Normal' },
      { name: 'Glucose', value: 'Negative', unit: 'mg/dL', refRange: 'Negative', status: 'Normal' },
      { name: 'Ketones & Nitrite', value: 'Negative', unit: '—', refRange: 'Negative', status: 'Normal' },
      { name: 'Leukocyte Esterase', value: 'Negative', unit: '—', refRange: 'Negative', status: 'Normal' },
      { name: 'Microscopic RBC', value: '0 – 1', unit: '/HPF', refRange: '0 – 3', status: 'Normal' },
      { name: 'Microscopic WBC', value: '1 – 2', unit: '/HPF', refRange: '0 – 5', status: 'Normal' },
      { name: 'Epithelial Cells', value: 'Rare', unit: '/HPF', refRange: 'Occasional', status: 'Normal' },
    ],
  },
  {
    id: 'xray-005',
    testCode: 'RAD-CXR-PA',
    title: 'Digital Chest Radiograph (PA View) Diagnostic Report',
    category: 'Diagnostic Imaging & Radiology',
    date: '28 Jun 2025',
    time: '10:15 AM',
    facility: 'General Hospital Abak (ABK-001) • Radiology Unit',
    facilityCode: 'ABK-001',
    orderingDoctor: 'Dr. Sarah Bello, FWACS (MDC-9921)',
    labDirector: 'Dr. Sarah Bello, FWACS (Consultant Radiologist)',
    specimen: 'Digital DICOM / High-Frequency PACS Radiography',
    accessionNumber: 'ABK-RAD-2025-01824',
    status: 'Normal',
    clinicalSummary:
      'Clear lung parenchymal fields bilaterally with normal vascular markings. Cardiothoracic ratio is normal (0.44). Both costophrenic angles and hemidiaphragms are sharp. Normal mediastinal contour and hilar vessels. No active pleuropulmonary disease or acute bony abnormalities.',
    parameters: [
      { name: 'Bilateral Lung Fields', value: 'Clear & Aerated', unit: 'DICOM', refRange: 'No Infiltrates', status: 'Normal Limits' },
      { name: 'Cardiothoracic Ratio (CTR)', value: '0.44', unit: 'ratio', refRange: '< 0.50', status: 'Normal' },
      { name: 'Costophrenic Angles', value: 'Sharp & Free', unit: 'Visual', refRange: 'No Effusion', status: 'Normal' },
      { name: 'Mediastinum & Trachea', value: 'Central / Normal', unit: 'Anatomic', refRange: 'Normal', status: 'Normal' },
      { name: 'Hilar Architecture', value: 'Normal Density', unit: 'Anatomic', refRange: 'Normal', status: 'Normal' },
      { name: 'Thoracic Cage & Ribs', value: 'Intact & Symmetrical', unit: 'Visual', refRange: 'Intact', status: 'Normal' },
    ],
  },
  {
    id: 'consult-006',
    testCode: 'ENC-CONSULT',
    title: 'Clinical Consultation Summary & Encounter Note',
    category: 'Clinical Consultation',
    date: '9 Sep 2025',
    time: '09:30 AM',
    facility: 'General Hospital Abak (ABK-001) • Outpatient Clinic',
    facilityCode: 'ABK-001',
    orderingDoctor: 'Dr. James Okafor, MBBS, FMCP (MDC-7741)',
    labDirector: 'Dr. James Okafor (Consultant Family Physician)',
    specimen: 'Clinical Chart Encounter (ABK-ENC-2025-09091)',
    accessionNumber: 'ABK-ENC-2025-09091',
    status: 'Normal',
    clinicalSummary:
      'Routine annual adult wellness consultation. Physical examination reveals normal cardiovascular and respiratory systems. Resting blood pressure is well-controlled at 118/76 mmHg. Fasting blood glucose is 5.2 mmol/L. Pre-visit checklist verified. Continued on maintenance lifestyle counseling with next routine follow-up in 6 months.',
    parameters: [
      { name: 'Blood Pressure (BP)', value: '118/76', unit: 'mmHg', refRange: '< 120/80', status: 'Normal' },
      { name: 'Resting Heart Rate', value: '74', unit: 'bpm', refRange: '60 – 100', status: 'Normal' },
      { name: 'Body Mass Index (BMI)', value: '22.8', unit: 'kg/m²', refRange: '18.5 – 24.9', status: 'Optimal' },
      { name: 'Respiratory Rate', value: '16', unit: 'breaths/min', refRange: '12 – 20', status: 'Normal' },
      { name: 'Body Temperature', value: '36.6', unit: '°C', refRange: '36.1 – 37.2', status: 'Normal' },
      { name: 'Oxygen Saturation (SpO2)', value: '99', unit: '%', refRange: '95 – 100', status: 'Normal' },
    ],
  },
];

// =========================================================================
// MODERN VECTOR ICON SYSTEM (Bespoke Native Micro-Glyphs - No basic emojis)
// =========================================================================
export const IconHome = ({ size = 20, color = '#0066FF' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: size * 0.44,
        borderRightWidth: size * 0.44,
        borderBottomWidth: size * 0.38,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      }}
    />
    <View
      style={{
        width: size * 0.62,
        height: size * 0.44,
        backgroundColor: color,
        borderBottomLeftRadius: 3,
        borderBottomRightRadius: 3,
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: -1,
      }}
    >
      <View style={{ width: size * 0.22, height: size * 0.26, backgroundColor: '#FFFFFF', borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
    </View>
  </View>
);

export const IconCalendar = ({ size = 20, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size * 1.05, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: size * 0.6, marginBottom: -2, zIndex: 2 }}>
      <View style={{ width: 2.2, height: 4, borderRadius: 1, backgroundColor: color }} />
      <View style={{ width: 2.2, height: 4, borderRadius: 1, backgroundColor: color }} />
    </View>
    <View
      style={{
        width: size * 0.88,
        height: size * 0.82,
        borderRadius: 4,
        borderWidth: 1.8,
        borderColor: color,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: '100%', height: size * 0.24, backgroundColor: color }} />
      <View style={{ flex: 1, padding: 2, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', alignItems: 'center' }}>
        <View style={{ width: 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: color }} />
        <View style={{ width: 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: color }} />
        <View style={{ width: 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: color }} />
        <View style={{ width: 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: color }} />
        <View style={{ width: 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: color }} />
        <View style={{ width: 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: color }} />
      </View>
    </View>
  </View>
);

export const IconDocument = ({ size = 20, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size * 0.78,
      height: size,
      borderRadius: 3.5,
      borderWidth: 1.8,
      borderColor: color,
      paddingHorizontal: 3,
      paddingVertical: 3.5,
      justifyContent: 'space-around',
    }}
  >
    <View style={{ width: '82%', height: 1.8, borderRadius: 1, backgroundColor: color }} />
    <View style={{ width: '60%', height: 1.8, borderRadius: 1, backgroundColor: color }} />
    <View style={{ width: '74%', height: 1.8, borderRadius: 1, backgroundColor: color }} />
  </View>
);

export const IconUser = ({ size = 20, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21, backgroundColor: color, marginBottom: 2 }} />
    <View style={{ width: size * 0.8, height: size * 0.4, borderTopLeftRadius: size * 0.4, borderTopRightRadius: size * 0.4, backgroundColor: color }} />
  </View>
);

export const IconBell = ({ size = 20, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 3, height: 2.5, borderRadius: 1.5, backgroundColor: color, marginBottom: -1 }} />
    <View
      style={{
        width: size * 0.65,
        height: size * 0.55,
        borderTopLeftRadius: size * 0.35,
        borderTopRightRadius: size * 0.35,
        backgroundColor: color,
      }}
    />
    <View style={{ width: size * 0.85, height: 2.5, borderRadius: 1.2, backgroundColor: color, marginTop: -0.5 }} />
    <View style={{ width: size * 0.22, height: size * 0.18, borderBottomLeftRadius: size * 0.11, borderBottomRightRadius: size * 0.11, backgroundColor: color, marginTop: 0.5 }} />
  </View>
);

export const IconPill = ({ size = 20, color = '#F97316' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size * 1.1,
      height: size * 0.52,
      borderRadius: size * 0.26,
      borderWidth: 1.8,
      borderColor: color,
      flexDirection: 'row',
      overflow: 'hidden',
      transform: [{ rotate: '-35deg' }],
    }}
  >
    <View style={{ flex: 1, backgroundColor: color }} />
    <View style={{ flex: 1, backgroundColor: 'transparent' }} />
  </View>
);

export const IconFlask = ({ size = 20, color = '#0284C7' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: size * 0.35, height: 2, borderRadius: 1, backgroundColor: color }} />
    <View style={{ width: size * 0.2, height: size * 0.26, backgroundColor: color }} />
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: size * 0.42,
        borderRightWidth: size * 0.42,
        borderBottomWidth: size * 0.52,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
        borderBottomLeftRadius: 5,
        borderBottomRightRadius: 5,
        marginTop: -2,
      }}
    />
  </View>
);

export const IconLeaf = ({ size = 20, color = '#16A34A' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size * 0.85,
      height: size * 0.85,
      borderTopLeftRadius: size * 0.85,
      borderBottomRightRadius: size * 0.85,
      borderTopRightRadius: size * 0.1,
      borderBottomLeftRadius: size * 0.1,
      backgroundColor: color,
      transform: [{ rotate: '45deg' }],
    }}
  />
);

export const IconSearch = ({ size = 18, color = '#64748B' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, position: 'relative' }}>
    <View
      style={{
        width: size * 0.68,
        height: size * 0.68,
        borderRadius: size * 0.34,
        borderWidth: 2,
        borderColor: color,
      }}
    />
    <View
      style={{
        width: 2.2,
        height: size * 0.44,
        backgroundColor: color,
        borderRadius: 1.1,
        position: 'absolute',
        bottom: 0,
        right: 1,
        transform: [{ rotate: '-45deg' }],
      }}
    />
  </View>
);

export const IconGear = ({ size = 20, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: size * 0.9, height: size * 0.9, borderRadius: size * 0.45, borderWidth: 3.5, borderColor: color, borderStyle: 'dotted' }} />
    <View style={{ width: size * 0.38, height: size * 0.38, borderRadius: size * 0.19, backgroundColor: color, position: 'absolute' }} />
  </View>
);

export const IconShield = ({ size = 20, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size * 0.8,
      height: size * 0.92,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      borderBottomLeftRadius: size * 0.4,
      borderBottomRightRadius: size * 0.4,
      borderWidth: 2,
      borderColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <View style={{ width: 3, height: 5, borderRadius: 1.5, backgroundColor: color }} />
  </View>
);

export const IconMoon = ({ size = 20, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size * 0.85,
      height: size * 0.85,
      borderRadius: size * 0.425,
      backgroundColor: color,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <View
      style={{
        width: size * 0.7,
        height: size * 0.7,
        borderRadius: size * 0.35,
        backgroundColor: '#FFFFFF',
        position: 'absolute',
        top: -2,
        right: -2,
      }}
    />
  </View>
);

export const IconGlobe = ({ size = 20, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1.8,
      borderColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <View style={{ width: '100%', height: 1.5, backgroundColor: color }} />
    <View
      style={{
        width: size * 0.52,
        height: size,
        borderRadius: size * 0.26,
        borderWidth: 1.5,
        borderColor: color,
        position: 'absolute',
      }}
    />
  </View>
);

export const IconFingerprint = ({ size = 20, color = '#0066FF' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: size * 0.88, height: size * 0.92, borderRadius: size * 0.45, borderWidth: 1.8, borderColor: color, borderBottomColor: 'transparent' }} />
    <View style={{ width: size * 0.56, height: size * 0.62, borderRadius: size * 0.3, borderWidth: 1.8, borderColor: color, borderBottomColor: 'transparent', position: 'absolute' }} />
    <View style={{ width: size * 0.26, height: size * 0.32, borderRadius: size * 0.15, borderWidth: 1.8, borderColor: color, position: 'absolute' }} />
  </View>
);

export const IconStethoscope = ({ size = 20, color = '#0066FF' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: size * 0.75, height: size * 0.6, borderBottomLeftRadius: size * 0.375, borderBottomRightRadius: size * 0.375, borderWidth: 2, borderColor: color, borderTopColor: 'transparent' }} />
    <View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, backgroundColor: color, position: 'absolute', bottom: 0 }} />
  </View>
);

export const IconBloodDrop = ({ size = 20, color = '#EF4444' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size * 0.7,
      height: size * 0.7,
      borderTopLeftRadius: size * 0.7,
      borderBottomLeftRadius: size * 0.35,
      borderBottomRightRadius: size * 0.35,
      backgroundColor: color,
      transform: [{ rotate: '-45deg' }],
    }}
  />
);

export const IconHeartPulse = ({ size = 20, color = '#E11D48' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: size * 0.9, color: color, fontWeight: '900', lineHeight: size }}>♥</Text>
  </View>
);

export const IconClock = ({ size = 14, color = '#64748B' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1.5,
      borderColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <View style={{ width: 1.4, height: size * 0.36, backgroundColor: color, position: 'absolute', top: size * 0.12 }} />
    <View style={{ width: size * 0.3, height: 1.4, backgroundColor: color, position: 'absolute', right: size * 0.14 }} />
  </View>
);

export const IconLogout = ({ size = 18, color = '#EF4444' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: size * 0.48, height: size * 0.8, borderLeftWidth: 2, borderTopWidth: 2, borderBottomWidth: 2, borderColor: color, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -2 }}>
      <View style={{ width: size * 0.4, height: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 13, color: color, fontWeight: '900', marginLeft: -4, marginTop: -2 }}>›</Text>
    </View>
  </View>
);

export const IconChevronRight = ({ size = 16, color = '#94A3B8' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size * 0.45,
      height: size * 0.45,
      borderTopWidth: 2.2,
      borderRightWidth: 2.2,
      borderColor: color,
      transform: [{ rotate: '45deg' }],
    }}
  />
);

export const IconChevronLeft = ({ size = 16, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size * 0.45,
      height: size * 0.45,
      borderBottomWidth: 2.2,
      borderLeftWidth: 2.2,
      borderColor: color,
      transform: [{ rotate: '45deg' }],
    }}
  />
);

export const IconHelp = ({ size = 20, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1.8,
      borderColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Text style={{ fontSize: size * 0.62, fontWeight: '900', color: color, marginTop: -1 }}>?</Text>
  </View>
);

export const IconInfo = ({ size = 20, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1.8,
      borderColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Text style={{ fontSize: size * 0.62, fontWeight: '900', color: color, marginTop: -1 }}>i</Text>
  </View>
);

export const IconShare = ({ size = 18, color = '#0D2B52' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, backgroundColor: color, position: 'absolute', right: 1, top: 1 }} />
    <View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, backgroundColor: color, position: 'absolute', left: 1, top: size * 0.36 }} />
    <View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, backgroundColor: color, position: 'absolute', right: 1, bottom: 1 }} />
    <View style={{ width: size * 0.52, height: 1.6, backgroundColor: color, transform: [{ rotate: '-28deg' }], position: 'absolute', top: size * 0.32, left: size * 0.22 }} />
    <View style={{ width: size * 0.52, height: 1.6, backgroundColor: color, transform: [{ rotate: '28deg' }], position: 'absolute', bottom: size * 0.32, left: size * 0.22 }} />
  </View>
);

export const IconCopy = ({ size = 14, color = '#64748B' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, position: 'relative' }}>
    <View style={{ width: size * 0.7, height: size * 0.7, borderRadius: 2, borderWidth: 1.4, borderColor: color, position: 'absolute', top: 0, right: 0 }} />
    <View style={{ width: size * 0.7, height: size * 0.7, borderRadius: 2, borderWidth: 1.4, borderColor: color, backgroundColor: '#F1F5F9', position: 'absolute', bottom: 0, left: 0 }} />
  </View>
);

export const IconCheck = ({ size = 16, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size * 0.38,
      height: size * 0.65,
      borderBottomWidth: 2.8,
      borderRightWidth: 2.8,
      borderColor: color,
      transform: [{ rotate: '42deg' }],
      marginTop: -size * 0.15,
    }}
  />
);

export const IconStar = ({ size = 12, color = '#F59E0B' }: { size?: number; color?: string }) => (
  <Text style={{ fontSize: size, color: color, fontWeight: '900', marginRight: 3 }}>★</Text>
);

export const IconPlus = ({ size = 18, color = '#10B981' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: size * 0.7, height: 2.4, backgroundColor: color, borderRadius: 1.2 }} />
    <View style={{ width: 2.4, height: size * 0.7, backgroundColor: color, borderRadius: 1.2, position: 'absolute' }} />
  </View>
);

export const App: React.FC = () => {
  // Flow State
  const [stage, setStage] = useState<AppStage>('splash1');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [subView, setSubView] = useState<SubView>('none');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('EN');
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Booking Flow State
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorInfo>(AVAILABLE_DOCTORS[0]);
  const [selectedDay, setSelectedDay] = useState<number>(9);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('09:30 AM');
  const [doctorCategoryFilter, setDoctorCategoryFilter] = useState<string>('All');
  const [doctorSearchQuery, setDoctorSearchQuery] = useState<string>('');

  // Tab Filter States
  const [apptFilter, setApptFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [recordsFilter, setRecordsFilter] = useState<'all' | 'consultations' | 'labResults' | 'imaging'>('all');
  const [rxFilter, setRxFilter] = useState<'active' | 'history'>('active');
  const [labsFilter, setLabsFilter] = useState<'recent' | 'all'>('recent');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Auth State
  const [authSheet, setAuthSheet] = useState<AuthSheetMode>('none');
  const [patientIdInput, setPatientIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerDob, setRegisterDob] = useState('');
  const [registerLga, setRegisterLga] = useState('Abak');
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [showLgaDropdown, setShowLgaDropdown] = useState(false);

  // Fast-Pass Biometric Enrollment State (Default: false, enrolled via Settings / Profile)
  const [isFastPassEnrolled, setIsFastPassEnrolled] = useState(false);

  // Hospital Facility Search in Appointments
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<HospitalFacility>(AKWA_IBOM_HOSPITALS[0]);

  // Home Checklist State
  const [prepChecklist, setPrepChecklist] = useState<Record<string, boolean>>({
    fasting: true,
    documents: true,
    medications: false,
  });

  // Telehealth Video Call Modal
  const [inVideoCall, setInVideoCall] = useState(false);
  const [callMuted, setCallMuted] = useState(false);
  const [callCamOff, setCallCamOff] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'doctor',
      text: 'Good day. Your lab investigations from ABK-001 (General Hospital Abak) have been reconciled with your chart.',
      time: '10:14 AM',
    },
    {
      id: '2',
      sender: 'patient',
      text: 'Thank you doctor. I collected the prescription at the pharmacy unit yesterday.',
      time: '10:17 AM',
    },
    {
      id: '3',
      sender: 'doctor',
      text: 'Good. Your follow-up telehealth session is scheduled for 14:30 today.',
      time: '10:20 AM',
    },
  ]);
  const [inputMsg, setInputMsg] = useState('');

  // ── PHASE 1: Emergency / Health Card / Billing / Med Reminders ──
  const [emergencyContacts] = useState([
    { name: 'Dr. James Okafor', role: 'Primary Physician', phone: '0800-AKS-HEALTH', color: '#0066FF' },
    { name: 'General Hospital Abak', role: 'Assigned Facility (ABK-001)', phone: '08034567890', color: '#10B981' },
    { name: 'Chinedu Emmanuel', role: 'Next of Kin', phone: '08012345678', color: '#F59E0B' },
  ]);
  const [bills] = useState([
    { id: 'INV-2025-001', desc: 'General Checkup — Dr. Okafor', date: '9 Sep 2025', amount: '₦4,500', status: 'Paid', statusColor: '#10B981' },
    { id: 'INV-2025-002', desc: 'CBC Blood Test — Lab Services', date: '5 Aug 2025', amount: '₦2,200', status: 'Paid', statusColor: '#10B981' },
    { id: 'INV-2025-003', desc: 'Cardiology Follow-up — Dr. Bello', date: '12 May 2025', amount: '₦6,000', status: 'Covered (AKSHS)', statusColor: '#0066FF' },
    { id: 'INV-2025-004', desc: 'Telehealth Session — ABK-001', date: '25 Aug 2025', amount: '₦1,500', status: 'Pending', statusColor: '#F59E0B' },
  ]);
  const [medSchedule] = useState([
    { name: 'Amlodipine 5mg', time: '08:00 AM', taken: true, color: '#0066FF', note: 'With water, before breakfast' },
    { name: 'Metformin 500mg', time: '01:00 PM', taken: false, color: '#10B981', note: 'After lunch' },
    { name: 'Atorvastatin 20mg', time: '09:00 PM', taken: false, color: '#7C3AED', note: 'At bedtime' },
    { name: 'Vitamin D3 1000IU', time: '08:00 AM', taken: true, color: '#F59E0B', note: 'Daily supplement' },
  ]);

  // ── PHASE 2: Vitals / Feedback / Tourism / Immunization ──
  const [vitalsLog] = useState([
    { date: 'Today', bp: '118/76', glucose: '5.2 mmol/L', weight: '72 kg', temp: '36.6°C', pulse: '74 bpm' },
    { date: 'Yesterday', bp: '122/80', glucose: '5.8 mmol/L', weight: '72 kg', temp: '36.7°C', pulse: '78 bpm' },
    { date: '9 Sep', bp: '120/78', glucose: '5.4 mmol/L', weight: '71.5 kg', temp: '36.5°C', pulse: '72 bpm' },
  ]);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [immunizations] = useState([
    { vaccine: 'COVID-19 (Pfizer)', date: '15 Mar 2022', dose: 'Dose 2/2', status: 'Complete', color: '#10B981' },
    { vaccine: 'Hepatitis B', date: '3 Jan 2020', dose: 'Dose 3/3', status: 'Complete', color: '#10B981' },
    { vaccine: 'Yellow Fever', date: '20 Jun 2019', dose: 'Single dose', status: 'Complete', color: '#10B981' },
    { vaccine: 'Meningitis A', date: '—', dose: '—', status: 'Due', color: '#F59E0B' },
    { vaccine: 'Tetanus Booster', date: '—', dose: '—', status: 'Overdue', color: '#EF4444' },
  ]);

  // ── PHASE 3: Family / Mental Health / Health Edu ──
  const [familyMembers] = useState([
    { name: 'Emmanuel Chinedu', relation: 'Spouse', dob: '22/04/1988', id: 'ARS-PT-000124', initials: 'EC', color: '#0066FF' },
    { name: 'Chisom Chinedu', relation: 'Daughter (8yrs)', dob: '11/07/2016', id: 'ARS-PT-000125', initials: 'CC', color: '#E11D48' },
    { name: 'Ikenna Chinedu', relation: 'Son (5yrs)', dob: '03/02/2019', id: 'ARS-PT-000126', initials: 'IC', color: '#F59E0B' },
  ]);
  const [moodToday, setMoodToday] = useState<number | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Document Viewer Modal State
  const [selectedResultDoc, setSelectedResultDoc] = useState<DiagnosticReport | null>(null);

  // Animations
  const splash1Opacity = useRef(new Animated.Value(0)).current;
  const splash1Scale = useRef(new Animated.Value(0.85)).current;
  const splash1Glow = useRef(new Animated.Value(0.4)).current;
  const splash2Opacity = useRef(new Animated.Value(0)).current;
  const splash2Y = useRef(new Animated.Value(28)).current;
  const m87Pulse = useRef(new Animated.Value(0.4)).current;
  const authFade = useRef(new Animated.Value(0)).current;
  const pulseBeat = useRef(new Animated.Value(1)).current;

  // Pulse animation for Heartbeat & M87 LED
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(m87Pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(m87Pulse, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseBeat, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseBeat, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Splash 1: Logo ONLY for exactly 3 seconds
  useEffect(() => {
    if (stage === 'splash1') {
      Animated.parallel([
        Animated.timing(splash1Opacity, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.spring(splash1Scale, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(splash1Glow, {
              toValue: 1,
              duration: 1300,
              useNativeDriver: true,
            }),
            Animated.timing(splash1Glow, {
              toValue: 0.4,
              duration: 1300,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();

      const timer = setTimeout(() => {
        Animated.timing(splash1Opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          setStage('splash2');
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [stage]);

  // Splash 2: Logo + Name + Powered by M87 at bottom center
  useEffect(() => {
    if (stage === 'splash2') {
      Animated.parallel([
        Animated.timing(splash2Opacity, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.spring(splash2Y, {
          toValue: 0,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        transitionToAuth();
      }, 3200);

      return () => clearTimeout(timer);
    }
  }, [stage]);

  const transitionToAuth = () => {
    Animated.timing(splash2Opacity, {
      toValue: 0,
      duration: 380,
      useNativeDriver: true,
    }).start(() => {
      setStage('auth');
      Animated.timing(authFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleChecklist = (key: string) => {
    setPrepChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
    showToast('Care protocol checklist updated');
  };

  const handleSignIn = () => {
    if (!patientIdInput.trim()) {
      showToast('Please enter your Patient ID or Health Card Number');
      return;
    }
    setAuthSheet('none');
    setStage('main');
    showToast('Welcome to MedCore Care Portal');
  };

  const handleBiometricAuth = () => {
    if (!isFastPassEnrolled) {
      showToast('Fast-Pass not enrolled. Please sign in with password and enable in Settings.');
      return;
    }
    setBiometricScanning(true);
    setTimeout(() => {
      setBiometricScanning(false);
      setAuthSheet('none');
      setStage('main');
      showToast('Biometric Fast-Pass Verified');
    }, 1000);
  };

  const toggleBiometricEnrollment = () => {
    if (!isFastPassEnrolled) {
      setIsFastPassEnrolled(true);
      showToast('Biometric Fast-Pass enrolled! Enabled for next sign-in.');
    } else {
      setIsFastPassEnrolled(false);
      showToast('Biometric Fast-Pass disabled.');
    }
  };

  const handleSendMsg = () => {
    if (!inputMsg.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: 'patient',
      text: inputMsg.trim(),
      time: 'Just now',
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setInputMsg('');

    setTimeout(() => {
      const docReply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'doctor',
        text: 'Clinical coordinator acknowledged. Synced with facility record.',
        time: 'Just now',
      };
      setChatMessages((prev) => [...prev, docReply]);
    }, 1100);
  };

  const handleSignOut = () => {
    setStage('auth');
    setAuthSheet('none');
    setActiveTab('home');
    showToast('Logged out securely');
  };

  const filteredHospitals = AKWA_IBOM_HOSPITALS.filter(
    (h) =>
      h.name.toLowerCase().includes(hospitalSearch.toLowerCase()) ||
      h.lga.toLowerCase().includes(hospitalSearch.toLowerCase()) ||
      h.code.toLowerCase().includes(hospitalSearch.toLowerCase())
  );

  // =========================================================================
  // 1. SPLASH SCREEN 1: ONLY LOGO FOR 3 SECONDS
  // =========================================================================
  if (stage === 'splash1') {
    return (
      <View style={styles.splash1Container}>
        <StatusBar barStyle="light-content" backgroundColor="#050C1A" />
        
        <Animated.View style={[styles.auraBlueLeft, { opacity: splash1Glow }]} />
        <Animated.View style={[styles.auraEmeraldRight, { opacity: splash1Glow }]} />

        <Animated.View
          style={[
            styles.splash1LogoCard,
            {
              opacity: splash1Opacity,
              transform: [{ scale: splash1Scale }],
            },
          ]}
        >
          <Image source={patLogo} style={styles.splash1LogoImg} resizeMode="contain" />
        </Animated.View>

        <View style={styles.splash1EcgBar}>
          <View style={styles.ecgPulseDot} />
          <View style={styles.ecgTrack}>
            <View style={styles.ecgFill} />
          </View>
          <View style={styles.ecgPulseDotRight} />
        </View>
      </View>
    );
  }

  // =========================================================================
  // 2. SPLASH SCREEN 2: ARISE x MEDCORE — FEATURE SHOWCASE
  // =========================================================================
  if (stage === 'splash2') {
    const featureItems = [
      {
        key: 'appt',
        title: 'Smart Appointments',
        desc: 'Book, reschedule and manage visits with real-time availability and intelligent reminders.',
        accent: '#0066FF',
        bg: '#EFF6FF',
        icon: (
          <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 16, marginBottom: -1, zIndex: 2 }}>
              <View style={{ width: 2, height: 4, borderRadius: 1, backgroundColor: '#0066FF' }} />
              <View style={{ width: 2, height: 4, borderRadius: 1, backgroundColor: '#0066FF' }} />
            </View>
            <View style={{ width: 22, height: 20, borderRadius: 4, borderWidth: 1.8, borderColor: '#0066FF', overflow: 'hidden' }}>
              <View style={{ width: '100%', height: 6, backgroundColor: '#0066FF' }} />
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', alignItems: 'center', padding: 2 }}>
                {[0,1,2,3,4,5].map(i => <View key={i} style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: '#0066FF' }} />)}
              </View>
            </View>
          </View>
        ),
      },
      {
        key: 'records',
        title: 'Results & Records',
        desc: 'Secure access to lab results, imaging reports and personal health records anytime.',
        accent: '#7C3AED',
        bg: '#F3E8FF',
        icon: (
          <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 18, height: 22, borderRadius: 3, borderWidth: 1.8, borderColor: '#7C3AED', backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ width: 11, height: 1.5, backgroundColor: '#7C3AED', borderRadius: 1, marginBottom: 3 }} />
              <View style={{ width: 11, height: 1.5, backgroundColor: '#7C3AED', borderRadius: 1, marginBottom: 3 }} />
              <View style={{ width: 7, height: 1.5, backgroundColor: '#7C3AED', borderRadius: 1 }} />
            </View>
          </View>
        ),
      },
      {
        key: 'nav',
        title: 'Care Navigation',
        desc: 'Guided pathways, pre-visit instructions and post-discharge follow-up support.',
        accent: '#00B4B4',
        bg: '#E6FAFA',
        icon: (
          <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#00B4B4', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#00B4B4', marginBottom: -2 }} />
            </View>
          </View>
        ),
      },
      {
        key: 'tourism',
        title: 'Medical Tourism Hub',
        desc: 'Dedicated support for international patients: travel coordination, accommodation and concierge care.',
        accent: '#F59E0B',
        bg: '#FEF3C7',
        icon: (
          <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: '#F59E0B' }}>
                <View style={{ position: 'absolute', width: 12, height: 1, backgroundColor: '#F59E0B', top: 5 }} />
                <View style={{ position: 'absolute', width: 1, height: 12, backgroundColor: '#F59E0B', left: 5 }} />
              </View>
            </View>
          </View>
        ),
      },
      {
        key: 'msg',
        title: 'Secure Messaging',
        desc: 'Direct communication with care teams while maintaining privacy and clinical oversight.',
        accent: '#10B981',
        bg: '#DCFCE7',
        icon: (
          <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 22, height: 16, borderRadius: 6, borderWidth: 1.8, borderColor: '#10B981', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ width: 12, height: 1.5, backgroundColor: '#10B981', borderRadius: 1, marginBottom: 2 }} />
              <View style={{ width: 8, height: 1.5, backgroundColor: '#10B981', borderRadius: 1 }} />
            </View>
            <View style={{ width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 0, borderTopWidth: 5, borderLeftColor: 'transparent', borderTopColor: '#10B981', alignSelf: 'flex-start', marginLeft: 6, marginTop: -1 }} />
          </View>
        ),
      },
      {
        key: 'feedback',
        title: 'Feedback & Engagement',
        desc: 'Real-time satisfaction capture and continuous improvement loop.',
        accent: '#E11D48',
        bg: '#FFE4E6',
        icon: (
          <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
              {[10, 16, 12, 20, 14].map((h, i) => (
                <View key={i} style={{ width: 2.5, height: h, backgroundColor: '#E11D48', borderRadius: 1.5 }} />
              ))}
            </View>
          </View>
        ),
      },
    ];

    return (
      <View style={styles.splash2Container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* TEAL WAVE BLOB — TOP LEFT */}
        <View style={styles.s2WaveTopLeft} />
        <View style={styles.s2WaveTopLeftInner} />

        {/* BOTTOM RIGHT BLOB */}
        <View style={styles.s2WaveBottomRight} />
        <View style={styles.s2WaveBottomRightInner} />

        <Animated.View
          style={[
            styles.splash2FeatureWrap,
            { opacity: splash2Opacity, transform: [{ translateY: splash2Y }] },
          ]}
        >
          {/* TOP HEADER: ARISE logo + MEDCORE wordmark */}
          <View style={styles.splash2TopBar}>
            <View style={styles.splash2StateTag}>
              <View style={styles.splash2StateDot} />
              <Text style={styles.splash2StateTagText}>AKWA IBOM STATE</Text>
            </View>
            <Image source={ariseLogo} style={styles.ariseLogoImgLg} resizeMode="contain" />
          </View>

          {/* MEDCORE WORDMARK */}
          <View style={[styles.s2WordmarkRow, { marginTop: 8, marginBottom: 4 }]}>
            <Text style={styles.s2WordMed}>MED</Text>
            <Text style={styles.s2WordCore}>CORE</Text>
          </View>
          <Text style={[styles.s2Tagline, { marginBottom: 18 }]}>Better Systems. Healthier Communities.</Text>

          {/* FEATURE CARDS: 2-column grid */}
          <View style={styles.featureGrid}>
            {featureItems.map((item) => (
              <View key={item.key} style={[styles.featureCard, { borderTopColor: item.accent }]}>
                <View style={[styles.featureCardIconBadge, { backgroundColor: item.bg }]}>
                  {item.icon}
                </View>
                <Text style={[styles.featureCardTitle, { color: item.accent }]}>{item.title}</Text>
                <Text style={styles.featureCardDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>

          {/* PROGRESS STRIP */}
          <View style={styles.s2ProgressTrack}>
            <Animated.View
              style={[styles.s2ProgressFill, { transform: [{ scaleX: splash2Opacity }] }]}
            />
          </View>

          {/* M87 FOOTNOTE */}
          <Text style={styles.s2FootnoteM87}>
            Powered by <Text style={styles.s2FootnoteM87Bold}>M87</Text> Sovereign Health Engine
          </Text>
        </Animated.View>
      </View>
    );
  }

  // =========================================================================
  // 3. AUTHENTICATION SCREEN: GLASSMORPHISM PREMIUM DESIGN WITH REAL IMAGERY
  // =========================================================================
  if (stage === 'auth') {
    return (
      <SafeAreaView style={styles.figmaAuthSafeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* Real Hospital Hero Background */}
        <Image source={hospitalHeroImg} style={styles.authBgImage} resizeMode="cover" />
        {/* Dark overlay for readability */}
        <View style={styles.authBgOverlay} />

        <Animated.View style={[styles.figmaAuthContainer, { opacity: authFade }]}>
          
          {/* Top Bar: Arise logo LEFT + Language pill RIGHT */}
          <View style={styles.figmaTopBar}>
            {/* ARISE AKWA IBOM LOGO */}
            <Image source={ariseLogo} style={styles.ariseLogoImgSm} resizeMode="contain" />
            <TouchableOpacity
              style={styles.figmaLangPillGlass}
              onPress={() => setShowLangMenu(!showLangMenu)}
            >
              <Text style={styles.figmaLangTextGlass}>{selectedLanguage}</Text>
            </TouchableOpacity>
          </View>

          {/* Language Dropdown */}
          {showLangMenu && (
            <View style={styles.figmaLangDropdown}>
              {(['EN', 'AR', 'ES', 'FR'] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.figmaLangOption,
                    selectedLanguage === lang && styles.figmaLangOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedLanguage(lang);
                    setShowLangMenu(false);
                  }}
                >
                  <Text
                    style={[
                      styles.figmaLangOptionText,
                      selectedLanguage === lang && styles.figmaLangOptionTextActive,
                    ]}
                  >
                    {lang === 'EN' && 'English'}
                    {lang === 'AR' && 'العربية'}
                    {lang === 'ES' && 'Español'}
                    {lang === 'FR' && 'Français'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Center Glass Card: Logo & Brand */}
          <View style={styles.figmaCenterHero}>
            {/* Glass brand card */}
            <View style={styles.authGlassLogoCard}>
              <View style={styles.figmaLogoWrap}>
                <Image source={patLogo} style={styles.figmaLogoImg} resizeMode="contain" />
              </View>
              <View style={styles.figmaBrandRow}>
                <Text style={styles.figmaBrandBlue}>MedCore </Text>
                <Text style={styles.figmaBrandEmerald}>Care</Text>
              </View>
              {/* Akwa Ibom tag */}
              <View style={styles.authStateTagGlass}>
                <View style={styles.authStateDot} />
                <Text style={styles.authStateTagText}>AKWA IBOM STATE HEALTH PORTAL</Text>
              </View>
            </View>

            {/* Headline & Subtitle */}
            <Text style={styles.figmaTitleGlass}>Welcome Back!</Text>
            <Text style={styles.figmaSubtitleGlass}>
              Secure access to your personal health record and care services.
            </Text>
          </View>

          {/* Action Buttons — glassmorphism style */}
          <View style={styles.figmaBtnGroup}>
            <TouchableOpacity
              style={styles.figmaLoginBtn}
              onPress={() => setAuthSheet('login')}
              activeOpacity={0.88}
            >
              <Text style={styles.figmaLoginBtnText}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.figmaSignUpBtn}
              onPress={() => setAuthSheet('signup')}
              activeOpacity={0.88}
            >
              <Text style={styles.figmaSignUpBtnText}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Subtle Footnote */}
          <View style={styles.figmaFooterM87}>
            <Text style={styles.figmaFooterText}>Powered by <Text style={{ color: '#00A88F', fontWeight: '800' }}>M87</Text> Health Core</Text>
          </View>

        </Animated.View>

        {/* =========================================================================
            LOGIN MODAL / SHEET (Demo profile section cleanly removed)
        ========================================================================= */}
        <Modal
          visible={authSheet === 'login'}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setAuthSheet('none')}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              {/* Header with Back Arrow */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setAuthSheet('none')}
                >
                  <Text style={styles.modalCloseIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle}>Welcome Back</Text>
                <View style={{ width: 36 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.sheetSub}>
                  Enter your health number or credentials to access your hospital record.
                </Text>

                {/* Patient ID Input */}
                <View style={styles.sheetInputGroup}>
                  <Text style={styles.sheetInputLabel}>PATIENT ID / HEALTH CARD NUMBER</Text>
                  <View style={styles.sheetInputBox}>
                    <TextInput
                      style={styles.sheetTextInput}
                      value={patientIdInput}
                      onChangeText={setPatientIdInput}
                      placeholder="e.g. AKS-ABK-001-90821"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.sheetInputGroup}>
                  <View style={styles.sheetPassLabelRow}>
                    <Text style={styles.sheetInputLabel}>PASSWORD</Text>
                    <TouchableOpacity onPress={() => showToast('Recovery instructions sent to registered phone')}>
                      <Text style={styles.sheetForgotLink}>Forgot?</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.sheetInputBox}>
                    <TextInput
                      style={styles.sheetTextInput}
                      value={passwordInput}
                      onChangeText={setPasswordInput}
                      secureTextEntry={!showPassword}
                      placeholder="Enter security password"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Text style={styles.textActionToggle}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sign In Primary Button */}
                <TouchableOpacity
                  style={styles.sheetSubmitBtn}
                  onPress={handleSignIn}
                >
                  <Text style={styles.sheetSubmitBtnText}>Sign In</Text>
                </TouchableOpacity>

                {/* Fast-Pass Biometric Button (ONLY VISIBLE IF ENROLLED IN SETTINGS) */}
                {isFastPassEnrolled ? (
                  <TouchableOpacity
                    style={styles.sheetBiometricBtn}
                    onPress={handleBiometricAuth}
                    disabled={biometricScanning}
                  >
                    <View style={styles.biometricDotActive} />
                    <Text style={styles.sheetBiometricText}>
                      {biometricScanning ? 'Verifying Biometrics...' : 'Fast-Pass with Face / Touch ID'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.fastPassNoticeBox}>
                    <Text style={styles.fastPassNoticeText}>
                      Biometric Fast-Pass can be enrolled in Settings after sign in.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* =========================================================================
            SIGN UP MODAL / SHEET
        ========================================================================= */}
        <Modal
          visible={authSheet === 'signup'}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setAuthSheet('none')}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setAuthSheet('none')}
                >
                  <Text style={styles.modalCloseIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle}>Create Account</Text>
                <View style={{ width: 36 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.sheetSub}>
                  Register your unified patient card with the Akwa Ibom State health network.
                </Text>

                <View style={styles.sheetInputGroup}>
                  <Text style={styles.sheetInputLabel}>FULL LEGAL NAME</Text>
                  <View style={styles.sheetInputBox}>
                    <TextInput
                      style={styles.sheetTextInput}
                      value={registerName}
                      onChangeText={setRegisterName}
                      placeholder="e.g. Iniobong Okon"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={styles.sheetInputGroup}>
                  <Text style={styles.sheetInputLabel}>LOCAL GOVERNMENT AREA (LGA)</Text>
                  {/* LGA Dropdown Trigger */}
                  <TouchableOpacity
                    style={styles.lgaDropdownTrigger}
                    onPress={() => setShowLgaDropdown(!showLgaDropdown)}
                    activeOpacity={0.85}
                  >
                    <Text style={[
                      styles.lgaDropdownTriggerText,
                      registerLga ? styles.lgaDropdownTriggerTextSelected : styles.lgaDropdownTriggerTextPlaceholder,
                    ]}>
                      {registerLga || 'Select your LGA...'}
                    </Text>
                    <View style={[
                      styles.lgaChevron,
                      showLgaDropdown && styles.lgaChevronOpen,
                    ]}>
                      <View style={styles.lgaChevronBar1} />
                      <View style={styles.lgaChevronBar2} />
                    </View>
                  </TouchableOpacity>

                  {/* LGA Dropdown List */}
                  {showLgaDropdown && (
                    <View style={styles.lgaDropdownList}>
                      <ScrollView
                        style={styles.lgaDropdownScroll}
                        nestedScrollEnabled={true}
                        showsVerticalScrollIndicator={true}
                      >
                        {AKS_LGAS.map((lga) => (
                          <TouchableOpacity
                            key={lga}
                            style={[
                              styles.lgaDropdownItem,
                              registerLga === lga && styles.lgaDropdownItemActive,
                            ]}
                            onPress={() => {
                              setRegisterLga(lga);
                              setShowLgaDropdown(false);
                            }}
                          >
                            <View style={[
                              styles.lgaItemDot,
                              registerLga === lga && styles.lgaItemDotActive,
                            ]} />
                            <Text style={[
                              styles.lgaDropdownItemText,
                              registerLga === lga && styles.lgaDropdownItemTextActive,
                            ]}>
                              {lga}
                            </Text>
                            {registerLga === lga && (
                              <View style={styles.lgaCheckMark}>
                                <Text style={styles.lgaCheckMarkText}>✓</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.sheetInputGroup}>
                  <Text style={styles.sheetInputLabel}>EMAIL OR PHONE NUMBER</Text>
                  <View style={styles.sheetInputBox}>
                    <TextInput
                      style={styles.sheetTextInput}
                      value={registerEmail}
                      onChangeText={setRegisterEmail}
                      placeholder="patient@akwaibom.health"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                <View style={styles.sheetInputGroup}>
                  <Text style={styles.sheetInputLabel}>DATE OF BIRTH (DD/MM/YYYY)</Text>
                  <View style={styles.sheetInputBox}>
                    <TextInput
                      style={styles.sheetTextInput}
                      value={registerDob}
                      onChangeText={setRegisterDob}
                      placeholder="14/05/1990"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.sheetSubmitBtn}
                  onPress={() => {
                    setAuthSheet('none');
                    setStage('main');
                    showToast('Registration complete. Assigned to ABK-001 (General Hospital Abak)');
                  }}
                >
                  <Text style={styles.sheetSubmitBtnText}>Create Health Record</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Global Toast */}
        {toastMessage && (
          <View style={styles.toastBox}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // =========================================================================
  // 4. MAIN PATIENT PORTAL & 12 MOCKUP SCREENS
  // =========================================================================
  const patientDisplayName = registerName.trim() ? registerName.trim() : 'Amaka Chinedu';
  const patientInitials = registerName.trim()
    ? registerName
        .trim()
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AC';
  const patientId = 'ARS-PT-000123';

  // Filter available doctors
  const filteredDoctors = AVAILABLE_DOCTORS.filter((doc) => {
    const matchesCategory =
      doctorCategoryFilter === 'All' || doc.category === doctorCategoryFilter;
    const matchesQuery =
      !doctorSearchQuery.trim() ||
      doc.name.toLowerCase().includes(doctorSearchQuery.toLowerCase()) ||
      doc.specialty.toLowerCase().includes(doctorSearchQuery.toLowerCase()) ||
      doc.facility.toLowerCase().includes(doctorSearchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <SafeAreaView style={[styles.mainCanvas, isDarkMode && styles.mainCanvasDark]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? '#0F172A' : '#FFFFFF'} />

      {/* Decorative Wave Blobs matching Splash 2 */}
      <View style={styles.mainWaveTopRight} />
      <View style={styles.mainWaveBottomLeft} />

      {/* =======================================================================
          A. SUB-VIEW HEADERS (When navigating inside features)
      ======================================================================= */}
      {subView !== 'none' && subView !== 'bookSuccess' ? (
        <View style={styles.subViewHeader}>
          <TouchableOpacity
            style={styles.subViewBackBtn}
            onPress={() => {
              if (subView === 'bookStep2') {
                setSubView('bookStep1');
              } else {
                setSubView('none');
              }
            }}
          >
            <Text style={styles.subViewBackArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.subViewHeaderTitle}>
            {subView === 'bookStep1' && 'Book Appointment'}
            {subView === 'bookStep2' && 'Book Appointment'}
            {subView === 'prescriptions' && 'Prescriptions'}
            {subView === 'labResults' && 'Lab Results'}
            {subView === 'notifications' && 'Notifications'}
            {subView === 'settings' && 'Settings'}
            {subView === 'chat' && 'Care Team Consult'}
            {subView === 'referrals' && 'Specialist Referrals'}
            {subView === 'personalInfo' && 'Personal Information'}
            {subView === 'medicalHistory' && 'Medical History'}
            {subView === 'emergency' && 'Emergency SOS'}
            {subView === 'healthCard' && 'Digital Health Card'}
            {subView === 'billing' && 'Billing & Payments'}
            {subView === 'medReminders' && 'Medication Reminders'}
            {subView === 'vitals' && 'Health Vitals'}
            {subView === 'feedback' && 'Rate & Feedback'}
            {subView === 'tourismHub' && 'Medical Tourism Hub'}
            {subView === 'immunization' && 'Immunization Records'}
            {subView === 'family' && 'Family & Dependents'}
            {subView === 'mentalHealth' && 'Mental Health & Wellness'}
            {subView === 'healthEdu' && 'Health Education'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      ) : subView !== 'bookSuccess' ? (
        /* =======================================================================
            B. MAIN TOP APP BAR (Screen 2 matching Figma: Arise Logo + MEDCORE + Bell)
        ======================================================================= */
        <View style={styles.mockHeader}>
          <View style={styles.mockHeaderBrandRow}>
            <Image source={ariseLogo} style={styles.mockHeaderAriseLogo} resizeMode="contain" />
            <View style={styles.mockHeaderBrandTextWrap}>
              <Text style={styles.mockHeaderMed}>MED</Text>
              <Text style={styles.mockHeaderCore}>CORE</Text>
            </View>
          </View>

          {/* Top Right: Notification Bell with Red Dot */}
          <TouchableOpacity
            style={styles.mockBellBtn}
            onPress={() => setSubView('notifications')}
            activeOpacity={0.7}
          >
            <IconBell size={19} color="#0D2B52" />
            <View style={styles.mockBellBadgeDot} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* =======================================================================
          C. MAIN SCROLLABLE CONTENT BODY
      ======================================================================= */}
      <ScrollView
        style={styles.mainScrollContainer}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* -------------------------------------------------------------------
            1. SUBVIEW: BOOK APPOINTMENT - STEP 1 (Select Doctor)
        ------------------------------------------------------------------- */}
        {subView === 'bookStep1' && (
          <View style={styles.subViewContainer}>
            {/* Stepper (1) Doctor ─── (2) Date & Time ─── (3) Confirm */}
            <View style={styles.stepperContainer}>
              <View style={styles.stepCol}>
                <View style={[styles.stepCircle, styles.stepCircleActive]}>
                  <Text style={styles.stepCircleTextActive}>1</Text>
                </View>
                <Text style={[styles.stepLabel, styles.stepLabelActive]}>Doctor</Text>
              </View>
              <View style={styles.stepConnector} />
              <View style={styles.stepCol}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepCircleText}>2</Text>
                </View>
                <Text style={styles.stepLabel}>Date & Time</Text>
              </View>
              <View style={styles.stepConnector} />
              <View style={styles.stepCol}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepCircleText}>3</Text>
                </View>
                <Text style={styles.stepLabel}>Confirm</Text>
              </View>
            </View>

            {/* Doctor Search Bar */}
            <View style={styles.doctorSearchRow}>
              <View style={{ marginRight: 8 }}>
                <IconSearch size={16} color="#64748B" />
              </View>
              <TextInput
                style={styles.doctorSearchInput}
                placeholder="Search for a doctor or specialty..."
                placeholderTextColor="#94A3B8"
                value={doctorSearchQuery}
                onChangeText={setDoctorSearchQuery}
              />
              {doctorSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setDoctorSearchQuery('')}>
                  <Text style={{ color: '#94A3B8', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Specialty Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipScroll}>
              {(['All', 'General Practice', 'Cardiologist', 'Pediatrician', 'Dermatologist'] as const).map(
                (cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.filterChipPill,
                      doctorCategoryFilter === cat && styles.filterChipPillActive,
                    ]}
                    onPress={() => setDoctorCategoryFilter(cat)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        doctorCategoryFilter === cat && styles.filterChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>

            <Text style={styles.mockSectionTitle}>Available Doctors</Text>

            {filteredDoctors.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.doctorListItemCard}
                onPress={() => {
                  setSelectedDoctor(doc);
                  setSubView('bookStep2');
                }}
                activeOpacity={0.88}
              >
                <View style={[styles.docAvatarRound, { backgroundColor: doc.avatarColor }]}>
                  <Text style={styles.docAvatarRoundText}>{doc.initials}</Text>
                </View>
                <View style={styles.docDetailsCol}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.docNameTitle}>{doc.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconStar size={12} color="#F59E0B" />
                      <Text style={styles.docRatingTag}>{doc.rating}</Text>
                    </View>
                  </View>
                  <Text style={styles.docSpecialtySub}>{doc.specialty}</Text>
                  <Text style={styles.docFacilityTag}>{doc.facility} ({doc.facilityCode})</Text>
                  <View style={styles.docNextDateRow}>
                    <View style={{ marginRight: 5 }}>
                      <IconCalendar size={12} color="#64748B" />
                    </View>
                    <Text style={styles.docNextDateText}>Available: {doc.nextDate}</Text>
                  </View>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* -------------------------------------------------------------------
            2. SUBVIEW: BOOK APPOINTMENT - STEP 2 (Select Date & Time)
        ------------------------------------------------------------------- */}
        {subView === 'bookStep2' && (
          <View style={styles.subViewContainer}>
            {/* Stepper */}
            <View style={styles.stepperContainer}>
              <View style={styles.stepCol}>
                <View style={[styles.stepCircle, styles.stepCircleDone]}>
                  <IconCheck size={13} color="#FFFFFF" />
                </View>
                <Text style={styles.stepLabel}>Doctor</Text>
              </View>
              <View style={[styles.stepConnector, styles.stepConnectorActive]} />
              <View style={styles.stepCol}>
                <View style={[styles.stepCircle, styles.stepCircleActive]}>
                  <Text style={styles.stepCircleTextActive}>2</Text>
                </View>
                <Text style={[styles.stepLabel, styles.stepLabelActive]}>Date & Time</Text>
              </View>
              <View style={styles.stepConnector} />
              <View style={styles.stepCol}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepCircleText}>3</Text>
                </View>
                <Text style={styles.stepLabel}>Confirm</Text>
              </View>
            </View>

            {/* Selected Doctor Summary Card */}
            <View style={styles.selectedDocSummaryCard}>
              <View style={[styles.docAvatarRoundSm, { backgroundColor: selectedDoctor.avatarColor }]}>
                <Text style={styles.docAvatarRoundSmText}>{selectedDoctor.initials}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.selectedDocName}>{selectedDoctor.name}</Text>
                <Text style={styles.selectedDocSpecialty}>
                  {selectedDoctor.specialty} • {selectedDoctor.facilityCode}
                </Text>
              </View>
            </View>

            {/* Select Date Section */}
            <Text style={styles.mockSectionTitle}>Select Date</Text>
            <View style={styles.calendarMonthBox}>
              <View style={styles.calendarNavRow}>
                <TouchableOpacity style={{ padding: 6 }}>
                  <IconChevronLeft size={16} color="#0D2B52" />
                </TouchableOpacity>
                <Text style={styles.calendarMonthTitle}>September 2025</Text>
                <TouchableOpacity style={{ padding: 6 }}>
                  <IconChevronRight size={16} color="#0D2B52" />
                </TouchableOpacity>
              </View>

              {/* Weekday labels */}
              <View style={styles.calendarDaysHeaderRow}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <Text key={day} style={styles.calendarDayHeaderLabel}>{day}</Text>
                ))}
              </View>

              {/* 30-Day Grid */}
              <View style={styles.calendarGrid}>
                {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
                  const isSelected = selectedDay === day;
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.calendarDayCell,
                        isSelected && styles.calendarDayCellSelected,
                      ]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <Text
                        style={[
                          styles.calendarDayNumber,
                          isSelected && styles.calendarDayNumberSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Available Time Slots */}
            <Text style={styles.mockSectionTitle}>Available Time Slots</Text>
            <View style={styles.timeSlotsGrid}>
              {['09:30 AM', '10:30 AM', '11:30 AM', '02:00 PM', '03:00 PM', '04:00 PM'].map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.timeSlotPill, isSelected && styles.timeSlotPillActive]}
                    onPress={() => setSelectedTimeSlot(slot)}
                  >
                    <Text
                      style={[styles.timeSlotText, isSelected && styles.timeSlotTextActive]}
                    >
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.continuePrimaryBtn}
              onPress={() => setSubView('bookSuccess')}
              activeOpacity={0.88}
            >
              <Text style={styles.continuePrimaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* -------------------------------------------------------------------
            3. SUBVIEW: APPOINTMENT BOOKED SUCCESS (Screen 12)
        ------------------------------------------------------------------- */}
        {subView === 'bookSuccess' && (
          <View style={styles.bookingSuccessScreen}>
            <View style={styles.successCheckCircle}>
              <IconCheck size={36} color="#FFFFFF" />
            </View>

            <Text style={styles.successHeading}>Appointment Booked!</Text>
            <Text style={styles.successSubheading}>
              Your appointment with {selectedDoctor.name} has been successfully booked.
            </Text>

            {/* Appointment Card */}
            <View style={styles.successDetailsCard}>
              <View style={styles.successCalendarSquare}>
                <IconCalendar size={26} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.successCardDate}>Mon, {selectedDay} Sep 2025</Text>
                <Text style={styles.successCardTime}>{selectedTimeSlot}</Text>
                <Text style={styles.successCardDoc}>
                  {selectedDoctor.specialty} • {selectedDoctor.facilityCode}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <TouchableOpacity
              style={styles.viewApptsBtn}
              onPress={() => {
                setSubView('none');
                setActiveTab('appointments');
              }}
              activeOpacity={0.88}
            >
              <Text style={styles.viewApptsBtnText}>View Appointments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backHomeBtn}
              onPress={() => {
                setSubView('none');
                setActiveTab('home');
              }}
              activeOpacity={0.88}
            >
              <Text style={styles.backHomeBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* -------------------------------------------------------------------
            4. SUBVIEW: PRESCRIPTIONS (Screen 7)
        ------------------------------------------------------------------- */}
        {subView === 'prescriptions' && (
          <View style={styles.subViewContainer}>
            {/* Segmented Toggle: Active / History */}
            <View style={styles.segmentedToggleBox}>
              <TouchableOpacity
                style={[styles.segmentBtn, rxFilter === 'active' && styles.segmentBtnActive]}
                onPress={() => setRxFilter('active')}
              >
                <Text style={[styles.segmentBtnText, rxFilter === 'active' && styles.segmentBtnTextActive]}>
                  Active
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, rxFilter === 'history' && styles.segmentBtnActive]}
                onPress={() => setRxFilter('history')}
              >
                <Text style={[styles.segmentBtnText, rxFilter === 'history' && styles.segmentBtnTextActive]}>
                  History
                </Text>
              </TouchableOpacity>
            </View>

            {rxFilter === 'active' ? (
              <>
                <View style={styles.prescriptionItemCard}>
                  <View style={[styles.rxIconCircle, { backgroundColor: '#FFF7ED' }]}>
                    <IconPill size={22} color="#F97316" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.rxDrugName}>Amoxicillin 500mg</Text>
                      <IconChevronRight size={16} color="#94A3B8" />
                    </View>
                    <Text style={styles.rxDosageText}>Take 1 capsule 3 times daily</Text>
                    <Text style={styles.rxPrescribedDate}>Prescribed: 9 Sep 2025</Text>
                    <View style={styles.rxStatusPillGreen}>
                      <Text style={styles.rxStatusPillGreenText}>Active</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.prescriptionItemCard}>
                  <View style={[styles.rxIconCircle, { backgroundColor: '#EFF6FF' }]}>
                    <IconPill size={22} color="#0066FF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.rxDrugName}>Paracetamol 500mg</Text>
                      <IconChevronRight size={16} color="#94A3B8" />
                    </View>
                    <Text style={styles.rxDosageText}>Take 1 tablet when needed</Text>
                    <Text style={styles.rxPrescribedDate}>Prescribed: 5 Aug 2025</Text>
                    <View style={styles.rxStatusPillGreen}>
                      <Text style={styles.rxStatusPillGreenText}>Active</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.prescriptionItemCard}>
                  <View style={[styles.rxIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <IconFlask size={22} color="#D97706" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.rxDrugName}>Vitamin D3 1000IU</Text>
                      <IconChevronRight size={16} color="#94A3B8" />
                    </View>
                    <Text style={styles.rxDosageText}>Take 1 tablet daily</Text>
                    <Text style={styles.rxPrescribedDate}>Prescribed: 20 Jun 2025</Text>
                    <View style={styles.rxStatusPillGreen}>
                      <Text style={styles.rxStatusPillGreenText}>Active</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.requestRefillActionBtn}
                  onPress={() => showToast('Refill request transmitted to General Hospital Abak pharmacy')}
                >
                  <Text style={styles.requestRefillActionText}>Request Pharmacy Refill</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.prescriptionItemCard}>
                <View style={[styles.rxIconCircle, { backgroundColor: '#F1F5F9' }]}>
                  <IconPill size={22} color="#64748B" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.rxDrugName}>Ciprofloxacin 500mg</Text>
                  <Text style={styles.rxDosageText}>Take 1 tablet twice daily</Text>
                  <Text style={styles.rxPrescribedDate}>Prescribed: 14 May 2025</Text>
                  <View style={styles.rxStatusPillGray}>
                    <Text style={styles.rxStatusPillGrayText}>Completed</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* -------------------------------------------------------------------
            5. SUBVIEW: LAB RESULTS (Screen 8)
        ------------------------------------------------------------------- */}
        {subView === 'labResults' && (
          <View style={styles.subViewContainer}>
            {/* Segmented Toggle: Recent / All */}
            <View style={styles.segmentedToggleBox}>
              <TouchableOpacity
                style={[styles.segmentBtn, labsFilter === 'recent' && styles.segmentBtnActive]}
                onPress={() => setLabsFilter('recent')}
              >
                <Text style={[styles.segmentBtnText, labsFilter === 'recent' && styles.segmentBtnTextActive]}>
                  Recent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, labsFilter === 'all' && styles.segmentBtnActive]}
                onPress={() => setLabsFilter('all')}
              >
                <Text style={[styles.segmentBtnText, labsFilter === 'all' && styles.segmentBtnTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
            </View>

            {/* Test Cards (Openable Clinical Documents) */}
            <TouchableOpacity
              style={styles.labResultItemCard}
              activeOpacity={0.82}
              onPress={() => setSelectedResultDoc(DIAGNOSTIC_REPORTS[0])}
            >
              <View style={[styles.labIconCircle, { backgroundColor: '#E0F2FE' }]}>
                <IconFlask size={20} color="#0284C7" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.labTestCardTitle}>Complete Blood Count (CBC)</Text>
                <Text style={styles.labTestCardDate}>5 Aug 2025 • General Hospital Abak</Text>
                <View style={styles.labCardDocHintRow}>
                  <IconDocument size={12} color="#00B4B4" />
                  <Text style={styles.labCardDocHintText}>Certified Medical Report • Tap to Open ↗</Text>
                </View>
              </View>
              <View style={styles.normalBadgePill}>
                <Text style={styles.normalBadgePillText}>Normal</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.labResultItemCard}
              activeOpacity={0.82}
              onPress={() => setSelectedResultDoc(DIAGNOSTIC_REPORTS[1])}
            >
              <View style={[styles.labIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <IconBloodDrop size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.labTestCardTitle}>Blood Sugar (FBS)</Text>
                <Text style={styles.labTestCardDate}>5 Aug 2025 • General Hospital Abak</Text>
                <View style={styles.labCardDocHintRow}>
                  <IconDocument size={12} color="#00B4B4" />
                  <Text style={styles.labCardDocHintText}>Certified Medical Report • Tap to Open ↗</Text>
                </View>
              </View>
              <View style={styles.normalBadgePill}>
                <Text style={styles.normalBadgePillText}>Normal</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.labResultItemCard}
              activeOpacity={0.82}
              onPress={() => setSelectedResultDoc(DIAGNOSTIC_REPORTS[2])}
            >
              <View style={[styles.labIconCircle, { backgroundColor: '#FEE2E2' }]}>
                <IconHeartPulse size={20} color="#DC2626" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.labTestCardTitle}>Lipid Profile</Text>
                <Text style={styles.labTestCardDate}>20 Jun 2025 • General Hospital Abak</Text>
                <View style={styles.labCardDocHintRow}>
                  <IconDocument size={12} color="#00B4B4" />
                  <Text style={styles.labCardDocHintText}>Certified Medical Report • Tap to Open ↗</Text>
                </View>
              </View>
              <View style={styles.normalBadgePill}>
                <Text style={styles.normalBadgePillText}>Normal</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.labResultItemCard}
              activeOpacity={0.82}
              onPress={() => setSelectedResultDoc(DIAGNOSTIC_REPORTS[3])}
            >
              <View style={[styles.labIconCircle, { backgroundColor: '#E0F2FE' }]}>
                <IconBloodDrop size={20} color="#0284C7" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.labTestCardTitle}>Urine Analysis</Text>
                <Text style={styles.labTestCardDate}>3 Apr 2025 • General Hospital Abak</Text>
                <View style={styles.labCardDocHintRow}>
                  <IconDocument size={12} color="#00B4B4" />
                  <Text style={styles.labCardDocHintText}>Certified Medical Report • Tap to Open ↗</Text>
                </View>
              </View>
              <View style={styles.normalBadgePill}>
                <Text style={styles.normalBadgePillText}>Normal</Text>
              </View>
            </TouchableOpacity>

            {/* Need help understanding results CTA Card */}
            <View style={styles.helpDocCtaCard}>
              <View style={styles.helpDocIconSquare}>
                <IconStethoscope size={22} color="#00B4B4" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.helpDocTitle}>Need help understanding your results?</Text>
                <TouchableOpacity
                  onPress={() => {
                    setInVideoCall(true);
                  }}
                >
                  <Text style={styles.helpDocLink}>Contact your doctor →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* -------------------------------------------------------------------
            6. SUBVIEW: NOTIFICATIONS (Screen 10)
        ------------------------------------------------------------------- */}
        {subView === 'notifications' && (
          <View style={styles.subViewContainer}>
            <View style={styles.notificationCardItem}>
              <View style={[styles.notifIconCircle, { backgroundColor: '#DCFCE7' }]}>
                <IconCalendar size={18} color="#059669" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifTitleText}>Appointment Reminder</Text>
                  <Text style={styles.notifTimeTag}>1h ago</Text>
                </View>
                <Text style={styles.notifDescription}>
                  Your appointment with Dr. James Okafor is tomorrow at 09:30 AM.
                </Text>
              </View>
            </View>

            <View style={styles.notificationCardItem}>
              <View style={[styles.notifIconCircle, { backgroundColor: '#FFEDD5' }]}>
                <IconPill size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifTitleText}>Prescription Ready</Text>
                  <Text style={styles.notifTimeTag}>3h ago</Text>
                </View>
                <Text style={styles.notifDescription}>
                  Your prescription is ready for pickup at the General Hospital Abak pharmacy.
                </Text>
              </View>
            </View>

            <View style={styles.notificationCardItem}>
              <View style={[styles.notifIconCircle, { backgroundColor: '#E0F2FE' }]}>
                <IconFlask size={18} color="#0284C7" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifTitleText}>Lab Result Available</Text>
                  <Text style={styles.notifTimeTag}>1d ago</Text>
                </View>
                <Text style={styles.notifDescription}>
                  Your blood test results are now available in your medical records.
                </Text>
              </View>
            </View>

            <View style={styles.notificationCardItem}>
              <View style={[styles.notifIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <IconBell size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifTitleText}>System Notification</Text>
                  <Text style={styles.notifTimeTag}>2d ago</Text>
                </View>
                <Text style={styles.notifDescription}>
                  Welcome to ARISE MEDCORE! We're glad to have you with us.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* -------------------------------------------------------------------
            7. SUBVIEW: SETTINGS (Screen 11)
        ------------------------------------------------------------------- */}
        {subView === 'settings' && (
          <View style={styles.subViewContainer}>
            {/* Language */}
            <TouchableOpacity
              style={styles.settingsMenuRow}
              onPress={() => setShowLangMenu(!showLangMenu)}
            >
              <View style={styles.settingsRowLeft}>
                <View style={{ marginRight: 12 }}>
                  <IconGlobe size={18} color="#0066FF" />
                </View>
                <Text style={styles.settingsRowLabel}>Language</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.settingsRowValue}>
                  {selectedLanguage === 'EN' && 'English'}
                  {selectedLanguage === 'AR' && 'العربية'}
                  {selectedLanguage === 'ES' && 'Español'}
                  {selectedLanguage === 'FR' && 'Français'}
                </Text>
                <IconChevronRight size={16} color="#94A3B8" />
              </View>
            </TouchableOpacity>

            {/* Dark Mode Switch */}
            <View style={styles.settingsMenuRow}>
              <View style={styles.settingsRowLeft}>
                <View style={{ marginRight: 12 }}>
                  <IconMoon size={18} color="#6366F1" />
                </View>
                <Text style={styles.settingsRowLabel}>Dark Mode</Text>
              </View>
              <TouchableOpacity
                style={[styles.switchTrack, isDarkMode ? styles.switchTrackOn : styles.switchTrackOff]}
                onPress={() => {
                  setIsDarkMode(!isDarkMode);
                  showToast(isDarkMode ? 'Light mode enabled' : 'Dark mode enabled');
                }}
              >
                <View style={[styles.switchThumb, isDarkMode ? styles.switchThumbOn : styles.switchThumbOff]} />
              </TouchableOpacity>
            </View>

            {/* Biometric Login Fast-Pass Switch */}
            <View style={styles.settingsMenuRow}>
              <View style={styles.settingsRowLeft}>
                <View style={{ marginRight: 12 }}>
                  <IconFingerprint size={18} color="#00B4B4" />
                </View>
                <View>
                  <Text style={styles.settingsRowLabel}>Biometric Login</Text>
                  <Text style={styles.settingsRowSub}>Fast-Pass on Login Screen</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.switchTrack, isFastPassEnrolled ? styles.switchTrackOn : styles.switchTrackOff]}
                onPress={toggleBiometricEnrollment}
              >
                <View style={[styles.switchThumb, isFastPassEnrolled ? styles.switchThumbOn : styles.switchThumbOff]} />
              </TouchableOpacity>
            </View>

            {/* Data & Privacy */}
            <TouchableOpacity
              style={styles.settingsMenuRow}
              onPress={() => showToast('Data secured with Akwa Ibom State Health Cloud')}
            >
              <View style={styles.settingsRowLeft}>
                <View style={{ marginRight: 12 }}>
                  <IconShield size={18} color="#10B981" />
                </View>
                <Text style={styles.settingsRowLabel}>Data & Privacy</Text>
              </View>
              <IconChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* Terms & Conditions */}
            <TouchableOpacity
              style={styles.settingsMenuRow}
              onPress={() => showToast('Terms: AKS Health Scheme Regulatory Framework')}
            >
              <View style={styles.settingsRowLeft}>
                <View style={{ marginRight: 12 }}>
                  <IconDocument size={18} color="#64748B" />
                </View>
                <Text style={styles.settingsRowLabel}>Terms & Conditions</Text>
              </View>
              <IconChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* About ARISE MEDCORE */}
            <TouchableOpacity
              style={styles.settingsMenuRow}
              onPress={() => showToast('ARISE MEDCORE v2.4.0 • Powered by M87 Health Core')}
            >
              <View style={styles.settingsRowLeft}>
                <View style={{ marginRight: 12 }}>
                  <IconInfo size={18} color="#0284C7" />
                </View>
                <Text style={styles.settingsRowLabel}>About ARISE MEDCORE</Text>
              </View>
              <IconChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.m87SettingsFootnote}>
              <Text style={styles.m87SettingsFootnoteText}>
                ARISE MEDCORE Platform • Powered by <Text style={{ color: '#00A88F', fontWeight: '800' }}>M87</Text> Health Core
              </Text>
            </View>
          </View>
        )}

        {/* ===================================================================
            SUBVIEW: EMERGENCY SOS (Phase 1)
        =================================================================== */}
        {subView === 'emergency' && (
          <View style={styles.subViewContainer}>
            {/* Urgent Dispatch Banner */}
            <View style={styles.emergencyDispatchBanner}>
              <View style={styles.emergencyDispatchPulseDot} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.emergencyDispatchTitle}>24/7 Akwa Ibom Emergency Medical Response</Text>
                <Text style={styles.emergencyDispatchSub}>Statewide Ambulance Dispatch & Triage Command</Text>
              </View>
            </View>

            {/* Giant Central SOS Trigger */}
            <View style={styles.sosCenterWrap}>
              <TouchableOpacity
                style={styles.sosGiantButton}
                activeOpacity={0.82}
                onPress={() => showToast('Calling AKS Emergency Dispatch: 0800-AKS-HEALTH...')}
              >
                <View style={styles.sosPulseOuterRing} />
                <View style={styles.sosPulseInnerCircle}>
                  <Text style={styles.sosBigLabel}>SOS</Text>
                  <Text style={styles.sosTapCallLabel}>TAP TO CALL</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.sosDirectNumber}>0800-AKS-HEALTH</Text>
              <Text style={styles.sosTollFreeHint}>Toll-Free • Available 24 Hours Statewide</Text>
            </View>

            {/* Nearest Facility Card */}
            <View style={styles.nearestFacilityCard}>
              <View style={styles.facilityPinBadge}>
                <IconStethoscope size={18} color="#0066FF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.facilityCardName}>General Hospital Abak (ABK-001)</Text>
                <Text style={styles.facilityCardMeta}>Assigned Facility • 3.2 km away • ER Open</Text>
              </View>
              <TouchableOpacity
                style={styles.facilityNavBtn}
                onPress={() => showToast('Opening turn-by-turn directions to ABK-001')}
              >
                <Text style={styles.facilityNavBtnText}>Directions</Text>
              </TouchableOpacity>
            </View>

            {/* Emergency Contacts List */}
            <Text style={styles.subSectionTitle}>Emergency Contacts</Text>
            {emergencyContacts.map((contact, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.emergencyContactRow}
                activeOpacity={0.8}
                onPress={() => showToast(`Calling ${contact.name}: ${contact.phone}`)}
              >
                <View style={[styles.emergencyContactAvatar, { backgroundColor: contact.color }]}>
                  <IconUser size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.emergencyContactName}>{contact.name}</Text>
                  <Text style={styles.emergencyContactRole}>{contact.role}</Text>
                  <Text style={styles.emergencyContactPhone}>{contact.phone}</Text>
                </View>
                <View style={styles.emergencyCallPill}>
                  <Text style={styles.emergencyCallPillText}>Call</Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* GPS Share Action */}
            <TouchableOpacity
              style={styles.shareGpsBtn}
              activeOpacity={0.85}
              onPress={() => showToast('GPS Coordinates transmitted to AKS Dispatch: 4.9829° N, 7.7891° E')}
            >
              <View style={{ marginRight: 8 }}>
                <IconGlobe size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.shareGpsBtnText}>Share My Live GPS with First Responders</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            SUBVIEW: DIGITAL HEALTH CARD (Phase 1)
        =================================================================== */}
        {subView === 'healthCard' && (
          <View style={styles.subViewContainer}>
            {/* Physical Medical ID Card Canvas */}
            <View style={styles.healthCardPhysical}>
              {/* Card Header */}
              <View style={styles.healthCardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image source={ariseLogo} style={styles.healthCardLogo} resizeMode="contain" />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.healthCardBrandMed}>MED<Text style={styles.healthCardBrandCore}>CORE</Text></Text>
                    <Text style={styles.healthCardBrandSub}>AKWA IBOM STATE HEALTH SCHEME</Text>
                  </View>
                </View>
                <View style={styles.healthCardVerifiedBadge}>
                  <Text style={styles.healthCardVerifiedText}>VERIFIED</Text>
                </View>
              </View>

              {/* Patient Core Info */}
              <View style={styles.healthCardMidSection}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.healthCardLabel}>PATIENT NAME</Text>
                  <Text style={styles.healthCardPatientName}>{patientDisplayName}</Text>

                  <View style={{ flexDirection: 'row', marginTop: 12 }}>
                    <View style={{ marginRight: 24 }}>
                      <Text style={styles.healthCardLabel}>PATIENT ID</Text>
                      <Text style={styles.healthCardValueBold}>{patientId}</Text>
                    </View>
                    <View style={{ marginRight: 24 }}>
                      <Text style={styles.healthCardLabel}>BLOOD GROUP</Text>
                      <Text style={[styles.healthCardValueBold, { color: '#EF4444' }]}>O+ POS</Text>
                    </View>
                    <View>
                      <Text style={styles.healthCardLabel}>GENOTYPE</Text>
                      <Text style={styles.healthCardValueBold}>AA</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.healthCardLabel}>ASSIGNED FACILITY</Text>
                    <Text style={styles.healthCardValue}>ABK-001 • General Hospital Abak</Text>
                  </View>
                </View>

                {/* Simulated 8x8 QR Matrix */}
                <View style={styles.healthCardQRContainer}>
                  <View style={styles.healthCardQRMatrix}>
                    {Array.from({ length: 64 }).map((_, cellIdx) => {
                      const isDark = [
                        0, 1, 2, 5, 6, 7,
                        8, 10, 13, 15,
                        16, 17, 18, 21, 22, 23,
                        24, 27, 29, 31,
                        32, 34, 37, 39,
                        40, 41, 42, 45, 46, 47,
                        48, 50, 52, 55,
                        56, 57, 58, 61, 62, 63,
                      ].includes(cellIdx);
                      return (
                        <View
                          key={cellIdx}
                          style={[
                            styles.healthCardQRCell,
                            { backgroundColor: isDark ? '#0D2B52' : '#FFFFFF' },
                          ]}
                        />
                      );
                    })}
                  </View>
                  <Text style={styles.healthCardQRScanHint}>Scan at Triage</Text>
                </View>
              </View>

              {/* Card Footer */}
              <View style={styles.healthCardFooterRow}>
                <View>
                  <Text style={styles.healthCardFooterLabel}>COVERAGE TIER</Text>
                  <Text style={styles.healthCardFooterValue}>AKSHS Public Scheme (Tier 1)</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.healthCardFooterLabel}>VALID UNTIL</Text>
                  <Text style={styles.healthCardFooterValue}>12 / 2028</Text>
                </View>
              </View>
            </View>

            {/* Clinical Alert & Allergies */}
            <View style={styles.allergyWarningCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <IconShield size={16} color="#DC2626" />
                <Text style={styles.allergyWarningTitle}>Clinical Alerts & Known Allergies</Text>
              </View>
              <Text style={styles.allergyWarningItem}>• Severe Allergy: Penicillin & Beta-Lactams</Text>
              <Text style={styles.allergyWarningItem}>• Mild Sensitivity: NSAIDs (Aspirin, Ibuprofen)</Text>
              <Text style={styles.allergyWarningItem}>• Organ Donor: Registered Beneficiary</Text>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={styles.healthCardActionBtnPrimary}
              activeOpacity={0.85}
              onPress={() => showToast('Official Health Card PDF downloaded')}
            >
              <View style={{ marginRight: 8 }}>
                <IconDocument size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.healthCardActionBtnTextPrimary}>Download Official Health Card (PDF)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.healthCardActionBtnSecondary}
              activeOpacity={0.85}
              onPress={() => showToast('Card added to Apple Wallet / Google Wallet pass')}
            >
              <View style={{ marginRight: 8 }}>
                <IconFingerprint size={16} color="#0D2B52" />
              </View>
              <Text style={styles.healthCardActionBtnTextSecondary}>Add to Smartphone Wallet</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            SUBVIEW: BILLING & PAYMENTS (Phase 1)
        =================================================================== */}
        {subView === 'billing' && (
          <View style={styles.subViewContainer}>
            {/* AKSHS Coverage Summary Card */}
            <View style={styles.billingSummaryCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={styles.billingSummaryScheme}>Akwa Ibom State Health Scheme</Text>
                  <Text style={styles.billingSummaryStatus}>Coverage Status: ACTIVE</Text>
                </View>
                <View style={styles.billingCoveredPill}>
                  <Text style={styles.billingCoveredPillText}>89% Subsidized</Text>
                </View>
              </View>

              <View style={styles.billingDivider} />

              <View style={styles.billingStatRow}>
                <View style={styles.billingStatBox}>
                  <Text style={styles.billingStatLabel}>Total Incurred</Text>
                  <Text style={styles.billingStatVal}>₦14,200</Text>
                </View>
                <View style={styles.billingStatBox}>
                  <Text style={styles.billingStatLabel}>Covered by AKSHS</Text>
                  <Text style={[styles.billingStatVal, { color: '#10B981' }]}>₦12,700</Text>
                </View>
                <View style={styles.billingStatBox}>
                  <Text style={styles.billingStatLabel}>Co-pay Pending</Text>
                  <Text style={[styles.billingStatVal, { color: '#EF4444' }]}>₦1,500</Text>
                </View>
              </View>

              {/* Pay Co-Pay Button */}
              <TouchableOpacity
                style={styles.billingPayNowBtn}
                activeOpacity={0.85}
                onPress={() => showToast('Opening instant payment gateway for ₦1,500 co-pay...')}
              >
                <Text style={styles.billingPayNowBtnText}>Pay Pending Co-Pay (₦1,500)</Text>
              </TouchableOpacity>
            </View>

            {/* Invoices List */}
            <Text style={styles.subSectionTitle}>Recent Invoices & Claims</Text>
            {bills.map((bill) => (
              <View key={bill.id} style={styles.billItemCard}>
                <View style={styles.billIconBox}>
                  <IconDocument size={18} color="#0066FF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.billItemDesc}>{bill.desc}</Text>
                  <Text style={styles.billItemMeta}>{bill.date} • {bill.id}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.billItemAmount}>{bill.amount}</Text>
                  <View style={[styles.billStatusBadge, { backgroundColor: bill.statusColor + '20' }]}>
                    <Text style={[styles.billStatusText, { color: bill.statusColor }]}>{bill.status}</Text>
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.downloadInvoicesBtn}
              activeOpacity={0.85}
              onPress={() => showToast('All tax invoices and claims statements downloaded')}
            >
              <Text style={styles.downloadInvoicesBtnText}>Download Full Claims Statement (PDF)</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            SUBVIEW: MEDICATION REMINDERS (Phase 1)
        =================================================================== */}
        {subView === 'medReminders' && (
          <View style={styles.subViewContainer}>
            {/* Daily Adherence Header */}
            <View style={styles.medAdherenceCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={styles.medAdherenceTitle}>Today's Medication Schedule</Text>
                  <Text style={styles.medAdherenceSub}>2 of 4 taken • 50% Adherence</Text>
                </View>
                <View style={styles.medAdherenceCircle}>
                  <Text style={styles.medAdherenceCircleText}>50%</Text>
                </View>
              </View>
              <View style={styles.medAdherenceBarTrack}>
                <View style={[styles.medAdherenceBarFill, { width: '50%' }]} />
              </View>
            </View>

            {/* Schedule List */}
            <Text style={styles.subSectionTitle}>Prescribed Medications</Text>
            {medSchedule.map((med, idx) => (
              <View key={idx} style={[styles.medScheduleCard, med.taken && styles.medScheduleCardTaken]}>
                <View style={[styles.medScheduleIconCircle, { backgroundColor: med.color + '20' }]}>
                  <IconPill size={20} color={med.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.medScheduleName}>{med.name}</Text>
                  <Text style={styles.medScheduleNote}>{med.note}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <IconClock size={12} color="#64748B" />
                    <Text style={styles.medScheduleTime}>{med.time}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.medActionPill, med.taken ? styles.medActionPillTaken : styles.medActionPillDue]}
                  onPress={() => showToast(med.taken ? `${med.name} was already taken` : `Marked ${med.name} as taken!`)}
                >
                  <Text style={[styles.medActionPillText, { color: med.taken ? '#10B981' : '#0066FF' }]}>
                    {med.taken ? 'Taken' : 'Mark Taken'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Pharmacy Refill Order */}
            <TouchableOpacity
              style={styles.refillPrescriptionBtn}
              activeOpacity={0.85}
              onPress={() => showToast('Order submitted to General Hospital Abak Pharmacy')}
            >
              <View style={{ marginRight: 8 }}>
                <IconPill size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.refillPrescriptionBtnText}>Order Refill from Hospital Pharmacy</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            SUBVIEW: HEALTH VITALS TRACKER (Phase 2)
        =================================================================== */}
        {subView === 'vitals' && (
          <View style={styles.subViewContainer}>
            {/* Top Vitals 4-Grid Cards */}
            <View style={styles.vitalsSummaryGrid}>
              <View style={styles.vitalsSummaryCard}>
                <View style={[styles.vitalsIconCircle, { backgroundColor: '#FEE2E2' }]}>
                  <IconHeartPulse size={16} color="#EF4444" />
                </View>
                <Text style={styles.vitalsMetricValue}>118/76</Text>
                <Text style={styles.vitalsMetricLabel}>Blood Pressure (mmHg)</Text>
                <Text style={styles.vitalsStatusTag}>Normal</Text>
              </View>

              <View style={styles.vitalsSummaryCard}>
                <View style={[styles.vitalsIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <IconBloodDrop size={16} color="#0284C7" />
                </View>
                <Text style={styles.vitalsMetricValue}>5.2</Text>
                <Text style={styles.vitalsMetricLabel}>Fasting Glucose (mmol/L)</Text>
                <Text style={styles.vitalsStatusTag}>Optimal</Text>
              </View>

              <View style={styles.vitalsSummaryCard}>
                <View style={[styles.vitalsIconCircle, { backgroundColor: '#F3E8FF' }]}>
                  <IconUser size={16} color="#7C3AED" />
                </View>
                <Text style={styles.vitalsMetricValue}>72.0</Text>
                <Text style={styles.vitalsMetricLabel}>Body Weight (kg)</Text>
                <Text style={styles.vitalsStatusTag}>BMI 22.8</Text>
              </View>

              <View style={styles.vitalsSummaryCard}>
                <View style={[styles.vitalsIconCircle, { backgroundColor: '#DCFCE7' }]}>
                  <IconHeartPulse size={16} color="#10B981" />
                </View>
                <Text style={styles.vitalsMetricValue}>74</Text>
                <Text style={styles.vitalsMetricLabel}>Resting Pulse (bpm)</Text>
                <Text style={styles.vitalsStatusTag}>Steady</Text>
              </View>
            </View>

            {/* Historical Log */}
            <Text style={styles.subSectionTitle}>Vitals Log History</Text>
            {vitalsLog.map((log, idx) => (
              <View key={idx} style={styles.vitalsLogRowCard}>
                <View style={styles.vitalsLogDateHeader}>
                  <Text style={styles.vitalsLogDateText}>{log.date}</Text>
                  <Text style={styles.vitalsLogClinicalBadge}>Verified Reading</Text>
                </View>
                <View style={styles.vitalsDataGrid}>
                  <View style={styles.vitalsDataCell}>
                    <Text style={styles.vitalsDataValue}>{log.bp}</Text>
                    <Text style={styles.vitalsDataLabel}>BP</Text>
                  </View>
                  <View style={styles.vitalsDataCell}>
                    <Text style={styles.vitalsDataValue}>{log.glucose}</Text>
                    <Text style={styles.vitalsDataLabel}>Glucose</Text>
                  </View>
                  <View style={styles.vitalsDataCell}>
                    <Text style={styles.vitalsDataValue}>{log.weight}</Text>
                    <Text style={styles.vitalsDataLabel}>Weight</Text>
                  </View>
                  <View style={styles.vitalsDataCell}>
                    <Text style={styles.vitalsDataValue}>{log.temp}</Text>
                    <Text style={styles.vitalsDataLabel}>Temp</Text>
                  </View>
                  <View style={styles.vitalsDataCell}>
                    <Text style={styles.vitalsDataValue}>{log.pulse}</Text>
                    <Text style={styles.vitalsDataLabel}>Pulse</Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Add Reading Button */}
            <TouchableOpacity
              style={styles.logVitalsActionBtn}
              activeOpacity={0.85}
              onPress={() => showToast('New vitals reading logged successfully')}
            >
              <View style={{ marginRight: 8 }}>
                <IconPlus size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.logVitalsActionBtnText}>Log Today's Vitals Reading</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            SUBVIEW: FEEDBACK & ENGAGEMENT (Phase 2)
        =================================================================== */}
        {subView === 'feedback' && (
          <View style={styles.subViewContainer}>
            {/* Feedback Context Card */}
            <View style={styles.feedbackHeaderCard}>
              <Text style={styles.feedbackTargetDoctor}>Dr. James Okafor</Text>
              <Text style={styles.feedbackTargetFacility}>General Hospital Abak (ABK-001)</Text>
              <Text style={styles.feedbackTargetDate}>General Checkup • 9 Sep 2025</Text>
            </View>

            {/* Star Rating Section */}
            <View style={styles.feedbackRatingSection}>
              <Text style={styles.feedbackRatePrompt}>How was your overall consultation experience?</Text>
              <View style={styles.feedbackStarsRow}>
                {[1, 2, 3, 4, 5].map((starNum) => (
                  <TouchableOpacity
                    key={starNum}
                    style={styles.starTouchItem}
                    activeOpacity={0.7}
                    onPress={() => setFeedbackRating(starNum)}
                  >
                    <IconStar
                      size={36}
                      color={starNum <= feedbackRating ? '#F59E0B' : '#E2E8F0'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.feedbackStarCountLabel}>
                {feedbackRating === 0 && 'Tap a star to rate'}
                {feedbackRating === 1 && 'Poor experience'}
                {feedbackRating === 2 && 'Fair consultation'}
                {feedbackRating === 3 && 'Good service'}
                {feedbackRating === 4 && 'Very satisfactory'}
                {feedbackRating === 5 && 'Outstanding care!'}
              </Text>
            </View>

            {/* Quick Feedback Tags */}
            <Text style={styles.subSectionTitle}>What went well?</Text>
            <View style={styles.feedbackTagsWrap}>
              {['Short Wait Time', 'Doctor Listened Attentively', 'Clean Facility', 'Prescriptions Explained', 'Caring Nurses'].map((tag, tIdx) => (
                <TouchableOpacity
                  key={tIdx}
                  style={styles.feedbackTagChip}
                  onPress={() => showToast(`Selected tag: ${tag}`)}
                >
                  <Text style={styles.feedbackTagChipText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Multiline Input */}
            <Text style={styles.subSectionTitle}>Additional Comments</Text>
            <TextInput
              style={styles.feedbackTextInput}
              placeholder="Tell us about your experience or suggest improvements..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              value={feedbackText}
              onChangeText={setFeedbackText}
              textAlignVertical="top"
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.feedbackSubmitBtn}
              activeOpacity={0.85}
              onPress={() => {
                showToast('Thank you! Your feedback has been sent to the AKS Quality Committee.');
                setFeedbackRating(0);
                setFeedbackText('');
                setSubView('none');
              }}
            >
              <Text style={styles.feedbackSubmitBtnText}>Submit Patient Feedback</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            SUBVIEW: MEDICAL TOURISM HUB (Phase 2)
        =================================================================== */}
        {subView === 'tourismHub' && (
          <View style={styles.subViewContainer}>
            {/* Hero Card */}
            <View style={styles.tourismHeroCard}>
              <View style={styles.tourismHeroBadge}>
                <Text style={styles.tourismHeroBadgeText}>INTERNATIONAL PATIENT SERVICES</Text>
              </View>
              <Text style={styles.tourismHeroTitle}>Akwa Ibom State Medical Tourism Hub</Text>
              <Text style={styles.tourismHeroSub}>
                Specialist tertiary care, surgical excellence, and full concierge logistics in Nigeria's cleanest, safest state.
              </Text>
            </View>

            {/* Hub Services */}
            <Text style={styles.subSectionTitle}>Specialized Concierge Services</Text>

            <TouchableOpacity
              style={styles.tourismServiceCard}
              activeOpacity={0.8}
              onPress={() => showToast('Opening Travel Coordination: Flights, Visas & VIP Airport Protocol')}
            >
              <View style={[styles.tourismServiceIcon, { backgroundColor: '#EFF6FF' }]}>
                <IconGlobe size={22} color="#0066FF" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.tourismServiceTitle}>Travel & Medical Visas</Text>
                <Text style={styles.tourismServiceDesc}>
                  Victor Attah International Airport (UYO) VIP tarmac protocol, fast-track visas, and dedicated patient transfer.
                </Text>
              </View>
              <IconChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tourismServiceCard}
              activeOpacity={0.8}
              onPress={() => showToast('Opening Partner Accommodations & Recovery Suites')}
            >
              <View style={[styles.tourismServiceIcon, { backgroundColor: '#F0FDF4' }]}>
                <IconHome size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.tourismServiceTitle}>Accommodations & Recovery Suites</Text>
                <Text style={styles.tourismServiceDesc}>
                  Partner luxury 4-star hotels and private postoperative recovery villas near Ibom Specialist Hospital.
                </Text>
              </View>
              <IconChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tourismServiceCard}
              activeOpacity={0.8}
              onPress={() => showToast('Connecting to Medical Translation Desk')}
            >
              <View style={[styles.tourismServiceIcon, { backgroundColor: '#FDF4FF' }]}>
                <IconDocument size={22} color="#A855F7" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.tourismServiceTitle}>Medical Interpreters</Text>
                <Text style={styles.tourismServiceDesc}>
                  Certified clinical interpreters in French, Spanish, German, Mandarin, and Arabic for international care pathways.
                </Text>
              </View>
              <IconChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tourismServiceCard}
              activeOpacity={0.8}
              onPress={() => showToast('Calling 24/7 Concierge Care Coordinator')}
            >
              <View style={[styles.tourismServiceIcon, { backgroundColor: '#FFFBEB' }]}>
                <IconUser size={22} color="#F59E0B" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.tourismServiceTitle}>24/7 Concierge Care Team</Text>
                <Text style={styles.tourismServiceDesc}>
                  Personal clinical liaison, specialized dietary planning, and bedside family support throughout your stay.
                </Text>
              </View>
              <IconChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* Tourism Contact Desk Button */}
            <TouchableOpacity
              style={styles.tourismContactBtn}
              activeOpacity={0.85}
              onPress={() => showToast('Connecting with International Patient Liaison Desk: +234-800-ARISE-INTL')}
            >
              <Text style={styles.tourismContactBtnText}>Contact Tourism Liaison Desk</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            SUBVIEW: IMMUNIZATION RECORDS (Phase 2)
        =================================================================== */}
        {subView === 'immunization' && (
          <View style={styles.subViewContainer}>
            {/* Registry Info Card */}
            <View style={styles.immunizationHeaderCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.yellowCardBadge}>
                  <IconShield size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.immunizationRegistryTitle}>Electronic Immunization Registry</Text>
                  <Text style={styles.immunizationRegistrySub}>WHO International Certificate (Yellow Card) Compatible</Text>
                </View>
              </View>
            </View>

            {/* Vaccines List */}
            <Text style={styles.subSectionTitle}>Vaccination History</Text>
            {immunizations.map((item, idx) => (
              <View key={idx} style={styles.immunizationRowCard}>
                <View style={[styles.immunizationDot, { backgroundColor: item.color }]} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.immunizationVaccine}>{item.vaccine}</Text>
                  <Text style={styles.immunizationMeta}>{item.dose} • {item.date}</Text>
                </View>
                <View style={[styles.immunizationStatusPill, { backgroundColor: item.color + '20' }]}>
                  <Text style={[styles.immunizationStatusText, { color: item.color }]}>{item.status}</Text>
                </View>
              </View>
            ))}

            {/* Schedule Vaccine Button */}
            <TouchableOpacity
              style={styles.scheduleVaccineBtn}
              activeOpacity={0.85}
              onPress={() => showToast('Scheduling vaccination slot at General Hospital Abak')}
            >
              <View style={{ marginRight: 8 }}>
                <IconPlus size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.scheduleVaccineBtnText}>Schedule Vaccination Appointment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.downloadYellowCardBtn}
              activeOpacity={0.85}
              onPress={() => showToast('Official WHO International Certificate of Vaccination downloaded')}
            >
              <Text style={styles.downloadYellowCardBtnText}>Download WHO Yellow Card (PDF)</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            SUBVIEW: FAMILY & DEPENDENTS (Phase 3)
        =================================================================== */}
        {subView === 'family' && (
          <View style={styles.subViewContainer}>
            {/* Family Plan Banner */}
            <View style={styles.familyBannerCard}>
              <View>
                <Text style={styles.familyBannerTitle}>AKSHS Family Benefit Plan</Text>
                <Text style={styles.familyBannerSub}>3 Dependents Active • Full Primary Healthcare Covered</Text>
              </View>
              <View style={styles.familyBadgePublic}>
                <Text style={styles.familyBadgePublicText}>Public Scheme</Text>
              </View>
            </View>

            {/* Dependents List */}
            <Text style={styles.subSectionTitle}>Registered Family Members</Text>
            {familyMembers.map((member, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.familyMemberCard}
                activeOpacity={0.85}
                onPress={() => showToast(`Switched chart to ${member.name} (${member.id})`)}
              >
                <View style={[styles.familyMemberAvatar, { backgroundColor: member.color }]}>
                  <Text style={styles.familyMemberInitials}>{member.initials}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.familyMemberName}>{member.name}</Text>
                  <Text style={styles.familyMemberRelation}>{member.relation} • DOB: {member.dob}</Text>
                  <Text style={styles.familyMemberId}>{member.id}</Text>
                </View>
                <View style={styles.switchChartPill}>
                  <Text style={styles.switchChartPillText}>Switch</Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* Add Family Member Button */}
            <TouchableOpacity
              style={styles.addFamilyMemberBtn}
              activeOpacity={0.85}
              onPress={() => showToast('Opening AKS Dependent Registration Portal')}
            >
              <View style={{ marginRight: 8 }}>
                <IconPlus size={16} color="#0066FF" />
              </View>
              <Text style={styles.addFamilyMemberBtnText}>+ Register New Dependent</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            SUBVIEW: MENTAL HEALTH & WELLNESS (Phase 3)
        =================================================================== */}
        {subView === 'mentalHealth' && (
          <View style={styles.subViewContainer}>
            {/* Daily Mood Check-In */}
            <View style={styles.mentalMoodCard}>
              <Text style={styles.mentalMoodTitle}>Daily Mental Wellness Check-In</Text>
              <Text style={styles.mentalMoodSub}>How are you feeling right now?</Text>

              <View style={styles.moodSelectorRow}>
                {[
                  { id: 1, label: 'Low', color: '#EF4444' },
                  { id: 2, label: 'Uneasy', color: '#F97316' },
                  { id: 3, label: 'Steady', color: '#EAB308' },
                  { id: 4, label: 'Good', color: '#10B981' },
                  { id: 5, label: 'Thriving', color: '#06B6D4' },
                ].map((mood) => (
                  <TouchableOpacity
                    key={mood.id}
                    style={styles.moodButtonCol}
                    activeOpacity={0.75}
                    onPress={() => {
                      setMoodToday(mood.id);
                      showToast(`Mood recorded: ${mood.label}. Thank you for checking in.`);
                    }}
                  >
                    <View
                      style={[
                        styles.moodCircle,
                        { borderColor: mood.color },
                        moodToday === mood.id && { backgroundColor: mood.color },
                      ]}
                    >
                      <View style={[styles.moodInnerDot, { backgroundColor: moodToday === mood.id ? '#FFFFFF' : mood.color }]} />
                    </View>
                    <Text style={[styles.moodLabelText, moodToday === mood.id && { color: mood.color, fontWeight: '800' }]}>
                      {mood.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 24/7 Helpline Card */}
            <View style={styles.crisisHelplineCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.crisisHelplineIcon}>
                  <IconHeartPulse size={18} color="#DC2626" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.crisisHelplineTitle}>24/7 Akwa Ibom Mental Wellness Helpline</Text>
                  <Text style={styles.crisisHelplineNumber}>0800-ARISE-MIND</Text>
                </View>
              </View>
              <Text style={styles.crisisHelplineDesc}>
                Free, 100% confidential support with licensed clinical psychologists and counsellors.
              </Text>
              <TouchableOpacity
                style={styles.crisisCallBtn}
                onPress={() => showToast('Dialing AKS Mental Wellness Helpline: 0800-ARISE-MIND')}
              >
                <Text style={styles.crisisCallBtnText}>Call 0800-ARISE-MIND</Text>
              </TouchableOpacity>
            </View>

            {/* Guided Tools */}
            <Text style={styles.subSectionTitle}>Guided Mind & Calm Resources</Text>
            {[
              { title: '5-Minute Box Breathing', sub: 'Instant anxiety reduction and autonomic stabilization', color: '#00B4B4' },
              { title: 'Sleep Hygiene & Rest Guide', sub: 'Evidence-based protocols for deep regenerative sleep', color: '#6366F1' },
              { title: 'Caregiver Stress Management', sub: 'Tools to prevent emotional burnout and fatigue', color: '#10B981' },
              { title: 'Post-Partum Emotional Support', sub: 'Specialized maternal mental health guidance', color: '#EC4899' },
            ].map((res, rIdx) => (
              <TouchableOpacity
                key={rIdx}
                style={styles.mentalResourceRow}
                activeOpacity={0.8}
                onPress={() => showToast(`Starting session: ${res.title}`)}
              >
                <View style={[styles.mentalResourceIconCircle, { backgroundColor: res.color + '20' }]}>
                  <IconLeaf size={18} color={res.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.mentalResourceTitle}>{res.title}</Text>
                  <Text style={styles.mentalResourceSub}>{res.sub}</Text>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.bookTherapyBtn}
              activeOpacity={0.85}
              onPress={() => showToast('Booking confidential consultation with Clinical Psychologist')}
            >
              <Text style={styles.bookTherapyBtnText}>Book Confidential Therapy Consultation</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            SUBVIEW: HEALTH EDUCATION HUB (Phase 3)
        =================================================================== */}
        {subView === 'healthEdu' && (
          <View style={styles.subViewContainer}>
            {/* Header Card */}
            <View style={styles.eduHeaderCard}>
              <View style={styles.eduVerifiedBadge}>
                <Text style={styles.eduVerifiedBadgeText}>MINISTRY OF HEALTH VERIFIED</Text>
              </View>
              <Text style={styles.eduHeaderTitle}>Akwa Ibom Health Education Library</Text>
              <Text style={styles.eduHeaderSub}>
                Clinically reviewed preventive health guides tailored for our communities.
              </Text>
            </View>

            {/* Article Cards */}
            <Text style={styles.subSectionTitle}>Featured Health Guides</Text>
            {[
              {
                title: 'Managing High Blood Pressure: Diet & Salt Reduction',
                category: 'Cardiovascular Health',
                readTime: '4 min read',
                color: '#EF4444',
                bg: '#FEE2E2',
                excerpt: 'Simple daily lifestyle adjustments to protect your heart and blood vessels.',
              },
              {
                title: 'Diabetes Prevention with Local Nigerian Ingredients',
                category: 'Metabolic Care',
                readTime: '6 min read',
                color: '#F59E0B',
                bg: '#FEF3C7',
                excerpt: 'How fiber-rich local staples help regulate fasting blood glucose naturally.',
              },
              {
                title: 'Malaria Vector Prevention & Seasonal Treatment',
                category: 'Infectious Disease',
                readTime: '5 min read',
                color: '#10B981',
                bg: '#DCFCE7',
                excerpt: 'Effective bed-net usage, early testing, and Artemisinin-based combinations.',
              },
              {
                title: 'Maternal Nutrition: The First 1,000 Days',
                category: 'Maternal & Child',
                readTime: '7 min read',
                color: '#EC4899',
                bg: '#FCE7F3',
                excerpt: 'Essential micronutrients and antenatal care schedules in Akwa Ibom State.',
              },
              {
                title: 'Understanding Glaucoma: Preventing Silent Vision Loss',
                category: 'Eye Care',
                readTime: '4 min read',
                color: '#0284C7',
                bg: '#E0F2FE',
                excerpt: 'Why regular intraocular pressure checks save eyesight before symptoms emerge.',
              },
            ].map((art, aIdx) => (
              <TouchableOpacity
                key={aIdx}
                style={styles.eduArticleCard}
                activeOpacity={0.85}
                onPress={() => showToast(`Opening article: ${art.title}`)}
              >
                <View style={[styles.eduArticleBadge, { backgroundColor: art.bg }]}>
                  <IconDocument size={20} color={art.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.eduArticleCategory, { color: art.color }]}>{art.category}</Text>
                    <Text style={styles.eduArticleReadTime}>{art.readTime}</Text>
                  </View>
                  <Text style={styles.eduArticleTitle}>{art.title}</Text>
                  <Text style={styles.eduArticleExcerpt}>{art.excerpt}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ===================================================================
            8. PRIMARY TAB 1: HOME (Screen 2 - Glassy UX Architecture)
        =================================================================== */}
        {subView === 'none' && activeTab === 'home' && (
          <View style={styles.tabContentArea}>
            {/* 1. GLASS GREETING & PATIENT ID BADGE */}
            <View style={styles.glassGreetingCard}>
              <View style={{ flex: 1 }}>
                <View style={styles.glassSchemeBadge}>
                  <View style={styles.glassSchemePulseDot} />
                  <Text style={styles.glassSchemeBadgeText}>AKSHS BENEFICIARY ACTIVE</Text>
                </View>
                <Text style={styles.glassGreetingName}>{patientDisplayName}</Text>
                <Text style={styles.glassGreetingTagline}>Your health matters • We are here for you</Text>
              </View>
              <TouchableOpacity
                style={styles.glassAvatarCircle}
                onPress={() => setActiveTab('profile')}
                activeOpacity={0.8}
              >
                <Text style={styles.glassAvatarText}>{patientInitials}</Text>
                <View style={styles.glassAvatarOnlineDot} />
              </TouchableOpacity>
            </View>

            {/* 2. URGENT SOS EMERGENCY RIBBON (Sleek Glass Strip) */}
            <TouchableOpacity
              style={styles.glassSosRibbon}
              onPress={() => setSubView('emergency')}
              activeOpacity={0.88}
            >
              <View style={styles.glassSosLeft}>
                <View style={styles.glassSosBeacon}>
                  <View style={styles.glassSosBeaconInner} />
                </View>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.glassSosTitle}>EMERGENCY SOS RESPONSE</Text>
                  <Text style={styles.glassSosSub}>24/7 Dispatch: 0800-AKS-HEALTH</Text>
                </View>
              </View>
              <View style={styles.glassSosActionBtn}>
                <Text style={styles.glassSosActionBtnText}>Triage</Text>
                <IconChevronRight size={13} color="#DC2626" />
              </View>
            </TouchableOpacity>

            {/* 3. HERO GLASS APPOINTMENT & TELEHEALTH CARD (Deep Navy Glass) */}
            <View style={styles.heroGlassApptCard}>
              <View style={styles.heroGlassGlowDeco} />
              <View style={styles.heroGlassTopRow}>
                <View style={styles.heroGlassLivePill}>
                  <View style={styles.heroGlassPulseDot} />
                  <Text style={styles.heroGlassLiveText}>LIVE TELEHEALTH CONSULTATION</Text>
                </View>
                <View style={styles.heroGlassStatusBadge}>
                  <Text style={styles.heroGlassStatusText}>Confirmed</Text>
                </View>
              </View>

              <Text style={styles.heroGlassDocName}>Dr. James Okafor</Text>
              <Text style={styles.heroGlassSpecialty}>General Checkup & Diagnostics Review</Text>
              <Text style={styles.heroGlassFacility}>General Hospital Abak (ABK-001) • Hospital Road</Text>

              <View style={styles.heroGlassTimePillRow}>
                <View style={styles.heroGlassTimeItem}>
                  <IconCalendar size={13} color="#93C5FD" />
                  <Text style={styles.heroGlassTimeText}>Mon, 9 Sep 2025</Text>
                </View>
                <View style={styles.heroGlassTimeItem}>
                  <IconClock size={13} color="#93C5FD" />
                  <Text style={styles.heroGlassTimeText}>09:30 AM</Text>
                </View>
              </View>

              <View style={styles.heroGlassActionRow}>
                <TouchableOpacity
                  style={styles.heroGlassPrimaryBtn}
                  onPress={() => setInVideoCall(true)}
                  activeOpacity={0.85}
                >
                  <View style={{ marginRight: 6 }}>
                    <IconStethoscope size={15} color="#FFFFFF" />
                  </View>
                  <Text style={styles.heroGlassPrimaryBtnText}>Join Video Consultation</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.heroGlassSecondaryBtn}
                  onPress={() => setActiveTab('appointments')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.heroGlassSecondaryBtnText}>Details</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── CATEGORY 1: CLINICAL ACTIONS ── */}
            <View style={styles.glassCategorySection}>
              <View style={styles.glassCategoryHeader}>
                <View style={[styles.glassCatIconDot, { backgroundColor: 'rgba(0, 102, 255, 0.12)' }]}>
                  <IconStethoscope size={13} color="#0066FF" />
                </View>
                <Text style={styles.glassCategoryTitle}>Clinical Actions</Text>
                <View style={styles.glassCategoryBadge}>
                  <Text style={styles.glassCategoryBadgeText}>4 features</Text>
                </View>
              </View>
              <View style={styles.glassGrid2x2}>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('bookStep1')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.16)' }]}>
                    <IconCalendar size={22} color="#059669" />
                  </View>
                  <Text style={styles.glassTileTitle}>Book Visit</Text>
                  <Text style={styles.glassTileSub}>Find doctors & slots</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setInVideoCall(true)} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(0, 102, 255, 0.16)' }]}>
                    <IconStethoscope size={22} color="#0066FF" />
                  </View>
                  <Text style={styles.glassTileTitle}>Telehealth</Text>
                  <Text style={styles.glassTileSub}>Join video consult</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('labResults')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(2, 132, 199, 0.16)' }]}>
                    <IconFlask size={22} color="#0284C7" />
                  </View>
                  <Text style={styles.glassTileTitle}>Lab Results</Text>
                  <Text style={styles.glassTileSub}>CBC & panel reports</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('prescriptions')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(249, 115, 22, 0.16)' }]}>
                    <IconPill size={22} color="#EA580C" />
                  </View>
                  <Text style={styles.glassTileTitle}>Prescriptions</Text>
                  <Text style={styles.glassTileSub}>Refills & dosages</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── CATEGORY 2: HEALTH MANAGEMENT ── */}
            <View style={styles.glassCategorySection}>
              <View style={styles.glassCategoryHeader}>
                <View style={[styles.glassCatIconDot, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <IconHeartPulse size={13} color="#EF4444" />
                </View>
                <Text style={styles.glassCategoryTitle}>Health Management</Text>
                <View style={styles.glassCategoryBadge}>
                  <Text style={styles.glassCategoryBadgeText}>4 features</Text>
                </View>
              </View>
              <View style={styles.glassGrid2x2}>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('vitals')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.16)' }]}>
                    <IconHeartPulse size={22} color="#EF4444" />
                  </View>
                  <Text style={styles.glassTileTitle}>Vitals Tracker</Text>
                  <Text style={styles.glassTileSub}>118/76 · Normal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('medReminders')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(0, 102, 255, 0.16)' }]}>
                    <IconBell size={22} color="#0066FF" />
                  </View>
                  <Text style={styles.glassTileTitle}>Med Reminders</Text>
                  <Text style={styles.glassTileSub}>2 of 4 taken today</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('immunization')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(217, 119, 6, 0.16)' }]}>
                    <IconShield size={22} color="#D97706" />
                  </View>
                  <Text style={styles.glassTileTitle}>Immunization</Text>
                  <Text style={styles.glassTileSub}>WHO Yellow Card</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('mentalHealth')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(0, 180, 180, 0.16)' }]}>
                    <IconLeaf size={22} color="#00B4B4" />
                  </View>
                  <Text style={styles.glassTileTitle}>Mental Wellness</Text>
                  <Text style={styles.glassTileSub}>Mind check-in</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── CATEGORY 3: CARE SERVICES ── */}
            <View style={styles.glassCategorySection}>
              <View style={styles.glassCategoryHeader}>
                <View style={[styles.glassCatIconDot, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <IconGlobe size={13} color="#F59E0B" />
                </View>
                <Text style={styles.glassCategoryTitle}>Care Services</Text>
                <View style={styles.glassCategoryBadge}>
                  <Text style={styles.glassCategoryBadgeText}>4 features</Text>
                </View>
              </View>
              <View style={styles.glassGrid2x2}>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('tourismHub')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.16)' }]}>
                    <IconGlobe size={22} color="#F59E0B" />
                  </View>
                  <Text style={styles.glassTileTitle}>Tourism Hub</Text>
                  <Text style={styles.glassTileSub}>VIP Concierge</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('family')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.16)' }]}>
                    <IconUser size={22} color="#6366F1" />
                  </View>
                  <Text style={styles.glassTileTitle}>Family Care</Text>
                  <Text style={styles.glassTileSub}>3 Dependents</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('healthEdu')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(2, 132, 199, 0.16)' }]}>
                    <IconDocument size={22} color="#0284C7" />
                  </View>
                  <Text style={styles.glassTileTitle}>Health Guides</Text>
                  <Text style={styles.glassTileSub}>Preventive tips</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('feedback')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(234, 179, 8, 0.16)' }]}>
                    <IconStar size={22} color="#EAB308" />
                  </View>
                  <Text style={styles.glassTileTitle}>Visit Feedback</Text>
                  <Text style={styles.glassTileSub}>Rate your doctor</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── CATEGORY 4: RECORDS & ADMIN ── */}
            <View style={styles.glassCategorySection}>
              <View style={styles.glassCategoryHeader}>
                <View style={[styles.glassCatIconDot, { backgroundColor: 'rgba(124, 58, 237, 0.12)' }]}>
                  <IconDocument size={13} color="#7C3AED" />
                </View>
                <Text style={styles.glassCategoryTitle}>Records & Admin</Text>
                <View style={styles.glassCategoryBadge}>
                  <Text style={styles.glassCategoryBadgeText}>4 features</Text>
                </View>
              </View>
              <View style={styles.glassGrid2x2}>
                <TouchableOpacity style={styles.glassTile} onPress={() => setActiveTab('records')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(124, 58, 237, 0.16)' }]}>
                    <IconDocument size={22} color="#7C3AED" />
                  </View>
                  <Text style={styles.glassTileTitle}>Medical Records</Text>
                  <Text style={styles.glassTileSub}>FHIR-certified charts</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('healthCard')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(13, 43, 82, 0.12)' }]}>
                    <IconFingerprint size={22} color="#0D2B52" />
                  </View>
                  <Text style={styles.glassTileTitle}>Health Card</Text>
                  <Text style={styles.glassTileSub}>Digital QR ID</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('billing')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.16)' }]}>
                    <IconShield size={22} color="#10B981" />
                  </View>
                  <Text style={styles.glassTileTitle}>Billing & Scheme</Text>
                  <Text style={styles.glassTileSub}>89% Subsidized</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassTile} onPress={() => setSubView('referrals')} activeOpacity={0.84}>
                  <View style={[styles.glassTileIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                    <IconInfo size={22} color="#F59E0B" />
                  </View>
                  <Text style={styles.glassTileTitle}>Referrals</Text>
                  <Text style={styles.glassTileSub}>Specialist access</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 6. DAILY VITALS SNAPSHOT (Glass Widget) */}
            <View style={styles.glassVitalsWidget}>
              <View style={styles.glassVitalsTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.glassVitalsDot} />
                  <Text style={styles.glassVitalsTitle}>Today's Clinical Vitals</Text>
                </View>
                <TouchableOpacity onPress={() => setSubView('vitals')}>
                  <Text style={styles.glassVitalsLink}>Log Reading →</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.glassVitalsPillsRow}>
                <View style={styles.glassVitalItemPill}>
                  <Text style={styles.glassVitalItemLabel}>BLOOD PRESSURE</Text>
                  <Text style={styles.glassVitalItemVal}>118/76</Text>
                  <Text style={styles.glassVitalItemTag}>Normal</Text>
                </View>
                <View style={styles.glassVitalItemPill}>
                  <Text style={styles.glassVitalItemLabel}>FASTING GLUCOSE</Text>
                  <Text style={styles.glassVitalItemVal}>5.2</Text>
                  <Text style={styles.glassVitalItemTag}>Optimal</Text>
                </View>
                <View style={styles.glassVitalItemPill}>
                  <Text style={styles.glassVitalItemLabel}>RESTING PULSE</Text>
                  <Text style={styles.glassVitalItemVal}>74</Text>
                  <Text style={styles.glassVitalItemTag}>Steady</Text>
                </View>
              </View>
            </View>

            {/* 6B. LATEST DIAGNOSTIC REPORT (Openable Document Card on Dashboard) */}
            <View style={styles.glassSectionHeaderRow}>
              <Text style={styles.glassSectionTitle}>Latest Diagnostic Report</Text>
              <TouchableOpacity onPress={() => setSubView('labResults')}>
                <Text style={styles.glassSectionLink}>All Results (4) →</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.glassLatestDocCard}
              activeOpacity={0.88}
              onPress={() => setSelectedResultDoc(DIAGNOSTIC_REPORTS[0])}
            >
              <View style={styles.glassLatestDocTopRow}>
                <View style={styles.glassLatestDocBadge}>
                  <View style={styles.glassDocGreenDot} />
                  <Text style={styles.glassLatestDocBadgeText}>OFFICIAL REPORT READY</Text>
                </View>
                <View style={styles.glassCertifiedPill}>
                  <Text style={styles.glassCertifiedPillText}>ISO 15189 Certified</Text>
                </View>
              </View>

              <View style={styles.glassLatestDocBodyRow}>
                <View style={styles.glassLatestDocIconBox}>
                  <IconDocument size={24} color="#00B4B4" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.glassLatestDocTitle}>Complete Blood Count (CBC) with 5-Diff</Text>
                  <Text style={styles.glassLatestDocMeta}>
                    ABK-001 Pathology • 5 Aug 2025 • Acc: LAB-2025-08051
                  </Text>
                  <View style={styles.glassLatestDocParamsRow}>
                    <Text style={styles.glassLatestDocParamChip}>WBC: 6.4 10⁹/L</Text>
                    <Text style={styles.glassLatestDocParamChip}>HGB: 14.8 g/dL</Text>
                    <Text style={styles.glassLatestDocParamChip}>PLT: 245 10⁹/L</Text>
                  </View>
                </View>
              </View>

              <View style={styles.glassLatestDocActionRow}>
                <Text style={styles.glassLatestDocOpenText}>Tap to Open Document & Full Clinical Parameters</Text>
                <View style={styles.glassLatestDocArrowCircle}>
                  <IconChevronRight size={13} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>

            {/* 7. ASSIGNED FACILITY & CARE NAVIGATION PROTOCOL (Glass Card) */}
            <View style={styles.glassFacilityCard}>
              <View style={styles.glassFacilityHeader}>
                <View>
                  <Text style={styles.glassFacilityTag}>ASSIGNED PRIMARY HEALTHCARE CENTER</Text>
                  <Text style={styles.glassFacilityName}>General Hospital Abak (ABK-001)</Text>
                  <Text style={styles.glassFacilitySub}>Hospital Road, Abak LGA • 24/7 ER, Lab & Pharmacy Units</Text>
                </View>
              </View>

              <View style={styles.glassChecklistDivider} />

              <Text style={styles.glassChecklistHeadline}>Pre-Visit Preparation Checklist</Text>
              
              <TouchableOpacity style={styles.glassCheckRow} onPress={() => toggleChecklist('fasting')}>
                <View style={[styles.vectorCheckCircle, prepChecklist.fasting && styles.vectorCheckCircleActive]}>
                  {prepChecklist.fasting && <IconCheck size={11} color="#FFFFFF" />}
                </View>
                <Text style={[styles.checkItemLabel, prepChecklist.fasting && styles.checkItemDone]}>
                  Fasting 12 hours prior to fasting blood glucose test
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.checkItemRow} onPress={() => toggleChecklist('documents')}>
                <View style={[styles.vectorCheckCircle, prepChecklist.documents && styles.vectorCheckCircleActive]}>
                  {prepChecklist.documents && <IconCheck size={11} color="#FFFFFF" />}
                </View>
                <Text style={[styles.checkItemLabel, prepChecklist.documents && styles.checkItemDone]}>
                  Digital Health Card (ARS-PT-000123) ready for triage scan
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.checkItemRow} onPress={() => toggleChecklist('medications')}>
                <View style={[styles.vectorCheckCircle, prepChecklist.medications && styles.vectorCheckCircleActive]}>
                  {prepChecklist.medications && <IconCheck size={11} color="#FFFFFF" />}
                </View>
                <Text style={[styles.checkItemLabel, prepChecklist.medications && styles.checkItemDone]}>
                  Carry active medication schedule for dosage adjustment
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.glassBrowseHospitalsBtn}
                onPress={() => setActiveTab('appointments')}
                activeOpacity={0.85}
              >
                <Text style={styles.glassBrowseHospitalsBtnText}>Browse All 37 Akwa Ibom State Hospitals →</Text>
              </TouchableOpacity>
            </View>

            {/* 8. PREVENTIVE HEALTH TIP (Glass Banner) */}
            <TouchableOpacity
              style={styles.glassHealthTipBanner}
              onPress={() => showToast('Tip: 8 glasses of clean water daily optimizes vascular and kidney health')}
              activeOpacity={0.88}
            >
              <View style={styles.glassHealthTipIcon}>
                <IconLeaf size={18} color="#00B4B4" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.glassHealthTipTitle}>Daily Preventive Health Tip</Text>
                <Text style={styles.glassHealthTipSub}>
                  Hydration supports optimal vascular pressure and cellular vitality.
                </Text>
              </View>
              <IconChevronRight size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            9. PRIMARY TAB 2: APPOINTMENTS (Screen 3)
        =================================================================== */}
        {subView === 'none' && activeTab === 'appointments' && (
          <View style={styles.tabContentArea}>
            <Text style={styles.mockScreenHeaderTitle}>Appointments</Text>
            <Text style={styles.mockScreenHeaderSub}>Your upcoming and past appointments</Text>

            {/* Segmented Toggle: Upcoming / Past */}
            <View style={styles.segmentedToggleBox}>
              <TouchableOpacity
                style={[styles.segmentBtn, apptFilter === 'upcoming' && styles.segmentBtnActive]}
                onPress={() => setApptFilter('upcoming')}
              >
                <Text style={[styles.segmentBtnText, apptFilter === 'upcoming' && styles.segmentBtnTextActive]}>
                  Upcoming
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, apptFilter === 'past' && styles.segmentBtnActive]}
                onPress={() => setApptFilter('past')}
              >
                <Text style={[styles.segmentBtnText, apptFilter === 'past' && styles.segmentBtnTextActive]}>
                  Past
                </Text>
              </TouchableOpacity>
            </View>

            {apptFilter === 'upcoming' ? (
              <>
                {/* Appointment Card 1 */}
                <View style={styles.mockApptCard}>
                  <View style={styles.mockApptTopRow}>
                    <View style={[styles.mockDocAvatar, { backgroundColor: '#0284C7' }]}>
                      <Text style={styles.mockDocAvatarText}>JO</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.mockDocName}>Dr. James Okafor</Text>
                      <Text style={styles.mockDocSpecialty}>General Practitioner</Text>
                    </View>
                    <IconChevronRight size={16} color="#94A3B8" />
                  </View>
                  <View style={styles.mockApptDivider} />
                  <View style={styles.mockApptBottomRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ marginRight: 6 }}>
                        <IconCalendar size={13} color="#64748B" />
                      </View>
                      <Text style={styles.mockApptDateText}>Mon, 9 Sep 2025</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ marginRight: 6 }}>
                        <IconClock size={13} color="#64748B" />
                      </View>
                      <Text style={styles.mockApptDateText}>09:30 AM</Text>
                    </View>
                    <View style={styles.statusBadgeConfirmed}>
                      <Text style={styles.statusBadgeConfirmedText}>Confirmed</Text>
                    </View>
                  </View>
                </View>

                {/* Appointment Card 2 */}
                <View style={styles.mockApptCard}>
                  <View style={styles.mockApptTopRow}>
                    <View style={[styles.mockDocAvatar, { backgroundColor: '#E11D48' }]}>
                      <Text style={styles.mockDocAvatarText}>SB</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.mockDocName}>Dr. Sarah Bello</Text>
                      <Text style={styles.mockDocSpecialty}>Cardiologist</Text>
                    </View>
                    <IconChevronRight size={16} color="#94A3B8" />
                  </View>
                  <View style={styles.mockApptDivider} />
                  <View style={styles.mockApptBottomRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ marginRight: 6 }}>
                        <IconCalendar size={13} color="#64748B" />
                      </View>
                      <Text style={styles.mockApptDateText}>Fri, 13 Sep 2025</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ marginRight: 6 }}>
                        <IconClock size={13} color="#64748B" />
                      </View>
                      <Text style={styles.mockApptDateText}>11:00 AM</Text>
                    </View>
                    <View style={styles.statusBadgeConfirmed}>
                      <Text style={styles.statusBadgeConfirmedText}>Confirmed</Text>
                    </View>
                  </View>
                </View>

                {/* Appointment Card 3: Lab Test */}
                <View style={styles.mockApptCard}>
                  <View style={styles.mockApptTopRow}>
                    <View style={[styles.mockDocAvatar, { backgroundColor: '#0284C7' }]}>
                      <IconFlask size={20} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.mockDocName}>Lab Test</Text>
                      <Text style={styles.mockDocSpecialty}>Blood Test</Text>
                    </View>
                    <IconChevronRight size={16} color="#94A3B8" />
                  </View>
                  <View style={styles.mockApptDivider} />
                  <View style={styles.mockApptBottomRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ marginRight: 6 }}>
                        <IconCalendar size={13} color="#64748B" />
                      </View>
                      <Text style={styles.mockApptDateText}>Tue, 17 Sep 2025</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ marginRight: 6 }}>
                        <IconClock size={13} color="#64748B" />
                      </View>
                      <Text style={styles.mockApptDateText}>08:00 AM</Text>
                    </View>
                    <View style={styles.statusBadgePending}>
                      <Text style={styles.statusBadgePendingText}>Pending</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.mockApptCard}>
                <View style={styles.mockApptTopRow}>
                  <View style={[styles.mockDocAvatar, { backgroundColor: '#64748B' }]}>
                    <Text style={styles.mockDocAvatarText}>EU</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.mockDocName}>Dr. Emmanuel Udoh</Text>
                    <Text style={styles.mockDocSpecialty}>General Consultation • ABK-001</Text>
                  </View>
                </View>
                <View style={styles.mockApptDivider} />
                <View style={styles.mockApptBottomRow}>
                  <Text style={styles.mockApptDateText}>25 Aug 2025 • 14:00 PM</Text>
                  <View style={styles.statusBadgeGray}>
                    <Text style={styles.statusBadgeGrayText}>Completed</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Quick Action Button: Book New Appointment */}
            <TouchableOpacity
              style={styles.bookNewApptBtn}
              onPress={() => setSubView('bookStep1')}
              activeOpacity={0.88}
            >
              <Text style={styles.bookNewApptBtnText}>+ Book New Appointment</Text>
            </TouchableOpacity>

            {/* 37 State Hospitals Directory Feature */}
            <Text style={[styles.mockSectionTitle, { marginTop: 24 }]}>
              Akwa Ibom State Healthcare Network ({filteredHospitals.length})
            </Text>
            <View style={styles.searchHospitalWrap}>
              <TextInput
                style={styles.searchHospitalInput}
                value={hospitalSearch}
                onChangeText={setHospitalSearch}
                placeholder="Search LGA or Code (e.g. Abak, ABK-001, Eket...)"
                placeholderTextColor="#64748B"
              />
            </View>

            {filteredHospitals.slice(0, 6).map((hospital) => (
              <View key={hospital.code} style={styles.facilityCardMini}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.facilityCodeTag}>{hospital.code}</Text>
                  <Text style={styles.facilityLgaTag}>{hospital.lga} LGA</Text>
                </View>
                <Text style={styles.facilityNameTitle}>{hospital.name}</Text>
                <Text style={styles.facilityTierSub}>{hospital.tier} • Rating: ★ {hospital.rating}</Text>
                <TouchableOpacity
                  style={styles.facilitySelectBtn}
                  onPress={() => {
                    setSelectedHospital(hospital);
                    setSubView('bookStep1');
                    showToast(`Selected ${hospital.code}`);
                  }}
                >
                  <Text style={styles.facilitySelectBtnText}>Book at this Facility →</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ===================================================================
            10. PRIMARY TAB 3: MEDICAL RECORDS (Screen 6)
        =================================================================== */}
        {subView === 'none' && activeTab === 'records' && (
          <View style={styles.tabContentArea}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.mockScreenHeaderTitle}>Medical Records</Text>
              <TouchableOpacity
                style={styles.recordsSearchIconBtn}
                onPress={() => showToast('Search active for 5 digital medical records')}
              >
                <IconSearch size={18} color="#0D2B52" />
              </TouchableOpacity>
            </View>

            {/* Category Filter Pills */}
            <View style={styles.recordsPillRow}>
              {(['all', 'consultations', 'labResults', 'imaging'] as const).map((filterKey) => (
                <TouchableOpacity
                  key={filterKey}
                  style={[
                    styles.recordsFilterPill,
                    recordsFilter === filterKey && styles.recordsFilterPillActive,
                  ]}
                  onPress={() => setRecordsFilter(filterKey)}
                >
                  <Text
                    style={[
                      styles.recordsFilterPillText,
                      recordsFilter === filterKey && styles.recordsFilterPillTextActive,
                    ]}
                  >
                    {filterKey === 'all' && 'All'}
                    {filterKey === 'consultations' && 'Consultations'}
                    {filterKey === 'labResults' && 'Lab Results'}
                    {filterKey === 'imaging' && 'Imaging'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Record Items */}
            {(recordsFilter === 'all' || recordsFilter === 'consultations') && (
              <TouchableOpacity
                style={styles.recordRowCard}
                onPress={() => setSelectedResultDoc(DIAGNOSTIC_REPORTS[5])}
                activeOpacity={0.88}
              >
                <View style={[styles.recordIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <IconStethoscope size={20} color="#0066FF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.recordItemName}>General Checkup</Text>
                    <View style={styles.badgeConsultation}>
                      <Text style={styles.badgeConsultationText}>Consultation</Text>
                    </View>
                  </View>
                  <Text style={styles.recordItemMeta}>Dr. James Okafor • 9 Sep 2025</Text>
                  <View style={styles.recordItemOpenRow}>
                    <IconDocument size={11} color="#00B4B4" />
                    <Text style={styles.recordItemOpenHint}>Official Document • Tap to Open ↗</Text>
                  </View>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {(recordsFilter === 'all' || recordsFilter === 'labResults') && (
              <TouchableOpacity
                style={styles.recordRowCard}
                onPress={() => setSelectedResultDoc(DIAGNOSTIC_REPORTS[0])}
                activeOpacity={0.88}
              >
                <View style={[styles.recordIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <IconFlask size={20} color="#0284C7" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.recordItemName}>Blood Test (CBC 5-Diff)</Text>
                    <View style={styles.badgeLabResult}>
                      <Text style={styles.badgeLabResultText}>Lab Result</Text>
                    </View>
                  </View>
                  <Text style={styles.recordItemMeta}>Lab Services • 5 Aug 2025</Text>
                  <View style={styles.recordItemOpenRow}>
                    <IconDocument size={11} color="#00B4B4" />
                    <Text style={styles.recordItemOpenHint}>Certified Lab Report • Tap to Open ↗</Text>
                  </View>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {(recordsFilter === 'all' || recordsFilter === 'imaging') && (
              <TouchableOpacity
                style={styles.recordRowCard}
                onPress={() => setSelectedResultDoc(DIAGNOSTIC_REPORTS[4])}
                activeOpacity={0.88}
              >
                <View style={[styles.recordIconBox, { backgroundColor: '#DCFCE7' }]}>
                  <IconDocument size={20} color="#059669" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.recordItemName}>Chest X-Ray (PA View)</Text>
                    <View style={styles.badgeImaging}>
                      <Text style={styles.badgeImagingText}>Imaging</Text>
                    </View>
                  </View>
                  <Text style={styles.recordItemMeta}>Radiology • 28 Jun 2025</Text>
                  <View style={styles.recordItemOpenRow}>
                    <IconDocument size={11} color="#00B4B4" />
                    <Text style={styles.recordItemOpenHint}>Certified PACS Report • Tap to Open ↗</Text>
                  </View>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {(recordsFilter === 'all' || recordsFilter === 'consultations') && (
              <TouchableOpacity
                style={styles.recordRowCard}
                onPress={() => setSelectedResultDoc(DIAGNOSTIC_REPORTS[5])}
                activeOpacity={0.88}
              >
                <View style={[styles.recordIconBox, { backgroundColor: '#F3E8FF' }]}>
                  <IconHeartPulse size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.recordItemName}>Follow Up Consultation</Text>
                    <View style={styles.badgeConsultation}>
                      <Text style={styles.badgeConsultationText}>Consultation</Text>
                    </View>
                  </View>
                  <Text style={styles.recordItemMeta}>Dr. Sarah Bello • 12 May 2025</Text>
                  <View style={styles.recordItemOpenRow}>
                    <IconDocument size={11} color="#00B4B4" />
                    <Text style={styles.recordItemOpenHint}>Official Document • Tap to Open ↗</Text>
                  </View>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {(recordsFilter === 'all' || recordsFilter === 'labResults') && (
              <TouchableOpacity
                style={styles.recordRowCard}
                onPress={() => setSelectedResultDoc(DIAGNOSTIC_REPORTS[3])}
                activeOpacity={0.88}
              >
                <View style={[styles.recordIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <IconBloodDrop size={20} color="#0284C7" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.recordItemName}>Urine Analysis</Text>
                    <View style={styles.badgeLabResult}>
                      <Text style={styles.badgeLabResultText}>Lab Result</Text>
                    </View>
                  </View>
                  <Text style={styles.recordItemMeta}>Lab Services • 3 Apr 2025</Text>
                  <View style={styles.recordItemOpenRow}>
                    <IconDocument size={11} color="#00B4B4" />
                    <Text style={styles.recordItemOpenHint}>Certified Lab Report • Tap to Open ↗</Text>
                  </View>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {/* Download Official Report Button */}
            <TouchableOpacity
              style={styles.downloadOfficialPdfBtn}
              onPress={() => showToast('Official HL7/FHIR record downloaded')}
            >
              <Text style={styles.downloadOfficialPdfText}>Download Certified HL7/FHIR Record</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            11. PRIMARY TAB 4: PROFILE (Screen 9)
        =================================================================== */}
        {subView === 'none' && activeTab === 'profile' && (
          <View style={styles.tabContentArea}>
            {/* Header with Settings Gear */}
            <View style={styles.profileTopBar}>
              <Text style={styles.mockScreenHeaderTitle}>Profile</Text>
              <TouchableOpacity
                style={styles.settingsGearBtn}
                onPress={() => setSubView('settings')}
                activeOpacity={0.7}
              >
                <IconGear size={20} color="#0D2B52" />
              </TouchableOpacity>
            </View>

            {/* Profile Avatar & Patient ID */}
            <View style={styles.profileCardCentered}>
              <View style={styles.profileAvatarBig}>
                <Text style={styles.profileAvatarBigText}>{patientInitials}</Text>
              </View>
              <Text style={styles.profileNameBold}>{patientDisplayName}</Text>
              <TouchableOpacity
                style={styles.profilePatientIdBadge}
                onPress={() => showToast('Patient ID copied to clipboard')}
              >
                <Text style={styles.profilePatientIdText}>Patient ID: {patientId}</Text>
                <View style={{ marginLeft: 6 }}>
                  <IconCopy size={12} color="#0066FF" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Menu Rows */}
            <View style={styles.profileMenuBox}>
              <TouchableOpacity
                style={styles.profileMenuRow}
                onPress={() => setSubView('healthCard')}
              >
                <View style={styles.profileRowLeft}>
                  <View style={{ marginRight: 14 }}>
                    <IconDocument size={18} color="#0D2B52" />
                  </View>
                  <Text style={styles.profileRowLabel}>Digital Health Card (AKSHS)</Text>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileMenuRow}
                onPress={() => setSubView('billing')}
              >
                <View style={styles.profileRowLeft}>
                  <View style={{ marginRight: 14 }}>
                    <IconShield size={18} color="#10B981" />
                  </View>
                  <Text style={styles.profileRowLabel}>Billing & State Scheme Claims</Text>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileMenuRow}
                onPress={() => setSubView('family')}
              >
                <View style={styles.profileRowLeft}>
                  <View style={{ marginRight: 14 }}>
                    <IconUser size={18} color="#0066FF" />
                  </View>
                  <Text style={styles.profileRowLabel}>Family & Dependents (3 Active)</Text>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileMenuRow}
                onPress={() => setSubView('immunization')}
              >
                <View style={styles.profileRowLeft}>
                  <View style={{ marginRight: 14 }}>
                    <IconShield size={18} color="#F59E0B" />
                  </View>
                  <Text style={styles.profileRowLabel}>Immunization Registry (Yellow Card)</Text>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileMenuRow}
                onPress={() => showToast(`Full Name: ${patientDisplayName} • Blood: O+ POS • LGA: Abak`)}
              >
                <View style={styles.profileRowLeft}>
                  <View style={{ marginRight: 14 }}>
                    <IconUser size={18} color="#64748B" />
                  </View>
                  <Text style={styles.profileRowLabel}>Personal Information</Text>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileMenuRow}
                onPress={() => showToast('Allergies: Penicillin, NSAIDs • Conditions: None')}
              >
                <View style={styles.profileRowLeft}>
                  <View style={{ marginRight: 14 }}>
                    <IconDocument size={18} color="#00B4B4" />
                  </View>
                  <Text style={styles.profileRowLabel}>Medical History & Allergies</Text>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileMenuRow}
                onPress={() => setSubView('feedback')}
              >
                <View style={styles.profileRowLeft}>
                  <View style={{ marginRight: 14 }}>
                    <IconStar size={18} color="#F59E0B" />
                  </View>
                  <Text style={styles.profileRowLabel}>Rate Clinical Visit & Feedback</Text>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileMenuRow}
                onPress={() => setSubView('notifications')}
              >
                <View style={styles.profileRowLeft}>
                  <View style={{ marginRight: 14 }}>
                    <IconBell size={18} color="#F59E0B" />
                  </View>
                  <Text style={styles.profileRowLabel}>Notifications</Text>
                </View>
                <IconChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileMenuRow}
                onPress={() => setSubView('emergency')}
              >
                <View style={styles.profileRowLeft}>
                  <View style={{ marginRight: 14 }}>
                    <IconHelp size={18} color="#EF4444" />
                  </View>
                  <Text style={[styles.profileRowLabel, { color: '#EF4444', fontWeight: '700' }]}>
                    Emergency SOS & Dispatch
                  </Text>
                </View>
                <IconChevronRight size={16} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.profileMenuRow, { borderBottomWidth: 0 }]}
                onPress={handleSignOut}
              >
                <View style={styles.profileRowLeft}>
                  <View style={{ marginRight: 14 }}>
                    <IconLogout size={18} color="#EF4444" />
                  </View>
                  <Text style={[styles.profileRowLabel, { color: '#EF4444', fontWeight: '800' }]}>
                    Log Out
                  </Text>
                </View>
                <IconChevronRight size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* =======================================================================
          D. FLOATING 4-TAB BOTTOM NAVIGATION BAR (Screens 2, 3, 6, 9)
      ======================================================================= */}
      {subView === 'none' && (
        <View style={styles.mockBottomNavContainer}>
          <TouchableOpacity
            style={styles.mockBottomNavTab}
            onPress={() => setActiveTab('home')}
            activeOpacity={0.7}
          >
            <View style={{ marginBottom: 3 }}>
              <IconHome size={22} color={activeTab === 'home' ? '#0066FF' : '#94A3B8'} />
            </View>
            <Text style={[styles.mockNavLabel, activeTab === 'home' && styles.mockNavLabelActive]}>
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mockBottomNavTab}
            onPress={() => setActiveTab('appointments')}
            activeOpacity={0.7}
          >
            <View style={{ marginBottom: 3 }}>
              <IconCalendar size={20} color={activeTab === 'appointments' ? '#0066FF' : '#94A3B8'} />
            </View>
            <Text style={[styles.mockNavLabel, activeTab === 'appointments' && styles.mockNavLabelActive]}>
              Appointments
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mockBottomNavTab}
            onPress={() => setActiveTab('records')}
            activeOpacity={0.7}
          >
            <View style={{ marginBottom: 3 }}>
              <IconDocument size={20} color={activeTab === 'records' ? '#0066FF' : '#94A3B8'} />
            </View>
            <Text style={[styles.mockNavLabel, activeTab === 'records' && styles.mockNavLabelActive]}>
              Records
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mockBottomNavTab}
            onPress={() => setActiveTab('profile')}
            activeOpacity={0.7}
          >
            <View style={{ marginBottom: 3 }}>
              <IconUser size={20} color={activeTab === 'profile' ? '#0066FF' : '#94A3B8'} />
            </View>
            <Text style={[styles.mockNavLabel, activeTab === 'profile' && styles.mockNavLabelActive]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* =======================================================================
          E. TELEHEALTH VIDEO CALL OVERLAY MODAL
      ======================================================================= */}
      <Modal visible={inVideoCall} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.videoRoomScreen}>
          <StatusBar barStyle="light-content" backgroundColor="#070E1E" />
          <View style={styles.videoRoomInner}>
            <View style={styles.videoTopBar}>
              <View>
                <Text style={styles.videoDoctorName}>Dr. Emmanuel Udoh</Text>
                <Text style={styles.videoRoomEncounter}>ABK-001 Telehealth Room • Encrypted 1080p</Text>
              </View>
              <View style={styles.videoDurationBadge}>
                <Text style={styles.videoDurationText}>04:18</Text>
              </View>
            </View>

            <View style={styles.videoStreamContainer}>
              <View style={styles.doctorVideoFrame}>
                <View style={styles.docAvatarShield}>
                  <Text style={styles.docAvatarShieldText}>DR</Text>
                </View>
                <Text style={styles.docSpeakingName}>Dr. Emmanuel Udoh Speaking</Text>
                <Text style={styles.docStreamBitrate}>ABK-001 Clinical Telehealth Link • Low Latency</Text>
              </View>

              <View style={styles.patientPipFrame}>
                <Text style={styles.pipPatientLabel}>{patientDisplayName}</Text>
              </View>
            </View>

            <View style={styles.videoActionsBar}>
              <TouchableOpacity
                style={[styles.videoBtnRound, callMuted && styles.videoBtnRoundActive]}
                onPress={() => {
                  setCallMuted(!callMuted);
                  showToast(callMuted ? 'Microphone unmuted' : 'Microphone muted');
                }}
              >
                <Text style={styles.videoBtnLabel}>{callMuted ? 'UNMUTE' : 'MUTE'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.videoBtnRound, callCamOff && styles.videoBtnRoundActive]}
                onPress={() => {
                  setCallCamOff(!callCamOff);
                  showToast(callCamOff ? 'Camera turned on' : 'Camera turned off');
                }}
              >
                <Text style={styles.videoBtnLabel}>{callCamOff ? 'CAM ON' : 'CAM OFF'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.hangupCallButton}
                onPress={() => {
                  setInVideoCall(false);
                  showToast('Consultation ended safely');
                }}
              >
                <Text style={styles.hangupCallText}>End Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ===================================================================
          CLINICAL DIAGNOSTIC REPORT DOCUMENT VIEWER MODAL
      =================================================================== */}
      <Modal
        visible={selectedResultDoc !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedResultDoc(null)}
      >
        <SafeAreaView style={styles.docViewerSafeArea}>
          {/* Document Viewer App Bar */}
          <View style={styles.docViewerTopBar}>
            <TouchableOpacity
              style={styles.docViewerCloseBtn}
              onPress={() => setSelectedResultDoc(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.docViewerCloseBtnText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.docViewerTopTitleBox}>
              <View style={styles.docViewerSecureBadge}>
                <View style={styles.docViewerGreenLed} />
                <Text style={styles.docViewerSecureBadgeText}>CERTIFIED CLINICAL DOCUMENT</Text>
              </View>
              <Text style={styles.docViewerTopTitle} numberOfLines={1}>
                {selectedResultDoc?.title || 'Diagnostic Report'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.docViewerShareBtn}
              onPress={() => {
                showToast(`Sharing ${selectedResultDoc?.testCode} with healthcare provider`);
              }}
            >
              <IconShare size={16} color="#0D2B52" />
            </TouchableOpacity>
          </View>

          {/* Document Content Scroll */}
          {selectedResultDoc && (
            <ScrollView
              style={styles.docViewerScrollView}
              contentContainerStyle={styles.docViewerScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Paper Sheet Representation */}
              <View style={styles.docPaperSheet}>
                {/* 1. Official Letterhead */}
                <View style={styles.docHeaderRow}>
                  {/* Akwa Ibom State Emblem */}
                  <View style={styles.docEmblemBadge}>
                    <View style={styles.docEmblemInner}>
                      <Text style={styles.docEmblemLetter}>A</Text>
                      <View style={styles.docEmblemCrown} />
                    </View>
                  </View>

                  <View style={styles.docHeaderTitleCol}>
                    <Text style={styles.docStateMinistryText}>
                      GOVERNMENT OF AKWA IBOM STATE OF NIGERIA
                    </Text>
                    <Text style={styles.docStateDeptText}>
                      MINISTRY OF HEALTH • STATE HEALTH SCHEME (AKSHS)
                    </Text>
                    <Text style={styles.docFacilityHeading}>
                      {selectedResultDoc.facility}
                    </Text>
                    <Text style={styles.docIsoAccreditation}>
                      ISO 15189:2022 ACCREDITED CLINICAL DIAGNOSTIC LABORATORY
                    </Text>
                  </View>
                </View>

                <View style={styles.docDividingLineThick} />

                {/* 2. Barcode & Document Control Header */}
                <View style={styles.docBarcodeMetaRow}>
                  <View>
                    <Text style={styles.docMetaSmallLabel}>ACCESSION / SPECIMEN NO.</Text>
                    <Text style={styles.docMetaValueMono}>{selectedResultDoc.accessionNumber}</Text>
                    <Text style={styles.docMetaSubSmall}>TEST CODE: {selectedResultDoc.testCode}</Text>
                  </View>

                  {/* Simulated High-Res Barcode Strip */}
                  <View style={styles.docBarcodeContainer}>
                    <View style={styles.docBarcodeStrip}>
                      {[3, 1, 2, 1, 4, 1, 2, 3, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3, 2, 1, 3].map((w, idx) => (
                        <View
                          key={idx}
                          style={{
                            width: w,
                            height: 26,
                            backgroundColor: '#0F172A',
                            marginRight: 1.5,
                          }}
                        />
                      ))}
                    </View>
                    <Text style={styles.docBarcodeNumText}>{selectedResultDoc.accessionNumber}</Text>
                  </View>
                </View>

                {/* 3. Patient Demographics & Order Details Grid */}
                <View style={styles.docPatientGrid}>
                  <View style={styles.docPatientGridRow}>
                    <View style={styles.docPatientGridCol}>
                      <Text style={styles.docGridLabel}>PATIENT NAME</Text>
                      <Text style={styles.docGridValueBold}>Michael Chinedu</Text>
                    </View>
                    <View style={styles.docPatientGridCol}>
                      <Text style={styles.docGridLabel}>HEALTH ID / CARD NO.</Text>
                      <Text style={styles.docGridValueMono}>AKS-ABK-001-90821</Text>
                    </View>
                  </View>

                  <View style={styles.docPatientGridRow}>
                    <View style={styles.docPatientGridCol}>
                      <Text style={styles.docGridLabel}>AGE / GENDER</Text>
                      <Text style={styles.docGridValue}>36 Y / Male</Text>
                    </View>
                    <View style={styles.docPatientGridCol}>
                      <Text style={styles.docGridLabel}>DATE & TIME COLLECTED</Text>
                      <Text style={styles.docGridValue}>{selectedResultDoc.date} • {selectedResultDoc.time}</Text>
                    </View>
                  </View>

                  <View style={styles.docPatientGridRow}>
                    <View style={styles.docPatientGridCol}>
                      <Text style={styles.docGridLabel}>ORDERING PHYSICIAN</Text>
                      <Text style={styles.docGridValue}>{selectedResultDoc.orderingDoctor}</Text>
                    </View>
                    <View style={styles.docPatientGridCol}>
                      <Text style={styles.docGridLabel}>SAMPLE / SPECIMEN TYPE</Text>
                      <Text style={styles.docGridValue}>{selectedResultDoc.specimen}</Text>
                    </View>
                  </View>
                </View>

                {/* 4. Certified Document Title Banner */}
                <View style={styles.docTitleBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docTitleBannerCategory}>
                      {selectedResultDoc.category.toUpperCase()}
                    </Text>
                    <Text style={styles.docTitleBannerMain}>
                      {selectedResultDoc.title}
                    </Text>
                  </View>
                  <View style={styles.docCertifiedStamp}>
                    <Text style={styles.docCertifiedStampText}>VERIFIED</Text>
                    <Text style={styles.docCertifiedStampSub}>ISO 15189</Text>
                  </View>
                </View>

                {/* 5. Analyte Parameter Table */}
                <View style={styles.docTableWrap}>
                  <View style={styles.docTableHeaderRow}>
                    <Text style={[styles.docTableTh, { flex: 2.2 }]}>TEST PARAMETER</Text>
                    <Text style={[styles.docTableTh, { flex: 1.4, textAlign: 'right' }]}>RESULT</Text>
                    <Text style={[styles.docTableTh, { flex: 1.1, textAlign: 'center' }]}>UNIT</Text>
                    <Text style={[styles.docTableTh, { flex: 1.8, textAlign: 'right' }]}>REF. INTERVAL</Text>
                    <Text style={[styles.docTableTh, { flex: 1.2, textAlign: 'center' }]}>STATUS</Text>
                  </View>

                  {selectedResultDoc.parameters.map((param, pIdx) => (
                    <View
                      key={pIdx}
                      style={[
                        styles.docTableRow,
                        pIdx % 2 === 1 && styles.docTableRowStripe,
                      ]}
                    >
                      <Text style={[styles.docTableTdParam, { flex: 2.2 }]}>{param.name}</Text>
                      <Text style={[styles.docTableTdValue, { flex: 1.4, textAlign: 'right' }]}>
                        {param.value}
                      </Text>
                      <Text style={[styles.docTableTdUnit, { flex: 1.1, textAlign: 'center' }]}>
                        {param.unit}
                      </Text>
                      <Text style={[styles.docTableTdRef, { flex: 1.8, textAlign: 'right' }]}>
                        {param.refRange}
                      </Text>
                      <View style={{ flex: 1.2, alignItems: 'center' }}>
                        <View style={styles.docParamBadgePill}>
                          <Text style={styles.docParamBadgePillText}>{param.status}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                {/* 6. Clinical Summary & Diagnostic Interpretation */}
                <View style={styles.docInterpretationBox}>
                  <View style={styles.docInterpretationHeaderRow}>
                    <View style={styles.docInterpretationIconDot} />
                    <Text style={styles.docInterpretationTitle}>
                      PATHOLOGICAL INTERPRETATION & CLINICAL REMARKS
                    </Text>
                  </View>
                  <Text style={styles.docInterpretationBody}>
                    {selectedResultDoc.clinicalSummary}
                  </Text>
                </View>

                {/* 7. Sign-off & Digital Signature Section */}
                <View style={styles.docSignOffSection}>
                  <View style={styles.docSignOffCol}>
                    <View style={styles.docSignStrokeLine} />
                    <Text style={styles.docSignDoctorName}>{selectedResultDoc.labDirector}</Text>
                    <Text style={styles.docSignDoctorRole}>Consultant Pathologist & Lab Director</Text>
                    <Text style={styles.docSignFacilityCode}>{selectedResultDoc.facilityCode} • AKSHS Clinical Lab</Text>
                  </View>

                  {/* Digital Signature Emblem Seal */}
                  <View style={styles.docDigitalSealBox}>
                    <View style={styles.docDigitalSealCircle}>
                      <Text style={styles.docDigitalSealCircleText}>MEDCORE</Text>
                      <Text style={styles.docDigitalSealCircleCenter}>SEAL</Text>
                      <Text style={styles.docDigitalSealCircleSub}>AKSHS</Text>
                    </View>
                    <Text style={styles.docDigitalHashText}>
                      HASH: 7B9084..E2F1
                    </Text>
                  </View>
                </View>

                {/* 8. HL7 / FHIR Document Footer */}
                <View style={styles.docSecurityFooter}>
                  <Text style={styles.docSecurityFooterText}>
                    Electronic Diagnostic Record • Conforms to HL7 FHIR R4 & Akwa Ibom State Health Scheme (AKSHS)
                  </Text>
                  <Text style={styles.docSecurityFooterSub}>
                    Confidential medical document. Authenticated digitally via MedCore Health Core M87.
                  </Text>
                </View>
              </View>

              {/* Bottom Document Actions */}
              <View style={styles.docActionsContainer}>
                <TouchableOpacity
                  style={styles.docDownloadPdfPrimaryBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    showToast(`Certified PDF for ${selectedResultDoc.testCode} saved to device`);
                  }}
                >
                  <View style={{ marginRight: 8 }}>
                    <IconDocument size={16} color="#FFFFFF" />
                  </View>
                  <Text style={styles.docDownloadPdfPrimaryBtnText}>
                    Download Certified PDF (A4)
                  </Text>
                </TouchableOpacity>

                <View style={styles.docActionSubRow}>
                  <TouchableOpacity
                    style={styles.docSecondaryActionBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      showToast('Document shared securely with Dr. James Okafor');
                    }}
                  >
                    <Text style={styles.docSecondaryActionBtnText}>Share with Doctor</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.docSecondaryActionBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedResultDoc(null);
                      setInVideoCall(true);
                    }}
                  >
                    <Text style={styles.docSecondaryActionBtnText}>Discuss via Telehealth</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Global Toast */}
      {toastMessage && (
        <View style={styles.toastBox}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// =========================================================================
// STYLESHEET
// =========================================================================
const styles = StyleSheet.create({
  // SPLASH 1 (3 SECONDS - LOGO ONLY)
  splash1Container: {
    flex: 1,
    backgroundColor: '#050C1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraBlueLeft: {
    position: 'absolute',
    left: -60,
    top: '30%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(0, 102, 255, 0.22)',
  },
  auraEmeraldRight: {
    position: 'absolute',
    right: -60,
    top: '30%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(0, 208, 156, 0.22)',
  },

  // ARISE AKWA IBOM ORANGE AURA (Splash 2 only)
  auraAriseOrange: {
    position: 'absolute',
    left: '30%',
    bottom: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(232, 89, 12, 0.13)',
  },

  // ARISE TOP BAR (Splash 2) — structured row, not absolute
  splash2TopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 8,
    marginBottom: 0,
  },
  splash2StateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 208, 156, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 156, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  splash2StateDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#00D09C',
    marginRight: 5,
  },
  splash2StateTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00D09C',
    letterSpacing: 1,
  },
  ariseLogoImgLg: {
    width: 90,
    height: 60,
  },
  // ARISE LOGO — SMALL (Auth page top bar)
  ariseLogoImgSm: {
    width: 62,
    height: 44,
  },

  splash1LogoCard: {
    width: 180,
    height: 180,
    borderRadius: 40,
    backgroundColor: '#0A152E',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 163, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
  },
  splash1LogoImg: {
    width: 130,
    height: 130,
  },
  splash1EcgBar: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    width: 180,
  },
  ecgPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0088FF',
    marginRight: 6,
  },
  ecgPulseDotRight: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D09C',
    marginLeft: 6,
  },
  ecgTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  ecgFill: {
    width: '75%',
    height: '100%',
    backgroundColor: '#00D09C',
    borderRadius: 2,
  },

  // SPLASH 2 — WHITE ARISE x MEDCORE DESIGN
  splash2Container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  splash2Content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 2,
  },

  // TEAL WAVE DECORATIONS (corner blobs matching mockup)
  s2WaveTopLeft: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0, 188, 188, 0.28)',
    zIndex: 0,
  },
  s2WaveTopLeftInner: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0, 208, 200, 0.18)',
    zIndex: 0,
  },
  s2WaveBottomRight: {
    position: 'absolute',
    bottom: -90,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(0, 188, 188, 0.32)',
    zIndex: 0,
  },
  s2WaveBottomRightInner: {
    position: 'absolute',
    bottom: -30,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0, 208, 208, 0.22)',
    zIndex: 0,
  },

  // ARISE LOGO — large, centered
  s2AriseLogoCenter: {
    width: 180,
    height: 130,
    marginBottom: 10,
  },

  // MEDCORE BICOLOR WORDMARK
  s2WordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
    marginTop: 4,
  },
  s2WordMed: {
    fontSize: 42,
    fontWeight: '900',
    color: '#0D2B52',
    letterSpacing: -1,
  },
  s2WordCore: {
    fontSize: 42,
    fontWeight: '900',
    color: '#00B4B4',
    letterSpacing: -1,
  },

  // TAGLINE
  s2Tagline: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 0.1,
  },

  // PROGRESS LINE
  s2ProgressTrack: {
    width: 80,
    height: 3,
    backgroundColor: 'rgba(0, 180, 180, 0.18)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  s2ProgressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0066CC',
    borderRadius: 2,
    transformOrigin: 'left',
  },

  // SPLASH 2 FEATURE SHOWCASE WRAPPER
  splash2FeatureWrap: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    zIndex: 2,
    alignItems: 'center',
  },

  // FEATURE CARD 2-COLUMN GRID
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  featureCardIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.1,
    marginBottom: 4,
  },
  featureCardDesc: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
    fontWeight: '400',
  },

  // M87 FOOTNOTE ON SPLASH 2
  s2FootnoteM87: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },


  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleMedCore: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0099FF',
    letterSpacing: -0.5,
  },
  titleCare: {
    fontSize: 34,
    fontWeight: '900',
    color: '#00D09C',
    letterSpacing: -0.5,
  },
  subPill: {
    backgroundColor: 'rgba(0, 153, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 156, 0.35)',
    marginBottom: 10,
  },
  subPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#00D09C',
    letterSpacing: 1.2,
  },
  splash2Tagline: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 19,
    marginBottom: 30,
  },
  splash2EnterBtn: {
    backgroundColor: '#0066FF',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 100,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  splash2EnterBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // POWERED BY M87 AT BOTTOM CENTER
  m87Footer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
  },
  m87Badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 156, 0.3)',
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 6,
  },
  m87BlueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0088FF',
    marginRight: 8,
  },
  m87EmeraldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D09C',
    marginLeft: 8,
  },
  m87Text: {
    fontSize: 12,
    fontWeight: '800',
    color: '#CBD5E1',
    letterSpacing: 1.4,
  },
  m87Bold: {
    color: '#00D09C',
    fontWeight: '900',
  },
  m87Sub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },

  // =========================================================================
  // AUTH PATTERN MATCHING THE FIGMA SCREENSHOT
  // =========================================================================
  figmaAuthSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  figmaAuthContainer: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  figmaTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  stateTagWrap: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stateTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  figmaLangPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  figmaLangText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  figmaLangDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    position: 'absolute',
    top: 50,
    right: 28,
    zIndex: 999,
  },
  figmaLangOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  figmaLangOptionActive: {
    backgroundColor: '#E6FFFA',
  },
  figmaLangOptionText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  figmaLangOptionTextActive: {
    color: '#00A88F',
    fontWeight: '800',
  },
  figmaCenterHero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  figmaLogoWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  figmaLogoImg: {
    width: 90,
    height: 90,
  },
  figmaBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 36,
  },
  figmaBrandBlue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0066FF',
    letterSpacing: -0.4,
  },
  figmaBrandEmerald: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00A88F',
    letterSpacing: -0.4,
  },
  figmaTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  figmaSubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 290,
  },
  figmaBtnGroup: {
    width: '100%',
    marginBottom: 12,
  },
  figmaLoginBtn: {
    backgroundColor: '#00A88F',
    height: 56,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#00A88F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  figmaLoginBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  figmaSignUpBtn: {
    backgroundColor: '#FFFFFF',
    height: 56,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00A88F',
  },
  figmaSignUpBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#00A88F',
    letterSpacing: 0.2,
  },
  figmaFooterM87: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  figmaFooterText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // MODAL / SHEET STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: height * 0.85,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  sheetSub: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
  },
  sheetInputGroup: {
    marginBottom: 16,
  },
  sheetPassLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  sheetForgotLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00A88F',
  },
  sheetInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
  },
  sheetTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  textActionToggle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00A88F',
    padding: 4,
  },
  sheetSubmitBtn: {
    backgroundColor: '#00A88F',
    height: 52,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
    shadowColor: '#00A88F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  sheetSubmitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // LGA DROPDOWN STYLES
  lgaDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
  },
  lgaDropdownTriggerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  lgaDropdownTriggerTextSelected: {
    color: '#0F172A',
  },
  lgaDropdownTriggerTextPlaceholder: {
    color: '#94A3B8',
  },
  lgaChevron: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lgaChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  lgaChevronBar1: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: '#00A88F',
    borderRadius: 1,
    left: 1,
    transform: [{ rotate: '45deg' }],
  },
  lgaChevronBar2: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: '#00A88F',
    borderRadius: 1,
    right: 1,
    transform: [{ rotate: '-45deg' }],
  },
  lgaDropdownList: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  lgaDropdownScroll: {
    maxHeight: 220,
  },
  lgaDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lgaDropdownItemActive: {
    backgroundColor: 'rgba(0, 168, 143, 0.08)',
  },
  lgaItemDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
    marginRight: 10,
  },
  lgaItemDotActive: {
    backgroundColor: '#00A88F',
  },
  lgaDropdownItemText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  lgaDropdownItemTextActive: {
    color: '#00A88F',
    fontWeight: '700',
  },
  lgaCheckMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00A88F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lgaCheckMarkText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  sheetBiometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    height: 48,
    borderRadius: 100,
    marginBottom: 16,
  },
  biometricDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00A88F',
    marginRight: 8,
  },
  sheetBiometricText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00A88F',
  },
  fastPassNoticeBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
    alignItems: 'center',
  },
  fastPassNoticeText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },

  // =========================================================================
  // MAIN APP STYLES
  // =========================================================================
  mainCanvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  // Background teal wave blobs (same as splash 2)
  mainWaveTopRight: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 188, 188, 0.18)',
    zIndex: 0,
  },
  mainWaveBottomLeft: {
    position: 'absolute',
    bottom: 80,
    left: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0, 188, 188, 0.13)',
    zIndex: 0,
  },
  mainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 180, 180, 0.18)',
    zIndex: 10,
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoImg: {
    width: 38,
    height: 38,
    marginRight: 10,
  },
  headerTitleBlue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0D2B52',
    letterSpacing: -0.3,
  },
  headerTitleEmerald: {
    fontSize: 17,
    fontWeight: '900',
    color: '#00A88F',
    letterSpacing: -0.3,
  },
  livePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 180, 180, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.3)',
  },
  livePulseDotGreen: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00B4B4',
    marginRight: 4,
  },
  livePulseText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00B4B4',
  },
  headerSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLangBtn: {
    backgroundColor: '#F0FAFA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.3)',
  },
  headerLangText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D2B52',
  },
  headerAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#00B4B4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0D2B52',
  },
  headerAvatarInitials: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  mainLangDropdownCard: {
    position: 'absolute',
    top: 64,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 8,
    zIndex: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.25)',
    shadowColor: '#0D2B52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  mainLangRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  mainLangRowSelected: {
    backgroundColor: 'rgba(0, 180, 180, 0.1)',
  },
  mainLangText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  mainLangTextSelected: {
    color: '#00B4B4',
    fontWeight: '900',
  },
  mainScrollContainer: {
    flex: 1,
  },
  mainScrollContent: {
    flexGrow: 1,
  },
  tabContentArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // VIP HERO PATIENT CARD
  vipHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.2)',
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },
  // Teal top strip inside hero card
  vipHeroStrip: {
    backgroundColor: '#0D2B52',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  vipStripWaveBlob: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 180, 180, 0.3)',
  },
  vipGreeting: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  vipPatientName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  vipBloodPill: {
    backgroundColor: 'rgba(0, 180, 180, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  vipBloodPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  ecgWaveContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 180, 180, 0.06)',
    borderRadius: 0,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  ecgWaveSymbol: {
    fontSize: 12,
    fontWeight: '900',
    color: '#00B4B4',
    letterSpacing: 2,
  },
  ecgBpmText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D2B52',
  },
  vipHeroDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 180, 180, 0.12)',
    marginHorizontal: 20,
  },
  vipHeroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  vipMeta: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  vipMetaDot: {
    fontSize: 10,
    color: '#00B4B4',
    marginHorizontal: 6,
  },
  vipMetaActive: {
    fontSize: 11,
    color: '#00B4B4',
    fontWeight: '900',
  },

  // TELEHEALTH CONSULTATION CARD
  telehealthConsultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.2)',
    marginBottom: 20,
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  telehealthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  telehealthBadgeRed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  redPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  telehealthBadgeRedText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.8,
  },
  telehealthTimeTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00B4B4',
    backgroundColor: 'rgba(0, 180, 180, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  telehealthTitleText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D2B52',
    marginBottom: 4,
  },
  telehealthDoctorText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  telehealthButtonRow: {
    flexDirection: 'row',
  },
  joinCallPrimaryBtn: {
    flex: 1,
    backgroundColor: '#0D2B52',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 8,
    shadowColor: '#0D2B52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  joinCallPrimaryBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  consultDetailBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.4)',
    alignItems: 'center',
  },
  consultDetailBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00B4B4',
  },

  // HEALTHCARE PORTALS 4-GRID
  sectionHeaderHeading: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D2B52',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  portalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  portalCardBlue: {
    width: (width - 44) / 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(13, 43, 82, 0.15)',
    shadowColor: '#0D2B52',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  portalCardEmerald: {
    width: (width - 44) / 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.2)',
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  portalCardCyan: {
    width: (width - 44) / 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.2)',
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  portalCardIndigo: {
    width: (width - 44) / 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(13, 43, 82, 0.15)',
    shadowColor: '#0D2B52',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  portalPillBlue: {
    backgroundColor: '#0D2B52',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  portalPillEmerald: {
    backgroundColor: '#00B4B4',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  portalPillCyan: {
    backgroundColor: '#00B4B4',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  portalPillIndigo: {
    backgroundColor: '#0D2B52',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  portalPillText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  portalTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D2B52',
    marginBottom: 2,
    textAlign: 'center',
  },
  portalSub: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
  },

  // PRIMARY FACILITY HIGHLIGHT CARD
  tourismHighlightCard: {
    backgroundColor: '#0D2B52',
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.3)',
  },
  tourismTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tourismFlagBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#00B4B4',
    letterSpacing: 0.8,
  },
  tourismConfirmedBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: '#00B4B4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tourismClinicHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  tourismDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    marginBottom: 12,
  },
  openConciergeBtn: {
    backgroundColor: '#00B4B4',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  openConciergeBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // PROTOCOL CHECKLIST
  careChecklistCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.2)',
    marginBottom: 20,
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  checklistTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D2B52',
    marginBottom: 2,
  },
  checklistSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 14,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 180, 180, 0.1)',
  },
  vectorCheckCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  vectorCheckCircleActive: {
    borderColor: '#00B4B4',
    backgroundColor: 'rgba(0, 180, 180, 0.1)',
  },
  vectorCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00B4B4',
  },
  checkItemLabel: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  checkItemDone: {
    color: '#CBD5E1',
    textDecorationLine: 'line-through',
  },

  // PAGE HEADERS (Appointments, Records, etc.)
  pageHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D2B52',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  pageHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },
  searchHospitalWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.25)',
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  searchHospitalInput: {
    height: 48,
    fontSize: 13,
    color: '#0D2B52',
    fontWeight: '600',
  },
  apptCardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.18)',
    marginBottom: 14,
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  apptTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  apptBadgeBlueWrap: {
    backgroundColor: '#0D2B52',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(13, 43, 82, 0.5)',
  },
  apptBadgeBlueText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  apptConfirmedStatus: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00B4B4',
  },
  apptDoctorName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D2B52',
    marginBottom: 2,
  },
  apptDoctorTitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  apptBtnGroup: {
    flexDirection: 'row',
    marginTop: 6,
  },
  apptOutlineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.3)',
    alignItems: 'center',
    marginRight: 8,
  },
  apptOutlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00B4B4',
  },
  apptFillBtnBlue: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0D2B52',
    alignItems: 'center',
  },
  apptFillBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // LABS & RECORDS TAB
  labReportCard: {
    backgroundColor: '#0D1730',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 156, 0.3)',
    marginBottom: 20,
  },
  labReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labCategoryText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0099FF',
    letterSpacing: 0.8,
  },
  normalPillWrap: {
    backgroundColor: 'rgba(0, 208, 156, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 156, 0.4)',
  },
  normalPillLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00D09C',
  },
  labTestTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  labMetaText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 14,
  },
  metricsBox: {
    flexDirection: 'row',
    backgroundColor: '#070E1E',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricItemLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricItemVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  metricItemUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  metricItemRange: {
    fontSize: 9,
    color: '#00D09C',
    fontWeight: '700',
    marginTop: 2,
  },
  downloadPdfActionBtn: {
    backgroundColor: '#0E1A36',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.3)',
  },
  downloadPdfActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00A3FF',
  },
  pharmacyCard: {
    backgroundColor: '#0D1730',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  pharmacyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pharmacyDrugName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  pharmacyRefillPill: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pharmacyDosage: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
    marginBottom: 2,
  },
  pharmacyDoc: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  pharmacyRefillBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pharmacyRefillBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // REFERRALS TAB
  tourismHeroCardElevated: {
    backgroundColor: '#0C1C33',
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 156, 0.35)',
  },
  tourismHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tourismAccreditedText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0099FF',
    letterSpacing: 0.8,
  },
  tourismCountryTag: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  tourismHeroHeadline: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  tourismHeroClinic: {
    fontSize: 12,
    color: '#94A3B8',
  },
  travelStepCardGlass: {
    backgroundColor: '#0D1730',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.2)',
    marginBottom: 12,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepHeadingText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00D09C',
  },
  stepSubText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 6,
  },
  stepGreenBadge: {
    backgroundColor: 'rgba(0, 208, 156, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 156, 0.3)',
  },
  stepGreenBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#00D09C',
  },

  // CONSULT & CHAT TAB
  consultDoctorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1730',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.25)',
    marginBottom: 14,
  },
  docAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#00D09C',
  },
  docAvatarInitials: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  docInfoGroup: {
    flex: 1,
  },
  docFullName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  docOnlineStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00D09C',
  },
  launchVideoBtnTop: {
    backgroundColor: '#0066FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  launchVideoBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  chatMessageStream: {
    marginBottom: 14,
  },
  chatBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  bubbleDoctor: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D1730',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bubblePatient: {
    alignSelf: 'flex-end',
    backgroundColor: '#0066FF',
  },
  chatText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  chatTextDoctor: {
    color: '#FFFFFF',
  },
  chatTextPatient: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  chatTimeText: {
    fontSize: 9,
    color: '#94A3B8',
    alignSelf: 'flex-end',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1730',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chatInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: '#FFFFFF',
  },
  chatSendButton: {
    backgroundColor: '#00D09C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chatSendButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#070E1E',
  },

  // PROFILE & ICE TAB
  idPassCardElevated: {
    backgroundColor: '#0A152E',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 208, 156, 0.45)',
    shadowColor: '#00D09C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  idPassTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  idPassBrandTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0099FF',
    letterSpacing: 1,
  },
  idPassQrTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#00D09C',
  },
  idPassFullName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  idPassDemographics: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 14,
  },
  idPassDividerLine: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 14,
  },
  idPassMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  idMetaHeading: {
    fontSize: 8,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  idMetaContent: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // SETTINGS FAST-PASS ENROLLMENT
  settingsBoxCard: {
    backgroundColor: '#0D1730',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.25)',
    marginBottom: 20,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  settingsDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
  },
  toggleBtn: {
    width: 52,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleBtnOn: {
    backgroundColor: '#00D09C',
  },
  toggleBtnOff: {
    backgroundColor: '#334155',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  toggleKnobOff: {
    alignSelf: 'flex-start',
  },

  allergyWarningCard: {
    backgroundColor: '#1E1218',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    marginBottom: 20,
  },
  allergyWarningTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F87171',
    marginLeft: 6,
  },
  allergyWarningItem: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FCA5A5',
    marginTop: 3,
  },
  allergyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allergyItemRed: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F87171',
  },
  allergySeverityTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  allergyDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 10,
  },
  iceContactCard: {
    backgroundColor: '#0D1730',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.25)',
    marginBottom: 24,
  },
  iceFlexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iceContactName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  iceContactPhone: {
    fontSize: 13,
    color: '#00D09C',
    fontWeight: '700',
    marginVertical: 2,
  },
  iceContactRelation: {
    fontSize: 11,
    color: '#64748B',
  },
  iceCallActionBtn: {
    backgroundColor: 'rgba(0, 208, 156, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 156, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  iceCallActionText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#00D09C',
  },
  signOutActionButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutActionText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#EF4444',
  },

  // CURVED FLOATING BOTTOM NAVIGATION
  bottomFloatingNavBar: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    height: 66,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 180, 180, 0.25)',
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  navTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    position: 'relative',
  },
  navTabItemActive: {},
  navCodeBadge: {
    width: 24,
    height: 18,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 180, 180, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  navCodeBadgeActive: {
    backgroundColor: '#0D2B52',
  },
  navCodeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
  },
  navCodeTextActive: {
    color: '#FFFFFF',
  },
  navTabLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  navTabLabelActive: {
    color: '#0D2B52',
    fontWeight: '900',
  },
  navActivePip: {
    position: 'absolute',
    bottom: -3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00D09C',
  },

  // VIDEO ROOM MODAL
  videoRoomScreen: {
    flex: 1,
    backgroundColor: '#070E1E',
  },
  videoRoomInner: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  videoTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  videoDoctorName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  videoRoomEncounter: {
    fontSize: 11,
    color: '#94A3B8',
  },
  videoDurationBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  videoDurationText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
  },
  videoStreamContainer: {
    flex: 1,
    backgroundColor: '#0C1733',
    borderRadius: 24,
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.3)',
  },
  doctorVideoFrame: {
    alignItems: 'center',
  },
  docAvatarShield: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00D09C',
    marginBottom: 12,
  },
  docAvatarShieldText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  docSpeakingName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  docStreamBitrate: {
    fontSize: 11,
    color: '#00D09C',
  },
  patientPipFrame: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 96,
    height: 120,
    backgroundColor: '#070E1E',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipPatientLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  videoActionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
  },
  videoBtnRound: {
    alignItems: 'center',
    backgroundColor: '#0D1730',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  videoBtnRoundActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderColor: '#EF4444',
  },
  videoBtnLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#CBD5E1',
  },
  hangupCallButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 24,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  hangupCallText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // GLOBAL TOAST NOTIFICATION
  toastBox: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: '#0A152E',
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#00D09C',
    shadowColor: '#00D09C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    zIndex: 9999,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // =========================================================================
  // 12-SCREEN MOCKUP COMPLETE DESIGN SYSTEM STYLES
  // =========================================================================
  mainCanvasDark: {
    backgroundColor: '#0F172A',
  },

  // SUBVIEW HEADER
  subViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 10,
  },
  subViewBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subViewBackArrow: {
    fontSize: 20,
    color: '#0D2B52',
    fontWeight: '700',
  },
  subViewHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D2B52',
  },
  subViewContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // MOCK HEADER (Screen 2: Arise Logo + MEDCORE + Bell)
  mockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  mockHeaderBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mockHeaderAriseLogo: {
    width: 50,
    height: 36,
    marginRight: 8,
  },
  mockHeaderBrandTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mockHeaderMed: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D2B52',
    letterSpacing: -0.5,
  },
  mockHeaderCore: {
    fontSize: 18,
    fontWeight: '900',
    color: '#00B4B4',
    letterSpacing: -0.5,
  },
  mockBellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mockBellIcon: {
    fontSize: 18,
  },
  mockBellBadgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // SCREEN 2: GREETING ROW
  greetingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 4,
  },
  greetingSubText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  greetingNameText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D2B52',
    letterSpacing: -0.3,
    marginVertical: 2,
  },
  greetingTagline: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  greetingAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#00B4B4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  greetingAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // SCREEN 2: NEXT APPOINTMENT NAVY HERO CARD
  nextApptNavyCard: {
    backgroundColor: '#0B2545',
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#0B2545',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  nextApptTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextApptIconContainer: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  nextApptTopLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#93C5FD',
    letterSpacing: 0.2,
  },
  nextApptMajorTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  nextApptDateTimeText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '600',
    marginBottom: 16,
  },
  nextApptViewDetailsPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  nextApptViewDetailsText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // SCREEN 2: 2x2 QUICK ACTION GRID
  quickGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickActionBox: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  quickIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D2B52',
  },

  // SCREEN 2: HEALTH TIPS CARD
  healthTipsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  healthTipsIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthTipsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D2B52',
    marginBottom: 2,
  },
  healthTipsSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  healthTipsChevron: {
    fontSize: 20,
    color: '#94A3B8',
    marginLeft: 6,
  },

  // SCREEN 2: INTEGRATED TELEHEALTH & FACILITY CARDS
  telehealthHomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.25)',
    marginBottom: 16,
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  telehealthLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  telehealthLiveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  stateCenterCard: {
    backgroundColor: '#0D2B52',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  stateCenterTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stateCenterBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#00B4B4',
    letterSpacing: 0.8,
  },
  stateCenterConfirmed: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: '#00B4B4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stateCenterName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  stateCenterAddress: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
    marginBottom: 12,
  },
  browseAllHospitalsBtn: {
    backgroundColor: '#00B4B4',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  browseAllHospitalsBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // SCREEN 3: APPOINTMENTS TAB
  mockScreenHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D2B52',
    letterSpacing: -0.3,
  },
  mockScreenHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 16,
  },
  segmentedToggleBox: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#0066FF',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // APPOINTMENT CARD (Screen 3)
  mockApptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  mockApptTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mockDocAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockDocAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mockDocName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D2B52',
  },
  mockDocSpecialty: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  mockDocChevron: {
    fontSize: 20,
    color: '#94A3B8',
  },
  mockApptDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  mockApptBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mockApptDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  statusBadgeConfirmed: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusBadgeConfirmedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusBadgePendingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  statusBadgeGray: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusBadgeGrayText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  bookNewApptBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  bookNewApptBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  facilityCardMini: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  facilityCodeTag: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0066FF',
  },
  facilityLgaTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  facilityNameTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D2B52',
    marginVertical: 3,
  },
  facilityTierSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  facilitySelectBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 102, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  facilitySelectBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066FF',
  },

  // SCREEN 4 & 5: BOOK APPOINTMENT STEPPER
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  stepCol: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: '#0066FF',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  stepCircleDone: {
    backgroundColor: '#10B981',
  },
  stepCircleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  stepCircleTextActive: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepCircleTextDone: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  stepLabelActive: {
    color: '#0066FF',
    fontWeight: '800',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
    marginBottom: 16,
  },
  stepConnectorActive: {
    backgroundColor: '#10B981',
  },

  // SCREEN 4: DOCTOR SEARCH & FILTERS
  doctorSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    marginBottom: 14,
    height: 46,
  },
  searchMagnifierIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  doctorSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0D2B52',
    fontWeight: '600',
  },
  filterChipScroll: {
    marginBottom: 16,
  },
  filterChipPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  filterChipPillActive: {
    backgroundColor: '#0066FF',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  mockSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D2B52',
    marginBottom: 12,
  },

  // DOCTOR LIST ITEM CARD (Screen 4)
  doctorListItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  docAvatarRound: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docAvatarRoundText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  docDetailsCol: {
    flex: 1,
    marginLeft: 14,
  },
  docNameTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D2B52',
  },
  docRatingTag: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  docSpecialtySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  docFacilityTag: {
    fontSize: 11,
    color: '#0066FF',
    fontWeight: '600',
    marginTop: 2,
  },
  docNextDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  docCalendarIconMini: {
    fontSize: 11,
    marginRight: 4,
  },
  docNextDateText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  docChevronIcon: {
    fontSize: 20,
    color: '#94A3B8',
    marginLeft: 6,
  },

  // SCREEN 5: CALENDAR & TIME SLOTS
  selectedDocSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  docAvatarRoundSm: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docAvatarRoundSmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  selectedDocName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D2B52',
  },
  selectedDocSpecialty: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  calendarMonthBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  calendarNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  calendarNavArrow: {
    fontSize: 22,
    color: '#0D2B52',
    paddingHorizontal: 10,
    fontWeight: '700',
  },
  calendarMonthTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D2B52',
  },
  calendarDaysHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarDayHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    width: 38,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calendarDayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  calendarDayCellSelected: {
    backgroundColor: '#0066FF',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarDayNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  calendarDayNumberSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  timeSlotPill: {
    width: '31%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  timeSlotPillActive: {
    backgroundColor: '#0066FF',
    borderColor: '#0066FF',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  timeSlotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  timeSlotTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  continuePrimaryBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  continuePrimaryBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // SCREEN 12: APPOINTMENT BOOKED SUCCESS
  bookingSuccessScreen: {
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 20,
  },
  successCheckCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
    marginBottom: 24,
  },
  successCheckMark: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  successHeading: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D2B52',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  successSubheading: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  successDetailsCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  successCalendarSquare: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCardDate: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D2B52',
  },
  successCardTime: {
    fontSize: 13,
    color: '#64748B',
    marginVertical: 2,
  },
  successCardDoc: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00B4B4',
  },
  viewApptsBtn: {
    width: '100%',
    backgroundColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  viewApptsBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  backHomeBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  backHomeBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D2B52',
  },

  // SCREEN 7: PRESCRIPTIONS
  prescriptionItemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  rxIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rxDrugName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D2B52',
  },
  rxChevron: {
    fontSize: 20,
    color: '#94A3B8',
  },
  rxDosageText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  rxPrescribedDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 6,
  },
  rxStatusPillGreen: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
  },
  rxStatusPillGreenText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  rxStatusPillGray: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
  },
  rxStatusPillGrayText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  requestRefillActionBtn: {
    backgroundColor: 'rgba(0, 102, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  requestRefillActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0066FF',
  },

  // SCREEN 8: LAB RESULTS
  labResultItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  labIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labTestCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D2B52',
  },
  labTestCardDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  normalBadgePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  normalBadgePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  helpDocCtaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 10,
  },
  helpDocIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpDocTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
    marginBottom: 3,
  },
  helpDocLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066FF',
  },

  // SCREEN 10: NOTIFICATIONS
  notificationCardItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  notifIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D2B52',
  },
  notifTimeTag: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  notifDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },

  // SCREEN 11: SETTINGS
  settingsMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsRowIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  settingsRowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D2B52',
  },
  settingsRowSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  settingsRowValue: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  settingsRowChevron: {
    fontSize: 20,
    color: '#94A3B8',
    marginLeft: 6,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: '#0066FF',
  },
  switchTrackOff: {
    backgroundColor: '#CBD5E1',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  switchThumbOff: {
    alignSelf: 'flex-start',
  },
  m87SettingsFootnote: {
    marginTop: 36,
    alignItems: 'center',
  },
  m87SettingsFootnoteText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // SCREEN 6: MEDICAL RECORDS TAB
  recordsSearchIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordsPillRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  recordsFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  recordsFilterPillActive: {
    backgroundColor: '#0066FF',
  },
  recordsFilterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  recordsFilterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  recordRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  recordIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordItemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D2B52',
  },
  recordItemMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  recordChevron: {
    fontSize: 20,
    color: '#94A3B8',
    marginLeft: 6,
  },
  badgeConsultation: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  badgeConsultationText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9333EA',
  },
  badgeLabResult: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  badgeLabResultText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
  },
  badgeImaging: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  badgeImagingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  downloadOfficialPdfBtn: {
    backgroundColor: 'rgba(0, 102, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  downloadOfficialPdfText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0066FF',
  },

  // SCREEN 9: PROFILE TAB
  profileTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsGearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileCardCentered: {
    alignItems: 'center',
    marginBottom: 28,
  },
  profileAvatarBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00B4B4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  profileAvatarBigText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  profileNameBold: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D2B52',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  profilePatientIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  profilePatientIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  profileMenuBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileRowIcon: {
    fontSize: 18,
    marginRight: 14,
  },
  profileRowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D2B52',
  },
  profileRowChevron: {
    fontSize: 20,
    color: '#94A3B8',
  },

  // 5-TAB FLOATING BOTTOM BAR
  mockBottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  mockBottomNavTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mockNavIconText: {
    fontSize: 20,
    opacity: 0.4,
    marginBottom: 2,
  },
  mockNavIconTextActive: {
    opacity: 1,
  },
  mockNavLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  mockNavLabelActive: {
    color: '#0066FF',
    fontWeight: '900',
  },

  // ── HOME TAB ENHANCEMENTS ──
  emergencySOSBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  emergencySOSLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emergencySOSPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginRight: 10,
  },
  emergencySOSLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  emergencySOSSub: {
    fontSize: 11,
    color: '#991B1B',
    marginTop: 1,
  },
  emergencySOSArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
  },
  homeQuickSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D2B52',
    letterSpacing: 0.3,
    marginTop: 18,
    marginBottom: 10,
  },

  // ── COMMON SUBVIEW STYLES ──
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D2B52',
    marginTop: 22,
    marginBottom: 12,
    letterSpacing: 0.2,
  },

  // ── EMERGENCY SOS (Phase 1) ──
  emergencyDispatchBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  emergencyDispatchPulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  emergencyDispatchTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  emergencyDispatchSub: {
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 2,
  },
  sosCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  sosGiantButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  sosPulseOuterRing: {
    position: 'absolute',
    width: 194,
    height: 194,
    borderRadius: 97,
    borderWidth: 3,
    borderColor: 'rgba(239, 68, 68, 0.28)',
  },
  sosPulseInnerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosBigLabel: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  sosTapCallLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FEE2E2',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  sosDirectNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D2B52',
    marginTop: 18,
    letterSpacing: 0.8,
  },
  sosTollFreeHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
  },
  nearestFacilityCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  facilityPinBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  facilityCardName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
  },
  facilityCardMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  facilityNavBtn: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  facilityNavBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emergencyContactRow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  emergencyContactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyContactName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
  },
  emergencyContactRole: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  emergencyContactPhone: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0066FF',
    marginTop: 2,
  },
  emergencyCallPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  emergencyCallPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  shareGpsBtn: {
    backgroundColor: '#0D2B52',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 24,
  },
  shareGpsBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // ── DIGITAL HEALTH CARD (Phase 1) ──
  healthCardPhysical: {
    backgroundColor: '#0D2B52',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#0D2B52',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 16,
  },
  healthCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    paddingBottom: 12,
  },
  healthCardLogo: {
    width: 28,
    height: 28,
  },
  healthCardBrandMed: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  healthCardBrandCore: {
    color: '#00B4B4',
  },
  healthCardBrandSub: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  healthCardVerifiedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  healthCardVerifiedText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#34D399',
    letterSpacing: 0.8,
  },
  healthCardMidSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  healthCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  healthCardPatientName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  healthCardValueBold: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  healthCardValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E2E8F0',
    marginTop: 2,
  },
  healthCardQRContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  healthCardQRMatrix: {
    width: 72,
    height: 72,
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  healthCardQRCell: {
    width: 8,
    height: 8,
  },
  healthCardQRScanHint: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 4,
  },
  healthCardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 10,
  },
  healthCardFooterLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  healthCardFooterValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 1,
  },
  healthCardActionBtnPrimary: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  healthCardActionBtnTextPrimary: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  healthCardActionBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0D2B52',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  healthCardActionBtnTextSecondary: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
  },

  // ── BILLING & PAYMENTS (Phase 1) ──
  billingSummaryCard: {
    backgroundColor: '#0D2B52',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  billingSummaryScheme: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  billingSummaryStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    marginTop: 2,
  },
  billingCoveredPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  billingCoveredPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#34D399',
  },
  billingDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 14,
  },
  billingStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  billingStatBox: {
    flex: 1,
  },
  billingStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  billingStatVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  billingPayNowBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingPayNowBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  billItemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  billIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billItemDesc: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
  },
  billItemMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  billItemAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0D2B52',
  },
  billStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  billStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  downloadInvoicesBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  downloadInvoicesBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066FF',
  },

  // ── MEDICATION REMINDERS (Phase 1) ──
  medAdherenceCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  medAdherenceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D2B52',
  },
  medAdherenceSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  medAdherenceCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0066FF',
  },
  medAdherenceCircleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0066FF',
  },
  medAdherenceBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  medAdherenceBarFill: {
    height: 6,
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  medScheduleCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  medScheduleCardTaken: {
    backgroundColor: '#F8FAFC',
    opacity: 0.82,
  },
  medScheduleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medScheduleName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
  },
  medScheduleNote: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  medScheduleTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 4,
  },
  medActionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  medActionPillTaken: {
    backgroundColor: '#DCFCE7',
  },
  medActionPillDue: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  medActionPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  refillPrescriptionBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  refillPrescriptionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // ── HEALTH VITALS TRACKER (Phase 2) ──
  vitalsSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  vitalsSummaryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  vitalsIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  vitalsMetricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D2B52',
  },
  vitalsMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  vitalsStatusTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 4,
  },
  vitalsLogRowCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  vitalsLogDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    paddingBottom: 8,
    marginBottom: 10,
  },
  vitalsLogDateText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D2B52',
  },
  vitalsLogClinicalBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00B4B4',
  },
  vitalsDataGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vitalsDataCell: {
    alignItems: 'center',
    flex: 1,
  },
  vitalsDataValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D2B52',
  },
  vitalsDataLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  logVitalsActionBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  logVitalsActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // ── FEEDBACK & ENGAGEMENT (Phase 2) ──
  feedbackHeaderCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  feedbackTargetDoctor: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0D2B52',
  },
  feedbackTargetFacility: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
    marginTop: 2,
  },
  feedbackTargetDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  feedbackRatingSection: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  feedbackRatePrompt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
    textAlign: 'center',
    marginBottom: 12,
  },
  feedbackStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starTouchItem: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  feedbackStarCountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 8,
  },
  feedbackTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  feedbackTagChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  feedbackTagChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  feedbackTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    color: '#0D2B52',
    minHeight: 90,
    marginBottom: 18,
  },
  feedbackSubmitBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  feedbackSubmitBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // ── MEDICAL TOURISM HUB (Phase 2) ──
  tourismHeroCard: {
    backgroundColor: '#0D2B52',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  tourismHeroBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  tourismHeroBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FBBF24',
    letterSpacing: 0.8,
  },
  tourismHeroTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  tourismHeroSub: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 4,
    lineHeight: 16,
  },
  tourismServiceCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tourismServiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourismServiceTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
  },
  tourismServiceDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  tourismContactBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  tourismContactBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // ── IMMUNIZATION RECORDS (Phase 2) ──
  immunizationHeaderCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  yellowCardBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  immunizationRegistryTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#92400E',
  },
  immunizationRegistrySub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  immunizationRowCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  immunizationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  immunizationVaccine: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
  },
  immunizationMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  immunizationStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  immunizationStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  scheduleVaccineBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  scheduleVaccineBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  downloadYellowCardBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  downloadYellowCardBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },

  // ── FAMILY & DEPENDENTS (Phase 3) ──
  familyBannerCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  familyBannerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1E40AF',
  },
  familyBannerSub: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
  },
  familyBadgePublic: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  familyBadgePublicText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  familyMemberCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  familyMemberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyMemberInitials: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  familyMemberName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
  },
  familyMemberRelation: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  familyMemberId: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0066FF',
    marginTop: 2,
  },
  switchChartPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  switchChartPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066FF',
  },
  addFamilyMemberBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  addFamilyMemberBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0066FF',
  },

  // ── MENTAL HEALTH & WELLNESS (Phase 3) ──
  mentalMoodCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  mentalMoodTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D2B52',
    textAlign: 'center',
  },
  mentalMoodSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 14,
  },
  moodSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  moodButtonCol: {
    alignItems: 'center',
  },
  moodCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  moodInnerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  moodLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
  },
  crisisHelplineCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  crisisHelplineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crisisHelplineTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  crisisHelplineNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: '#DC2626',
    marginTop: 2,
  },
  crisisHelplineDesc: {
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 6,
    lineHeight: 15,
  },
  crisisCallBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  crisisCallBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  mentalResourceRow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  mentalResourceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentalResourceTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
  },
  mentalResourceSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  bookTherapyBtn: {
    backgroundColor: '#00B4B4',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  bookTherapyBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // ── HEALTH EDUCATION (Phase 3) ──
  eduHeaderCard: {
    backgroundColor: '#0D2B52',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  eduVerifiedBadge: {
    backgroundColor: 'rgba(0, 180, 180, 0.25)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  eduVerifiedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#5EEAD4',
    letterSpacing: 0.8,
  },
  eduHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  eduHeaderSub: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 3,
    lineHeight: 16,
  },
  eduArticleCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  eduArticleBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eduArticleCategory: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  eduArticleReadTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  eduArticleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
    marginTop: 3,
  },
  eduArticleExcerpt: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 15,
  },

  // ── GLASSY DASHBOARD THEME & LAYOUT ──
  glassGreetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  glassSchemeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  glassSchemePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  glassSchemeBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.6,
  },
  glassGreetingName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D2B52',
    letterSpacing: -0.3,
  },
  glassGreetingTagline: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  glassAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00B4B4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  glassAvatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  glassAvatarOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Glass Emergency Ribbon
  glassSosRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(254, 242, 242, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(252, 165, 165, 0.65)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  glassSosLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  glassSosBeacon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassSosBeaconInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  glassSosTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  glassSosSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#991B1B',
    marginTop: 1,
  },
  glassSosActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  glassSosActionBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#DC2626',
    marginRight: 2,
  },

  // Hero Glass Appointment Card
  heroGlassApptCard: {
    backgroundColor: 'rgba(13, 43, 82, 0.96)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 180, 180, 0.35)',
    marginBottom: 20,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  heroGlassGlowDeco: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 180, 180, 0.18)',
  },
  heroGlassTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroGlassLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 180, 180, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  heroGlassPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00B4B4',
    marginRight: 6,
  },
  heroGlassLiveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#5EEAD4',
    letterSpacing: 0.5,
  },
  heroGlassStatusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroGlassStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
  },
  heroGlassDocName: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroGlassSpecialty: {
    fontSize: 13,
    fontWeight: '700',
    color: '#93C5FD',
    marginTop: 2,
  },
  heroGlassFacility: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.72)',
    marginTop: 2,
    marginBottom: 12,
  },
  heroGlassTimePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  heroGlassTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  heroGlassTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
    marginLeft: 6,
  },
  heroGlassActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroGlassPrimaryBtn: {
    flex: 1,
    backgroundColor: '#00B4B4',
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  heroGlassPrimaryBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroGlassSecondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlassSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Glass Section Headers
  glassSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  glassSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D2B52',
    letterSpacing: -0.2,
  },
  glassSectionLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066FF',
  },
  glassSectionHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // 2x2 Glass Tiles
  glassGrid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  glassTile: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  glassTileIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  glassTileTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D2B52',
  },
  glassTileSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // Horizontal Glass Hub Carousel
  glassHubScrollView: {
    marginBottom: 20,
    marginHorizontal: -4,
  },
  glassHubScrollContent: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  glassHubCard: {
    width: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 13,
    marginRight: 10,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  glassHubIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  glassHubCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D2B52',
  },
  glassHubCardSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },

  // Daily Vitals Glass Widget
  glassVitalsWidget: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  glassVitalsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  glassVitalsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  glassVitalsTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0D2B52',
  },
  glassVitalsLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066FF',
  },
  glassVitalsPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  glassVitalItemPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  glassVitalItemLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  glassVitalItemVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0D2B52',
    marginVertical: 2,
  },
  glassVitalItemTag: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },

  // Facility & Care Navigation Glass Card
  glassFacilityCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  glassFacilityHeader: {
    marginBottom: 10,
  },
  glassFacilityTag: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00B4B4',
    letterSpacing: 0.8,
  },
  glassFacilityName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D2B52',
    marginTop: 2,
  },
  glassFacilitySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  glassChecklistDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  glassChecklistHeadline: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D2B52',
    marginBottom: 10,
  },
  glassCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  glassBrowseHospitalsBtn: {
    backgroundColor: 'rgba(0, 180, 180, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.3)',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 12,
  },
  glassBrowseHospitalsBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#008B8B',
  },

  // Preventive Health Tip Glass Banner
  glassHealthTipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 26,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  glassHealthTipIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 180, 180, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassHealthTipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
  },
  glassHealthTipSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },

  // -------------------------------------------------------------------------
  // LAB RESULT CARD HINTS & OPEN HINTS
  // -------------------------------------------------------------------------
  labCardDocHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  labCardDocHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#008B8B',
    marginLeft: 4,
  },
  recordItemOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  recordItemOpenHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#008B8B',
    marginLeft: 4,
  },

  // -------------------------------------------------------------------------
  // CLINICAL DIAGNOSTIC REPORT DOCUMENT VIEWER MODAL
  // -------------------------------------------------------------------------
  docViewerSafeArea: {
    flex: 1,
    backgroundColor: '#0B1527',
  },
  docViewerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F1E36',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  docViewerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docViewerCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  docViewerTopTitleBox: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'center',
  },
  docViewerSecureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 2,
  },
  docViewerGreenLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  docViewerSecureBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  docViewerTopTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  docViewerShareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docViewerScrollView: {
    flex: 1,
    backgroundColor: '#0B1527',
  },
  docViewerScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  docPaperSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  docEmblemBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  docEmblemInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docEmblemLetter: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  docEmblemCrown: {
    width: 8,
    height: 2,
    backgroundColor: '#FCD34D',
    position: 'absolute',
    top: 4,
  },
  docHeaderTitleCol: {
    flex: 1,
  },
  docStateMinistryText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  docStateDeptText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#00B4B4',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  docFacilityHeading: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0D2B52',
    marginTop: 2,
  },
  docIsoAccreditation: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#059669',
    marginTop: 1,
  },
  docDividingLineThick: {
    height: 2,
    backgroundColor: '#0D2B52',
    marginVertical: 10,
  },
  docBarcodeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  docMetaSmallLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
  },
  docMetaValueMono: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  docMetaSubSmall: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#0284C7',
    marginTop: 2,
  },
  docBarcodeContainer: {
    alignItems: 'flex-end',
  },
  docBarcodeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
  },
  docBarcodeNumText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#64748B',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  docPatientGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 12,
  },
  docPatientGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  docPatientGridCol: {
    flex: 1,
    paddingRight: 6,
  },
  docGridLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
  },
  docGridValueBold: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0D2B52',
    marginTop: 1,
  },
  docGridValueMono: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0066FF',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  docGridValue: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 1,
  },
  docTitleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 4,
    borderLeftColor: '#0066FF',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  docTitleBannerCategory: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0066FF',
    letterSpacing: 0.5,
  },
  docTitleBannerMain: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0D2B52',
    marginTop: 2,
  },
  docCertifiedStamp: {
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
    transform: [{ rotate: '-5deg' }],
  },
  docCertifiedStampText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 0.8,
  },
  docCertifiedStampSub: {
    fontSize: 6.5,
    fontWeight: '700',
    color: '#059669',
  },
  docTableWrap: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  docTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  docTableTh: {
    fontSize: 8,
    fontWeight: '800',
    color: '#475569',
  },
  docTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  docTableRowStripe: {
    backgroundColor: '#FAFCFF',
  },
  docTableTdParam: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  docTableTdValue: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D2B52',
  },
  docTableTdUnit: {
    fontSize: 8.5,
    color: '#64748B',
  },
  docTableTdRef: {
    fontSize: 8.5,
    color: '#64748B',
  },
  docParamBadgePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docParamBadgePillText: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#15803D',
  },
  docInterpretationBox: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  docInterpretationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  docInterpretationIconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CA8A04',
    marginRight: 6,
  },
  docInterpretationTitle: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#854D0E',
    letterSpacing: 0.4,
  },
  docInterpretationBody: {
    fontSize: 10.5,
    color: '#713F12',
    lineHeight: 15,
  },
  docSignOffSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginBottom: 10,
  },
  docSignOffCol: {
    flex: 1,
  },
  docSignStrokeLine: {
    width: 130,
    height: 1.5,
    backgroundColor: '#94A3B8',
    marginBottom: 5,
  },
  docSignDoctorName: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0D2B52',
  },
  docSignDoctorRole: {
    fontSize: 8.5,
    color: '#64748B',
    marginTop: 1,
  },
  docSignFacilityCode: {
    fontSize: 8,
    color: '#94A3B8',
    marginTop: 1,
  },
  docDigitalSealBox: {
    alignItems: 'center',
  },
  docDigitalSealCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  docDigitalSealCircleText: {
    fontSize: 6,
    fontWeight: '800',
    color: '#0066FF',
  },
  docDigitalSealCircleCenter: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#0066FF',
  },
  docDigitalSealCircleSub: {
    fontSize: 6,
    fontWeight: '800',
    color: '#0066FF',
  },
  docDigitalHashText: {
    fontSize: 6.5,
    fontWeight: '700',
    color: '#94A3B8',
    fontFamily: 'monospace',
    marginTop: 3,
  },
  docSecurityFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 4,
  },
  docSecurityFooterText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  docSecurityFooterSub: {
    fontSize: 7,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  docActionsContainer: {
    marginTop: 14,
  },
  docDownloadPdfPrimaryBtn: {
    backgroundColor: '#00B4B4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  docDownloadPdfPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  docActionSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  docSecondaryActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  docSecondaryActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // -------------------------------------------------------------------------
  // DASHBOARD LATEST DIAGNOSTIC DOCUMENT CARD
  // -------------------------------------------------------------------------
  glassLatestDocCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 180, 180, 0.35)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  glassLatestDocTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  glassLatestDocBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  glassDocGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  glassLatestDocBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  glassCertifiedPill: {
    backgroundColor: 'rgba(0, 102, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  glassCertifiedPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0066FF',
  },
  glassLatestDocBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glassLatestDocIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 180, 180, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 180, 0.2)',
  },
  glassLatestDocTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0D2B52',
  },
  glassLatestDocMeta: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  glassLatestDocParamsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  glassLatestDocParamChip: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0284C7',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    marginTop: 2,
  },
  glassLatestDocActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  glassLatestDocOpenText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#008B8B',
  },
  glassLatestDocArrowCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#00B4B4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassCategorySection: {
    marginBottom: 16,
  },
  glassCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  glassCatIconDot: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  glassCategoryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D2B52',
    flex: 1,
  },
  glassCategoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  glassCategoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  s2FootnoteM87Bold: {
    fontWeight: '800',
    color: '#0066FF',
  },
  authBgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  authBgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 12, 26, 0.78)',
  },
  figmaLangPillGlass: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  figmaLangTextGlass: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  authGlassLogoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 16,
    width: '100%',
  },
  authStateTagGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 102, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  authStateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  authStateTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.6,
  },
  figmaTitleGlass: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
    textAlign: 'center',
  },
  figmaSubtitleGlass: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});

export default App;
