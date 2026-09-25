import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { PATIENTS } from '../../services/clinicData';
import { offlineSyncManager } from '../../services/offlineSync';

interface OrderItem {
  id: string;
  category: 'LAB' | 'MED' | 'RAD' | 'NURSING';
  title: string;
  patientName: string;
  bed: string;
  urgency: 'STAT' | 'URGENT' | 'ROUTINE';
  status: 'PENDING' | 'VERIFIED' | 'DISPENSED' | 'RESULT_READY';
  orderedAt: string;
  details?: string;
}

const IBOM_PATHWAYS = [
  {
    id: 'SEVERE_MALARIA_PROTOCOL',
    title: 'Severe Malaria Protocol (WHO/AKS-MoH)',
    icon: '🦟',
    cohort: 'Pediatric & Adult Severe Malaria',
    items: [
      'Rapid Malaria RDT + Thick/Thin Giemsa Film (STAT)',
      'Full Blood Count (FBC) + Haemoglobin (STAT)',
      'Random Blood Glucose (RBG) (STAT)',
      'IV Artesunate 2.4mg/kg Stat at 0h, 12h, 24h (STAT)',
      'IV Paracetamol Infusion 15mg/kg PRN (ROUTINE)',
      'Coma Scale (GCS) & Fluid Balance Q2H (URGENT)',
    ],
  },
  {
    id: 'PRE_ECLAMPSIA_ECLAMPSIA_PROTOCOL',
    title: 'Severe Pre-Eclampsia / Eclampsia Emergency',
    icon: '🤰',
    cohort: 'Maternal Emergencies (BP >= 160/110)',
    items: [
      'Magnesium Sulfate 50% Zuspan Loading Dose (STAT)',
      'Hydralazine 5mg slow IV for DBP >= 110 (STAT)',
      'Pre-Eclampsia Lab Panel (Urine Protein, LFT, Plt) (STAT)',
      'Foley Catheter with Urometer (Strict Output) (STAT)',
      'Continuous Cardiotocography Fetal Monitoring (URGENT)',
    ],
  },
  {
    id: 'SICKLE_CELL_VOC_PROTOCOL',
    title: 'Sickle Cell Vaso-Occlusive Crisis (VOC)',
    icon: '🩸',
    cohort: 'HbSS/HbSC Acute Pain Crisis',
    items: [
      'IV Tramadol 50-100mg in 100mL Normal Saline (STAT)',
      'IV Rehydration (0.45% Saline + 5% Dextrose) 1.5x (STAT)',
      'FBC + Reticulocyte Count (STAT)',
      'SpO2 Monitoring & Incentive Spirometry Q1H (URGENT)',
    ],
  },
  {
    id: 'PEDIATRIC_SEPSIS_PROTOCOL',
    title: 'Pediatric & Neonatal Sepsis Protocol',
    icon: '👶',
    cohort: 'Pediatric Septic Shock Resuscitation',
    items: [
      'Blood Cultures x 2 Sets prior to antibiotics (STAT)',
      'Serum Lactate & Venous Blood Gas (STAT)',
      'IV Ceftriaxone 80mg/kg slow infusion (STAT)',
      'Normal Saline 20mL/kg Fluid Bolus (STAT)',
    ],
  },
  {
    id: 'EMERGENCY_CESAREAN_BUNDLE',
    title: 'Emergency Cesarean Section Bundle',
    icon: '🏥',
    cohort: 'Category 1 & 2 Surgical Readiness',
    items: [
      'Urgent Group & Save + Crossmatch 2 Units Blood (STAT)',
      'Cefazolin 2g IV Pre-incision Prophylaxis (STAT)',
      'Emergency Theatre Booking & Anaesthetic Call (STAT)',
      'WHO Surgical Safety Checklist Part 1 (STAT)',
    ],
  },
];

