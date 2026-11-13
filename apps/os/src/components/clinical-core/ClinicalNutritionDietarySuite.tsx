'use client';

/**
 * ClinicalNutritionDietarySuite — Inpatient Diet Orders & Clinical Nutrition.
 * Manages specialized inpatient therapeutic diets (Diabetic, Renal, Low Sodium, NPO,
 * Enteral NG tube feeds, High Protein, Soft/Pureed), food allergies, and tray delivery tracking.
 */

import React, { useState } from 'react';
import {
  Utensils, Plus, CheckCircle2, AlertTriangle, Clock,
  Search, Check, ShieldAlert, Sparkles
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { listPatients, type RegisteredPatient } from '../../lib/patientRegistryStore';

export type DietType =
  | 'Regular / House Diet'
  | 'Diabetic (Controlled Carbs)'
  | 'Low Sodium / Cardiac (Renal friendly)'
  | 'Renal Diet (Low K+, Low PO4, Protein-limited)'
  | 'Nil Per Os (NPO / Strict Fasting)'
  | 'Clear Liquids Only'
  | 'Soft / Pureed / Dysphagia'
  | 'Enteral Tube Feed (NG / PEG)'
  | 'Total Parenteral Nutrition (TPN)';

export interface InpatientDietOrder {
  id: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  ward: string;
  bedNumber: string;
  dietType: DietType;
  foodAllergies: string[];
  fluidRestrictionMl?: number;
  enteralFormulaRate?: string;
  orderedBy: string;
  orderedAt: string;
  breakfastDelivered: boolean;
  lunchDelivered: boolean;
  dinnerDelivered: boolean;
  specialInstructions?: string;
}

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

export const ClinicalNutritionDietarySuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';

  const [patients] = useState<RegisteredPatient[]>(() => {
    try {
      return listPatients(facilityId);
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<InpatientDietOrder[]>([
    {
      id: 'DIET-01',
      patientId: 'pt-101',
      patientName: 'Madam Alice Ekanem',
      hospitalNumber: 'IGH-2026-3012',
      ward: 'Female Medical Ward',
      bedNumber: 'Bed FMW-04',
      dietType: 'Diabetic (Controlled Carbs)',
      foodAllergies: ['Crustacean Shellfish', 'Peanuts'],
      orderedBy: 'Dr. Edidiong Bassey',
      orderedAt: '2026-11-13 07:15',
      breakfastDelivered: true,
      lunchDelivered: true,
      dinnerDelivered: false,
      specialInstructions: 'Provide whole grain oat swallow or vegetable soup. Zero sucrose or sweetened beverages.',
    },
    {
      id: 'DIET-02',
      patientId: 'pt-102',
      patientName: 'Pastor Emmanuel Okon',
      hospitalNumber: 'IGH-2026-2910',
      ward: 'Male Surgical Ward',
      bedNumber: 'Bed MSW-08',
      dietType: 'Nil Per Os (NPO / Strict Fasting)',
      foodAllergies: [],
      orderedBy: 'Dr. Kalu (Surgeon)',
      orderedAt: '2026-11-13 06:00',
      breakfastDelivered: false,
      lunchDelivered: false,
      dinnerDelivered: false,
      specialInstructions: 'Scheduled for exploratory laparotomy at 14:00. STRICT NPO. No water or oral fluids.',
    },
    {
      id: 'DIET-03',
      patientId: 'pt-103',
      patientName: 'Chief Aniefiok Udo',
      hospitalNumber: 'IGH-2026-1184',
      ward: 'ICU / High Dependency Unit',
      bedNumber: 'Bed ICU-02',
      dietType: 'Enteral Tube Feed (NG / PEG)',
      foodAllergies: ['Cow Milk Protein'],
      enteralFormulaRate: 'Fresubin HP 60 mL/hr via NG pump',
      orderedBy: 'Dr. Eno (Intensivist)',
      orderedAt: '2026-11-13 08:00',
      breakfastDelivered: true,
      lunchDelivered: true,
      dinnerDelivered: false,
      specialInstructions: 'Elevate head of bed 30°-45° during continuous infusion. Check gastric residual volume q4h.',
    },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDiet, setFilterDiet] = useState<string>('all');

  const handleToggleMeal = (orderId: string, meal: 'breakfastDelivered' | 'lunchDelivered' | 'dinnerDelivered') => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, [meal]: !o[meal] } : o))
    );
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.hospitalNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.bedNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDiet = filterDiet === 'all' || o.dietType === filterDiet;
    return matchesSearch && matchesDiet;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 28px', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FEF3C7', color: '#92400E', padding: '3px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
            <Utensils size={14} /> Clinical Nutrition & Catering Services
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#0F172A' }}>
            Inpatient Therapeutic Diet Orders & Kitchen Tray Dispatch
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            Physician Therapeutic Diets · NPO Alerts · Enteral Feeds & Food Allergy Guard
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={filterDiet}
            onChange={(e) => setFilterDiet(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.82rem', background: '#FFF' }}
          >
            <option value="all">All Diets</option>
            <option value="Nil Per Os (NPO / Strict Fasting)">Strict NPO (Fasting)</option>
            <option value="Diabetic (Controlled Carbs)">Diabetic Diets</option>
            <option value="Enteral Tube Feed (NG / PEG)">Enteral Tube Feeds</option>
            <option value="Low Sodium / Cardiac (Renal friendly)">Low Sodium / Cardiac</option>
          </select>
        </div>
      </div>

      {/* Search & Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700 }}>Total Inpatient Diets</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{orders.length}</div>
        </div>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', color: '#DC2626', fontWeight: 700 }}>Strict NPO (Pre-Op / Fasting)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#DC2626', marginTop: 4 }}>
            {orders.filter((o) => o.dietType.includes('NPO')).length}
          </div>
        </div>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', color: '#0369A1', fontWeight: 700 }}>Diabetic & Renal Diets</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0369A1', marginTop: 4 }}>
            {orders.filter((o) => o.dietType.includes('Diabetic') || o.dietType.includes('Renal')).length}
          </div>
        </div>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', color: '#D97706', fontWeight: 700 }}>Enteral / Tube Feeding</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#D97706', marginTop: 4 }}>
            {orders.filter((o) => o.dietType.includes('Enteral')).length}
          </div>
        </div>
      </div>

      {/* Orders List Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Search by patient name, bed number, or hospital folder no…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', maxWidth: 400, padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredOrders.map((o) => {
            const isNpo = o.dietType.includes('NPO');
            return (
              <div
                key={o.id}
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  border: isNpo ? '2px solid #FCA5A5' : '1px solid #E2E8F0',
                  background: isNpo ? '#FEF2F2' : '#F8FAFC',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.96rem', color: isNpo ? '#991B1B' : '#0F172A' }}>
                        {o.patientName}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#64748B' }}>({o.hospitalNumber})</span>
                      <span style={{ padding: '2px 8px', borderRadius: 6, background: '#E2E8F0', color: '#334155', fontWeight: 700, fontSize: '0.72rem' }}>
                        {o.ward} · {o.bedNumber}
                      </span>
                    </div>

                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontWeight: 800,
                          fontSize: '0.76rem',
                          background: isNpo ? '#DC2626' : '#0284C7',
                          color: '#FFF',
                        }}
                      >
                        {o.dietType}
                      </span>
                      {o.enteralFormulaRate && (
                        <span style={{ fontSize: '0.74rem', color: '#D97706', fontWeight: 700 }}>
                          Rate: {o.enteralFormulaRate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Meal Delivery Verification Toggles */}
                  {!isNpo ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {(['breakfastDelivered', 'lunchDelivered', 'dinnerDelivered'] as const).map((meal) => {
                        const isDelivered = o[meal];
                        const label = meal === 'breakfastDelivered' ? 'Breakfast' : meal === 'lunchDelivered' ? 'Lunch' : 'Dinner';
                        return (
                          <button
                            key={meal}
                            type="button"
                            onClick={() => handleToggleMeal(o.id, meal)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: isDelivered ? '1.5px solid #059669' : '1px solid #CBD5E1',
                              background: isDelivered ? '#ECFDF5' : '#FFF',
                              color: isDelivered ? '#065F46' : '#64748B',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {isDelivered && <Check size={13} color="#059669" />}
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ padding: '6px 12px', borderRadius: 8, background: '#FEE2E2', color: '#DC2626', fontWeight: 900, fontSize: '0.76rem' }}>
                      DO NOT SERVE FOOD OR WATER
                    </span>
                  )}
                </div>

                {o.foodAllergies.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: '#B91C1C', fontWeight: 700, marginTop: 6 }}>
                    <ShieldAlert size={14} /> Food Allergies: {o.foodAllergies.join(', ')}
                  </div>
                )}

                {o.specialInstructions && (
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 4 }}>
                    <strong>Clinical Note:</strong> {o.specialInstructions}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ClinicalNutritionDietarySuite;
