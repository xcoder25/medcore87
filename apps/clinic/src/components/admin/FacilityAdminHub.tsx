import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StaffSession } from '../auth/StaffAuthScreen';
import {
  EMR_ONLY_ADMIN_CAPABILITIES,
  type EmrOnlyCapability,
} from '../../rbac/permissions';
import { offlineSyncManager } from '../../services/offlineSync';

interface FacilityAdminHubProps {
  session: StaffSession;
  onOpenTool?: (toolKey: string) => void;
}

type AdminSubTab = 'enrol' | 'directory' | 'ops' | 'emr_only';

interface MobileStaffEntry {
  badgeId: string;
  facilityId: string;
  fullName: string;
  roleKey: string;
  roleLabel: string;
  department: string;
  email: string;
  employmentScheme: string;
  regulatoryBody?: string;
  practicingLicenseNo?: string;
  licenseExpiry?: string;
  status: 'active' | 'suspended';
  syncState: 'synced' | 'queued';
  createdAt: string;
}

const ENROL_ROLES = [
  { key: 'doctor', label: 'Doctor / MO', dept: 'Internal Medicine', code: 'DOC' },
  { key: 'nurse', label: 'Nursing Officer', dept: 'Inpatient Wards', code: 'RN' },
  { key: 'midwife', label: 'Midwife', dept: 'Maternity & Labour', code: 'MW' },
  { key: 'pharmacist', label: 'Pharmacist', dept: 'Dispensary & Formulary', code: 'RPH' },
  { key: 'lab', label: 'Lab Scientist', dept: 'Pathology & LIS', code: 'MLS' },
  { key: 'radiologist', label: 'Radiologist', dept: 'Imaging & PACS', code: 'RAD' },
  { key: 'reception', label: 'Reception / Desk', dept: 'Front Desk & Flow', code: 'FD' },
  { key: 'records', label: 'HIM / Records', dept: 'Health Information', code: 'HIM' },
  { key: 'accountant', label: 'Accountant / Cashier', dept: 'Revenue & Claims', code: 'ACC' },
  { key: 'biomedical', label: 'Biomedical Eng.', dept: 'Equipment & Plant', code: 'BME' },
] as const;

const SCHEMES = ['State Civil Service', 'Contract / Locum', 'NHIA / Visiting'] as const;