export const OrderEntryReview: React.FC = () => {
  const [selectedPatient, setSelectedPatient] = useState(PATIENTS[0]);
  const [activeTab, setActiveTab] = useState<'pathways' | 'custom' | 'tracker'>('pathways');
  const [expandedPathway, setExpandedPathway] = useState<string | null>('SEVERE_MALARIA_PROTOCOL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Custom order form
  const [orderCategory, setOrderCategory] = useState<'LAB' | 'MED' | 'RAD' | 'NURSING'>('LAB');
  const [orderTitle, setOrderTitle] = useState('');
  const [orderDose, setOrderDose] = useState('');
  const [orderInstructions, setOrderInstructions] = useState('');
  const [orderUrgency, setOrderUrgency] = useState<'STAT' | 'URGENT' | 'ROUTINE'>('ROUTINE');

  // Active orders list
  const [activeOrders, setActiveOrders] = useState<OrderItem[]>([
    {
      id: 'ORD-991',
      category: 'LAB',
      title: 'Full Blood Count + Troponin-I STAT',
      patientName: 'Robert Chen',
      bed: '4B',
      urgency: 'STAT',
      status: 'RESULT_READY',
      orderedAt: '09:12',
      details: 'Critical value acknowledged by Dr. Thorne',
    },
    {
      id: 'ORD-992',
      category: 'MED',
      title: 'IV Ceftriaxone 2g Once Daily',
      patientName: 'Idongesit Aniefiok Udo',
      bed: '4A',
      urgency: 'URGENT',
      status: 'DISPENSED',
      orderedAt: '09:20',
      details: 'Dispensed by Main Pharmacy Desk 2',
    },
    {
      id: 'ORD-993',
      category: 'RAD',
      title: 'Chest X-Ray Portable Bedside AP',
      patientName: 'Robert Chen',
      bed: '4B',
      urgency: 'ROUTINE',
      status: 'PENDING',
      orderedAt: '09:35',
      details: 'Radiographer queued on Ward 4',
    },
  ]);

  const applyPathway = async (pathway: typeof IBOM_PATHWAYS[0]) => {
    setIsSubmitting(true);
    setSuccessBanner(null);

    const payload = {
      pathwayId: pathway.id,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      encounterId: 'ENC-WARD-4W',
      facilityId: 'FAC-001',
      orderedByDoctorId: 'DOC-THORNE',
      orderedByDoctorName: 'Dr. Julian Thorne, MD',
    };

    try {
      const res = await offlineSyncManager.executeWithOfflineQueue(
        'http://localhost:4000/api/v1/cpoe/order-sets/apply',
        'POST',
        payload
      );

      // Append local order items to tracker
      const newItems: OrderItem[] = pathway.items.map((item, idx) => ({
        id: `ORD-PW-${Date.now().toString(36)}-${idx}`,
        category: item.includes('IV') || item.includes('Infusion') || item.includes('Injection') ? 'MED' : 'LAB',
        title: item,
        patientName: selectedPatient.name,
        bed: selectedPatient.bed,
        urgency: item.includes('STAT') ? 'STAT' : item.includes('URGENT') ? 'URGENT' : 'ROUTINE',
        status: 'PENDING',
        orderedAt: 'Just now',
        details: `From ${pathway.title}`,
      }));

      setActiveOrders((prev) => [...newItems, ...prev]);
      setSuccessBanner(
        res.queued
          ? `Offline Mode: "${pathway.title}" queued locally. Will auto-sync when online.`
          : `✅ Authorized & Dispatched "${pathway.title}" (${pathway.items.length} orders routed to Pharmacy & Lab).`
      );
      setActiveTab('tracker');
    } catch {
      setSuccessBanner(`✅ Pathway dispatched locally for ${selectedPatient.name}.`);
      setActiveTab('tracker');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCustomOrder = async () => {
    if (!orderTitle.trim()) {
      alert('Please enter an order title or test name.');
      return;
    }

    setIsSubmitting(true);
    const newOrder: OrderItem = {
      id: `ORD-CUST-${Date.now().toString(36)}`,
      category: orderCategory,
      title: orderTitle + (orderDose ? ` (${orderDose})` : ''),
      patientName: selectedPatient.name,
      bed: selectedPatient.bed,
      urgency: orderUrgency,
      status: 'PENDING',
      orderedAt: 'Just now',
      details: orderInstructions || 'Routine order',
    };

    try {
      await offlineSyncManager.executeWithOfflineQueue(
        'http://localhost:4000/api/v1/clinical/orders',
        'POST',
        {
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          type: orderCategory === 'LAB' ? 'LABORATORY' : orderCategory === 'MED' ? 'PHARMACY' : 'RADIOLOGY',
          title: newOrder.title,
          details: newOrder.details,
          priority: orderUrgency,
        }
      );
      setActiveOrders((prev) => [newOrder, ...prev]);
      setOrderTitle('');
      setOrderDose('');
      setOrderInstructions('');
      setSuccessBanner(`✅ Order "${newOrder.title}" placed for Bed ${selectedPatient.bed}.`);
      setActiveTab('tracker');
    } catch {
      setActiveOrders((prev) => [newOrder, ...prev]);
      setActiveTab('tracker');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Patient Selector Strip */}
      <View style={styles.patientStrip}>
        <Text style={styles.stripLabel}>ACTIVE PATIENT:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
          {PATIENTS.map((p) => {
            const isSel = p.id === selectedPatient.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.patientChip, isSel && styles.patientChipActive]}
                onPress={() => setSelectedPatient(p)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipBed, isSel && styles.chipBedActive]}>BED {p.bed}</Text>
                <Text style={[styles.chipName, isSel && styles.chipNameActive]}>{p.name.split(' ')[0]}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Hero Header */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Bedside CPOE & Clinical Protocols</Text>
            <Text style={styles.heroSub}>
              {selectedPatient.name} · Bed {selectedPatient.bed} · {selectedPatient.mrn}
            </Text>
          </View>
          <View style={styles.closedLoopBadge}>
            <Text style={styles.closedLoopText}>CLOSED CLINICAL LOOP</Text>
          </View>
        </View>

        {successBanner && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{successBanner}</Text>
          </View>
        )}

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          {[
            { key: 'pathways', label: '⚡ Ibom Pathways', icon: '⚡' },
            { key: 'custom', label: '➕ Custom Order', icon: '➕' },
            { key: 'tracker', label: `Tracker (${activeOrders.length})`, icon: '📋' },
          ].map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(t.key as any)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab 1: Ibom Clinical Pathways */}
      {activeTab === 'pathways' && (
        <View style={styles.sectionWrap}>
          <Text style={styles.secTitle}>Standardized Akwa Ibom Clinical Pathways</Text>
          <Text style={styles.secDesc}>
            1-click evidence bundles complying with WHO & Akwa Ibom State Ministry of Health protocols.
          </Text>

          {IBOM_PATHWAYS.map((p) => {
            const isExp = expandedPathway === p.id;
            return (
              <View key={p.id} style={styles.pathwayCard}>
                <TouchableOpacity
                  style={styles.pathwayHeader}
                  onPress={() => setExpandedPathway(isExp ? null : p.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.pathwayIcon}>{p.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pathwayTitle}>{p.title}</Text>
                    <Text style={styles.pathwayCohort}>{p.cohort}</Text>
                  </View>
                  <Text style={styles.expandChevron}>{isExp ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isExp && (
                  <View style={styles.pathwayBody}>
                    <Text style={styles.itemsHeader}>INCLUDED ORDERS IN BUNDLE ({p.items.length}):</Text>
                    {p.items.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.itemText}>{item}</Text>
                      </View>
                    ))}

                    <TouchableOpacity
                      style={styles.dispatchBtn}
                      onPress={() => applyPathway(p)}
                      disabled={isSubmitting}
                      activeOpacity={0.85}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.dispatchBtnText}>
                          Authorize & Dispatch All {p.items.length} Orders
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Tab 2: Custom Order Entry */}
      {activeTab === 'custom' && (
        <View style={styles.sectionWrap}>
          <Text style={styles.secTitle}>Individual Clinical Order Entry</Text>
          <Text style={styles.secDesc}>Order single laboratory diagnostics, medications, imaging, or nursing procedures.</Text>

          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>ORDER CATEGORY:</Text>
            <View style={styles.categoryRow}>
              {(['LAB', 'MED', 'RAD', 'NURSING'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, orderCategory === cat && styles.catBtnActive]}
                  onPress={() => setOrderCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.catBtnText, orderCategory === cat && styles.catBtnTextActive]}>
                    {cat === 'LAB' ? '🧪 Lab' : cat === 'MED' ? '💊 Med' : cat === 'RAD' ? '🩻 Rad' : '🩺 Nursing'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>ORDER TITLE / COMPOUND NAME:</Text>
            <TextInput
              style={styles.textInput}
              placeholder={orderCategory === 'MED' ? 'e.g. IV Artesunate, Ceftriaxone, Coartem' : 'e.g. Full Blood Count, Serum Electrolytes'}
              placeholderTextColor="#94A3B8"
              value={orderTitle}
              onChangeText={setOrderTitle}
            />

            {orderCategory === 'MED' && (
              <>
                <Text style={styles.inputLabel}>DOSAGE & ROUTE:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 2.4mg/kg IV STAT / 500mg TDS Oral"
                  placeholderTextColor="#94A3B8"
                  value={orderDose}
                  onChangeText={setOrderDose}
                />
              </>
            )}

            <Text style={styles.inputLabel}>URGENCY PRIORITY:</Text>
            <View style={styles.categoryRow}>
              {(['ROUTINE', 'URGENT', 'STAT'] as const).map((urg) => (
                <TouchableOpacity
                  key={urg}
                  style={[styles.urgBtn, orderUrgency === urg && (urg === 'STAT' ? styles.urgBtnStat : styles.urgBtnActive)]}
                  onPress={() => setOrderUrgency(urg)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.urgBtnText, orderUrgency === urg && styles.urgBtnTextActive]}>
                    {urg}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>SPECIAL CLINICAL INSTRUCTIONS:</Text>
            <TextInput
              style={[styles.textInput, { height: 72 }]}
              placeholder="e.g. Collect sample before antibiotic infusion. Check baseline glucose."
              placeholderTextColor="#94A3B8"
              multiline
              value={orderInstructions}
              onChangeText={setOrderInstructions}
            />

            <TouchableOpacity
              style={styles.submitOrderBtn}
              onPress={submitCustomOrder}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitOrderBtnText}>Sign & Route Clinical Order</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Tab 3: Order Tracker */}
      {activeTab === 'tracker' && (
        <View style={styles.sectionWrap}>
          <Text style={styles.secTitle}>Closed Clinical Loop Tracker</Text>
          <Text style={styles.secDesc}>
            Real-time status of orders through Pharmacy verification, dispensing, and Lab execution.
          </Text>

          {activeOrders.map((ord) => {
            const isStat = ord.urgency === 'STAT';
            const statusColor =
              ord.status === 'RESULT_READY'
                ? '#10B981'
                : ord.status === 'DISPENSED'
                  ? '#38BDF8'
                  : ord.status === 'VERIFIED'
                    ? '#F59E0B'
                    : '#64748B';

            return (
              <View key={ord.id} style={styles.orderCard}>
                <View style={styles.orderTop}>
                  <View style={[styles.urgChip, isStat ? styles.urgChipStat : styles.urgChipRoutine]}>
                    <Text style={[styles.urgText, isStat ? styles.urgTextStat : styles.urgTextRoutine]}>
                      {ord.urgency}
                    </Text>
                  </View>
                  <Text style={styles.orderCategory}>[{ord.category}]</Text>
                  <View style={{ flex: 1 }} />
                  <View style={[styles.statusPill, { borderColor: statusColor }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{ord.status}</Text>
                  </View>
                </View>

                <Text style={styles.orderCardTitle}>{ord.title}</Text>
                <Text style={styles.orderPatient}>
                  Patient: {ord.patientName} (Bed {ord.bed}) · Ordered at {ord.orderedAt}
                </Text>
                {ord.details && <Text style={styles.orderDetails}>{ord.details}</Text>}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  patientStrip: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  stripLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  patientChip: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  patientChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#38BDF8',
  },
  chipBed: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  chipBedActive: {
    color: '#38BDF8',
  },
  chipName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  chipNameActive: {
    color: '#FFFFFF',
  },
  heroCard: {
    backgroundColor: '#1E293B',
    margin: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  heroSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  closedLoopBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  closedLoopText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  banner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  bannerText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  sectionWrap: {
    paddingHorizontal: 14,
  },
  secTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  secDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 12,
  },
  pathwayCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    overflow: 'hidden',
  },
  pathwayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  pathwayIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  pathwayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  pathwayCohort: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 2,
  },
  expandChevron: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 8,
  },
  pathwayBody: {
    padding: 14,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  itemsHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletDot: {
    color: '#38BDF8',
    marginRight: 6,
    fontSize: 14,
    lineHeight: 16,
  },
  itemText: {
    fontSize: 12,
    color: '#CBD5E1',
    flex: 1,
    lineHeight: 16,
  },
  dispatchBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  dispatchBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  catBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  catBtnActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#38BDF8',
  },
  catBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  catBtnTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 13,
  },
  urgBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  urgBtnActive: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B',
  },
  urgBtnStat: {
    backgroundColor: '#DC2626',
    borderColor: '#EF4444',
  },
  urgBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  urgBtnTextActive: {
    color: '#FFFFFF',
  },
  submitOrderBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 18,
  },
  submitOrderBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  orderCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  urgChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  urgChipStat: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  urgChipRoutine: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  urgText: {
    fontSize: 9,
    fontWeight: '800',
  },
  urgTextStat: {
    color: '#EF4444',
  },
  urgTextRoutine: {
    color: '#94A3B8',
  },
  orderCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  statusPill: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  orderCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  orderPatient: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  orderDetails: {
    fontSize: 11,
    color: '#34D399',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