function resolveOsApiBaseUrl(): string {
  try {
    const procEnv = (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env;
    const winUrl =
      typeof window !== 'undefined'
        ? (window as unknown as { __MEDCORE_OS_URL?: string }).__MEDCORE_OS_URL
        : undefined;
    return String(procEnv?.EXPO_PUBLIC_OS_URL || winUrl || '')
      .trim()
      .replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function suggestBadgeId(facilityId: string, roleCode: string, seq: number): string {
  const shortFac = facilityId
    .replace(/^AKS-/i, '')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 6)
    .toUpperCase();
  return `${shortFac || 'MED'}-${roleCode}-${String(seq).padStart(3, '0')}`;
}

export const FacilityAdminHub: React.FC<FacilityAdminHubProps> = ({ session, onOpenTool }) => {
  const facilityId = session.facilityId || 'AKS-ISH-001';
  const [subTab, setSubTab] = useState<AdminSubTab>('enrol');

  // Facility-scoped staff directory
  const [directory, setDirectory] = useState<MobileStaffEntry[]>(() => [
    {
      badgeId: session.staffId,
      facilityId,
      fullName: session.name,
      roleKey: session.roleKey,
      roleLabel: session.role,
      department: 'Hospital Management',
      email: session.email || `admin@${facilityId.toLowerCase()}.medcore.ng`,
      employmentScheme: 'State Civil Service',
      status: 'active',
      syncState: 'synced',
      createdAt: new Date().toISOString(),
    },
  ]);

  // Enrol form state
  const [fullName, setFullName] = useState('');
  const [roleIdx, setRoleIdx] = useState(0);
  const [department, setDepartment] = useState<string>(ENROL_ROLES[0].dept);
  const [email, setEmail] = useState('');
  const [badgeId, setBadgeId] = useState(() => suggestBadgeId(facilityId, ENROL_ROLES[0].code, 101));
  const [pin, setPin] = useState('');
  const [schemeIdx, setSchemeIdx] = useState(0);
  const [regulatoryBody, setRegulatoryBody] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formBanner, setFormBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Directory filter
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Ops alert broadcast
  const [alertHeadline, setAlertHeadline] = useState('');
  const [opsBanner, setOpsBanner] = useState<string | null>(null);

  // Selected Desktop-EMR-only explanation
  const [selectedLock, setSelectedLock] = useState<EmrOnlyCapability | null>(null);

  const facilityStaff = useMemo(
    () =>
      directory.filter(
        (m) =>
          m.facilityId.toUpperCase() === facilityId.toUpperCase() &&
          (!searchQuery.trim() ||
            m.fullName.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
            m.badgeId.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
            m.roleLabel.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      ),
    [directory, facilityId, searchQuery]
  );

  const handleSelectRole = (idx: number) => {
    setRoleIdx(idx);
    const chosen = ENROL_ROLES[idx];
    setDepartment(chosen.dept);
    setBadgeId(suggestBadgeId(facilityId, chosen.code, 100 + directory.length + 1));
  };

  const handleEnrolSubmit = async () => {
    setFormBanner(null);
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanBadge = badgeId.trim().toUpperCase();
    const cleanPin = pin.trim();
    const cleanLicense = licenseNo.trim().toUpperCase();
    const cleanExpiry = licenseExpiry.trim();

    if (cleanName.length < 3) {
      setFormBanner({ kind: 'err', text: 'Full name must be at least 3 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormBanner({ kind: 'err', text: 'Enter a valid official work email address.' });
      return;
    }
    if (!cleanBadge || cleanBadge.length < 4) {
      setFormBanner({ kind: 'err', text: 'Staff Badge ID must be at least 4 characters.' });
      return;
    }
    if (!/^\d{6}$/.test(cleanPin)) {
      setFormBanner({ kind: 'err', text: 'Sign-in PIN must be an exact 6-digit numeric code.' });
      return;
    }
    if (cleanLicense && cleanLicense.length < 4) {
      setFormBanner({ kind: 'err', text: 'Practicing license number must be at least 4 characters.' });
      return;
    }
    if (cleanExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(cleanExpiry)) {
      setFormBanner({ kind: 'err', text: 'License expiry date must use YYYY-MM-DD format.' });
      return;
    }
    if (directory.some((d) => d.facilityId === facilityId && d.badgeId === cleanBadge)) {
      setFormBanner({ kind: 'err', text: `Badge ${cleanBadge} already exists at ${facilityId}.` });
      return;
    }

    const chosenRole = ENROL_ROLES[roleIdx];
    const scheme = SCHEMES[schemeIdx];
    const payload = {
      badgeId: cleanBadge,
      facilityId,
      facilityName: session.facility,
      fullName: cleanName,
      email: cleanEmail,
      pin: cleanPin,
      role: chosenRole.label,
      roleKey: chosenRole.key,
      title: chosenRole.label,
      department: department.trim() || chosenRole.dept,
      employmentScheme: scheme,
      ...(regulatoryBody.trim() ? { regulatoryBody: regulatoryBody.trim().toUpperCase() } : {}),
      ...(cleanLicense ? { practicingLicenseNo: cleanLicense } : {}),
      ...(cleanExpiry ? { licenseExpiry: cleanExpiry } : {}),
    };

    setSubmitting(true);
    let syncState: 'synced' | 'queued' = 'queued';
    try {
      const osBase = resolveOsApiBaseUrl();
      if (osBase) {
        const res = await offlineSyncManager.executeWithOfflineQueue<{ success?: boolean; error?: string }>(
          `${osBase}/api/staff/create`,
          'POST',
          payload
        );
        if (res.success && !res.queued) {
          syncState = 'synced';
        }
      } else {
        await offlineSyncManager.executeWithOfflineQueue('/api/staff/create', 'POST', payload);
      }
    } catch {
      syncState = 'queued';
    } finally {
      setSubmitting(false);
    }

    const newEntry: MobileStaffEntry = {
      badgeId: cleanBadge,
      facilityId,
      fullName: cleanName,
      roleKey: chosenRole.key,
      roleLabel: chosenRole.label,
      department: department.trim() || chosenRole.dept,
      email: cleanEmail,
      employmentScheme: scheme,
      regulatoryBody: regulatoryBody.trim().toUpperCase() || undefined,
      practicingLicenseNo: cleanLicense || undefined,
      licenseExpiry: cleanExpiry || undefined,
      status: 'active',
      syncState,
      createdAt: new Date().toISOString(),
    };

    setDirectory((prev) => [newEntry, ...prev]);
    setFullName('');
    setEmail('');
    setPin('');
    setLicenseNo('');
    setLicenseExpiry('');
    setBadgeId(suggestBadgeId(facilityId, chosenRole.code, 100 + directory.length + 2));
    setFormBanner({
      kind: 'ok',
      text:
        syncState === 'synced'
          ? `${cleanName} (${cleanBadge}) enrolled for ${facilityId} and synced to cloud.`
          : `${cleanName} (${cleanBadge}) enrolled for ${facilityId} — queued for facility EMR sync.`,
    });
  };

  const toggleStatus = (targetBadge: string) => {
    setDirectory((prev) =>
      prev.map((m) =>
        m.facilityId === facilityId && m.badgeId === targetBadge
          ? { ...m, status: m.status === 'active' ? 'suspended' : 'active' }
          : m
      )
    );
  };

  const handleBroadcastAlert = () => {
    const msg = alertHeadline.trim();
    if (!msg) return;
    setAlertHeadline('');
    setOpsBanner(`Facility broadcast queued for ${facilityId}: "${msg}"`);
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Facility-Scoped Admin Banner */}
      <View style={styles.scopeCard}>
        <View style={styles.scopeTopRow}>
          <View style={styles.scopePill}>
            <Text style={styles.scopePillText}>FACILITY ADMIN · {facilityId}</Text>
          </View>
          <Text style={styles.scopeCount}>{facilityStaff.length} staff</Text>
        </View>
        <Text style={styles.scopeTitle}>{session.facility}</Text>
        <Text style={styles.scopeSub}>
          Staff enrolment and operational actions apply strictly to this facility. Advanced compliance, treasury, and RBAC matrix policies remain locked to Desktop MedCore OS.
        </Text>
      </View>

      {/* Sub-Navigation Pills */}
      <View style={styles.subTabRow}>
        {(
          [
            { k: 'enrol' as const, label: 'Enrol Staff' },
            { k: 'directory' as const, label: 'Directory' },
            { k: 'ops' as const, label: 'Quick Ops' },
            { k: 'emr_only' as const, label: 'EMR Only' },
          ] as const
        ).map((t) => {
          const active = subTab === t.k;
          return (
            <TouchableOpacity
              key={t.k}
              style={[styles.subTab, active && styles.subTabActive]}
              onPress={() => setSubTab(t.k)}
              activeOpacity={0.8}
            >
              <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 1. ENROL STAFF */}
      {subTab === 'enrol' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Enrol Facility Personnel</Text>
          <Text style={styles.panelSub}>
            Creates a facility-bound credential (`{facilityId}`) with a 6-digit workstation PIN.
          </Text>

          {formBanner && (
            <View
              style={[
                styles.banner,
                formBanner.kind === 'ok' ? styles.bannerOk : styles.bannerErr,
              ]}
            >
              <Text
                style={[
                  styles.bannerText,
                  { color: formBanner.kind === 'ok' ? '#065F46' : '#B91C1C' },
                ]}
              >
                {formBanner.text}
              </Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>FULL NAME *</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Dr. Emem Bassey"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.fieldLabel}>ROLE *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {ENROL_ROLES.map((r, idx) => {
              const sel = idx === roleIdx;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.chip, sel && styles.chipActive]}
                  onPress={() => handleSelectRole(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.fieldLabel}>DEPARTMENT *</Text>
          <TextInput
            style={styles.input}
            value={department}
            onChangeText={setDepartment}
            placeholder="Department"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.fieldLabel}>OFFICIAL WORK EMAIL *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="staff@hospital.aks.gov.ng"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>BADGE ID *</Text>
              <TextInput
                style={styles.input}
                value={badgeId}
                onChangeText={setBadgeId}
                autoCapitalize="characters"
                placeholder="ISH-DOC-101"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>6-DIGIT PIN *</Text>
              <TextInput
                style={styles.input}
                value={pin}
                onChangeText={setPin}
                keyboardType="numeric"
                maxLength={6}
                secureTextEntry={true}
                placeholder="123456"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>EMPLOYMENT SCHEME</Text>
          <View style={styles.schemeRow}>
            {SCHEMES.map((s, idx) => {
              const sel = idx === schemeIdx;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, sel && styles.chipActive]}
                  onPress={() => setSchemeIdx(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>COUNCIL (MDCN/NMCN/PCN)</Text>
              <TextInput
                style={styles.input}
                value={regulatoryBody}
                onChangeText={setRegulatoryBody}
                autoCapitalize="characters"
                placeholder="Optional"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>LICENSE NO.</Text>
              <TextInput
                style={styles.input}
                value={licenseNo}
                onChangeText={setLicenseNo}
                autoCapitalize="characters"
                placeholder="Optional"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>LICENSE EXPIRY (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={licenseExpiry}
            onChangeText={setLicenseExpiry}
            placeholder="2028-12-31"
            placeholderTextColor="#94A3B8"
          />

          <TouchableOpacity
            style={[styles.primaryBtn, submitting && { opacity: 0.65 }]}
            onPress={handleEnrolSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>
              {submitting ? 'Enrolling Staff…' : `Enrol Staff into ${facilityId}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. FACILITY DIRECTORY */}
      {subTab === 'directory' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Facility Staff Directory ({facilityId})</Text>
          <TextInput
            style={styles.input}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search name, badge, or role…"
            placeholderTextColor="#94A3B8"
          />
          {facilityStaff.map((member) => (
            <View key={member.badgeId} style={styles.dirCard}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.dirName}>{member.fullName}</Text>
                  <View
                    style={[
                      styles.syncPill,
                      member.syncState === 'synced' ? styles.syncPillOk : styles.syncPillPending,
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        color: member.syncState === 'synced' ? '#047857' : '#92400E',
                      }}
                    >
                      {member.syncState === 'synced' ? 'CLOUD SYNCED' : 'QUEUED'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.dirMeta}>
                  {member.badgeId} · {member.roleLabel} · {member.department}
                </Text>
                <Text style={styles.dirEmail}>{member.email}</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.statusBtn,
                  member.status === 'active' ? styles.statusActive : styles.statusSuspended,
                ]}
                onPress={() => toggleStatus(member.badgeId)}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: member.status === 'active' ? '#065F46' : '#991B1B',
                  }}
                >
                  {member.status === 'active' ? 'ACTIVE' : 'SUSPENDED'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* 3. QUICK OPS */}
      {subTab === 'ops' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Mobile Facility Operations</Text>
          <Text style={styles.panelSub}>
            Daily operational tasks cleared for mobile admin sessions at {session.facility}.
          </Text>

          {opsBanner && (
            <View style={[styles.banner, styles.bannerOk]}>
              <Text style={[styles.bannerText, { color: '#065F46' }]}>{opsBanner}</Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>BROADCAST FACILITY NOTICE</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={alertHeadline}
              onChangeText={setAlertHeadline}
              placeholder="e.g. Shift handover at 19:00 in Main Auditorium"
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity style={styles.smallBtn} onPress={handleBroadcastAlert}>
              <Text style={styles.smallBtnText}>Send</Text>
            </TouchableOpacity>
          </View>

          {[
            {
              key: 'roster',
              title: 'Rostering & Shift Coverage',
              desc: 'Approve on-call rotations & flag fatigue alerts',
            },
            {
              key: 'discharge',
              title: 'Bed & Discharge ADT Overview',
              desc: 'Monitor ward turnover and pending discharges',
            },
            {
              key: 'alerts',
              title: 'Critical Clinical Alerts',
              desc: 'View active STAT / lab escalation notifications',
            },
            {
              key: 'staff-id',
              title: 'My Administrator ID Card',
              desc: 'View mobile badge & facility clearance details',
            },
          ].map((op) => (
            <TouchableOpacity
              key={op.key}
              style={styles.opCard}
              onPress={() => onOpenTool?.(op.key)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.opTitle}>{op.title}</Text>
                <Text style={styles.opDesc}>{op.desc}</Text>
              </View>
              <Text style={{ fontSize: 18, color: '#94A3B8' }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 4. DESKTOP EMR ONLY CAPABILITIES */}
      {subTab === 'emr_only' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Desktop EMR Exclusive Controls</Text>
          <Text style={styles.panelSub}>
            High-impact governance, treasury, and audit features only open on an authenticated Desktop MedCore OS workstation.
          </Text>

          {selectedLock && (
            <View style={styles.lockDetailBox}>
              <Text style={styles.lockDetailTitle}>🔒 Requires Desktop EMR Workstation</Text>
              <Text style={styles.lockDetailBody}>{selectedLock.reason}</Text>
              <Text style={styles.lockDetailPath}>Open in OS: {selectedLock.emrPath}</Text>
            </View>
          )}

          {EMR_ONLY_ADMIN_CAPABILITIES.map((cap) => (
            <TouchableOpacity
              key={cap.key}
              style={styles.lockRow}
              onPress={() => setSelectedLock(cap)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.lockTitle}>{cap.title}</Text>
                <Text style={styles.lockPath}>{cap.emrPath}</Text>
              </View>
              <View style={styles.emrOnlyBadge}>
                <Text style={styles.emrOnlyBadgeText}>DESKTOP EMR ONLY</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF', paddingHorizontal: 16, paddingTop: 14 },
  scopeCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  scopeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  scopePill: {
    backgroundColor: 'rgba(14, 165, 233, 0.22)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  scopePillText: { color: '#7DD3FC', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  scopeCount: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  scopeTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  scopeSub: { color: '#CBD5E1', fontSize: 11.5, marginTop: 4, lineHeight: 16.5 },
  subTabRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  subTab: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  subTabActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  subTabText: { fontSize: 11.5, fontWeight: '700', color: '#475569' },
  subTabTextActive: { color: '#FFFFFF' },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  panelTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  panelSub: { fontSize: 12, color: '#64748B', marginTop: 3, marginBottom: 14, lineHeight: 17 },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 5,
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0F172A',
    marginBottom: 12,
  },
  twoCol: { flexDirection: 'row', gap: 10 },
  schemeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#0284C7' },
  chipText: { fontSize: 11.5, fontWeight: '700', color: '#334155' },
  chipTextActive: { color: '#0369A1' },
  primaryBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  banner: { padding: 11, borderRadius: 10, marginBottom: 12, borderWidth: 1 },
  bannerOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  bannerErr: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  bannerText: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  dirCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  dirName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  dirMeta: { fontSize: 11.5, color: '#475569', marginTop: 2 },
  dirEmail: { fontSize: 11, color: '#64748B', marginTop: 1 },
  syncPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  syncPillOk: { backgroundColor: '#D1FAE5' },
  syncPillPending: { backgroundColor: '#FEF3C7' },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusActive: { backgroundColor: '#D1FAE5' },
  statusSuspended: { backgroundColor: '#FEE2E2' },
  smallBtn: {
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  smallBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
  opCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  opTitle: { fontSize: 13.5, fontWeight: '800', color: '#0F172A' },
  opDesc: { fontSize: 11.5, color: '#64748B', marginTop: 2 },
  lockDetailBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  lockDetailTitle: { fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 3 },
  lockDetailBody: { fontSize: 12, color: '#78350F', lineHeight: 17 },
  lockDetailPath: { fontSize: 11, fontWeight: '700', color: '#B45309', marginTop: 5 },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lockTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  lockPath: { fontSize: 11, color: '#64748B', marginTop: 2 },
  emrOnlyBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emrOnlyBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#B91C1C' },
});

export default FacilityAdminHub;
