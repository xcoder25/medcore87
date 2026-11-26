import React, { useEffect, useMemo, useState } from 'react';
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
import {
  GlowButton,
  LiquidGlassCard,
  LiveSyncPill,
} from '../ui/LiquidGlass';
import { MedIcon } from '../ui/PremiumIcons';
import { C } from '../../theme';
import {
  enrolEmrStaff,
  fetchEmrStaff,
  pushEmrFacilityBroadcast,
} from '../../services/emrSyncClient';

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

function suggestBadgeId(facilityId: string, roleCode: string, seq: number): string {
  const shortFac = facilityId
    .replace(/^AKS-/i, '')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 6)
    .toUpperCase();
  return `${shortFac || 'MED'}-${roleCode}-${String(seq).padStart(3, '0')}`;
}

export const FacilityAdminHub: React.FC<FacilityAdminHubProps> = ({ session, onOpenTool }) => {
  const facilityId = session.facilityId || 'IGH-EKT';
  const [subTab, setSubTab] = useState<AdminSubTab>('enrol');

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
      syncState: session.emrSynced ? 'synced' : 'queued',
      createdAt: new Date().toISOString(),
    },
  ]);

  // Hydrate facility staff directory live from MedCore OS when authenticated via EMR
  useEffect(() => {
    let alive = true;
    if (!session.sessionToken) return;
    void fetchEmrStaff(facilityId, session.sessionToken).then((res) => {
      if (!alive || !res.ok || !res.staff.length) return;
      const mapped: MobileStaffEntry[] = res.staff.map((row: any) => ({
        badgeId: String(row.badgeId || row.badge_id || row.id || '').toUpperCase(),
        facilityId: String(row.facilityId || row.facility_id || facilityId).toUpperCase(),
        fullName: String(row.fullName || row.full_name || row.name || 'Staff'),
        roleKey: String(row.roleKey || row.role_key || 'staff'),
        roleLabel: String(row.role || row.title || 'Staff'),
        department: String(row.department || 'Clinical Operations'),
        email: String(row.email || ''),
        employmentScheme: String(row.employmentScheme || 'State Civil Service'),
        status: row.status === 'suspended' ? 'suspended' : 'active',
        syncState: 'synced',
        createdAt: String(row.createdAt || new Date().toISOString()),
      }));
      setDirectory((prev) => {
        const seen = new Set(mapped.map((m) => m.badgeId));
        return [...mapped, ...prev.filter((p) => !seen.has(p.badgeId))];
      });
    });
    return () => {
      alive = false;
    };
  }, [facilityId, session.sessionToken]);

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

  const [searchQuery, setSearchQuery] = useState('');
  const [alertHeadline, setAlertHeadline] = useState('');
  const [opsBanner, setOpsBanner] = useState<string | null>(null);
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
      const res = await enrolEmrStaff(payload, session.sessionToken);
      if (!res.ok) {
        setFormBanner({ kind: 'err', text: res.error || 'Could not enrol staff member.' });
        setSubmitting(false);
        return;
      }
      syncState = res.synced ? 'synced' : 'queued';
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
          ? `${cleanName} (${cleanBadge}) enrolled for ${facilityId} and synced to MedCore EMR.`
          : `${cleanName} (${cleanBadge}) enrolled locally for ${facilityId} — queued for EMR sync.`,
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

  const handleBroadcastAlert = async () => {
    const msg = alertHeadline.trim();
    if (!msg) return;
    setAlertHeadline('');
    const res = await pushEmrFacilityBroadcast(
      facilityId,
      msg,
      session.name,
      session.sessionToken
    );
    setOpsBanner(
      res.synced
        ? `Broadcast synced to MedCore EMR terminals (${facilityId}): "${msg}"`
        : `Broadcast queued for ${facilityId}: "${msg}"`
    );
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 36 }}
    >
      {/* Glass Facility Admin Hero */}
      <LiquidGlassCard glowColor={C.glowCyan} intensity="strong" animateIn style={{ marginBottom: 12 }}>
        <View style={styles.scopeTopRow}>
          <View style={styles.scopePill}>
            <MedIcon name="shield" size={12} color="#7DD3FC" badge={false} />
            <Text style={styles.scopePillText}>FACILITY ADMIN · {facilityId}</Text>
          </View>
          <LiveSyncPill state={session.emrSynced ? 'live' : 'offline'} />
        </View>
        <Text style={styles.scopeTitle}>{session.facility}</Text>
        <Text style={styles.scopeSub}>
          Enrol staff and run shift ops for this hospital directly on mobile. Destructive resets, RBAC matrix, and AkwaRemit treasury locks remain Desktop EMR Only.
        </Text>
      </LiquidGlassCard>

      {/* Glass Sub-Navigation */}
      <View style={styles.subTabRow}>
        {(
          [
            { k: 'enrol' as const, label: 'Enrol' },
            { k: 'directory' as const, label: `Staff (${facilityStaff.length})` },
            { k: 'ops' as const, label: 'Quick Ops' },
            { k: 'emr_only' as const, label: 'EMR Locks' },
          ] as const
        ).map((t) => {
          const active = subTab === t.k;
          return (
            <TouchableOpacity
              key={t.k}
              style={[styles.subTab, active && styles.subTabActive]}
              onPress={() => setSubTab(t.k)}
              activeOpacity={0.85}
            >
              <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 1. ENROL STAFF */}
      {subTab === 'enrol' && (
        <LiquidGlassCard glowColor={C.glowEmerald} animateIn>
          <View style={styles.cardHeader}>
            <MedIcon name="user-plus" size={18} color="#6EE7B7" glowColor={C.glowEmerald} />
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>Enrol Facility Personnel</Text>
              <Text style={styles.panelSub}>
                Creates a MedCore EMR credential scoped strictly to {facilityId}.
              </Text>
            </View>
          </View>

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
                  { color: formBanner.kind === 'ok' ? '#A7F3D0' : '#FECDD3' },
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
            placeholderTextColor="#64748B"
          />

          <Text style={styles.fieldLabel}>CLINICAL / OPERATIONAL ROLE *</Text>
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
            placeholderTextColor="#64748B"
          />

          <Text style={styles.fieldLabel}>OFFICIAL WORK EMAIL *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="staff@hospital.aks.gov.ng"
            placeholderTextColor="#64748B"
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
                placeholderTextColor="#64748B"
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
                placeholderTextColor="#64748B"
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
              <Text style={styles.fieldLabel}>COUNCIL</Text>
              <TextInput
                style={styles.input}
                value={regulatoryBody}
                onChangeText={setRegulatoryBody}
                autoCapitalize="characters"
                placeholder="MDCN / NMCN"
                placeholderTextColor="#64748B"
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
                placeholderTextColor="#64748B"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>LICENSE EXPIRY (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={licenseExpiry}
            onChangeText={setLicenseExpiry}
            placeholder="2028-12-31"
            placeholderTextColor="#64748B"
          />

          <GlowButton
            label={`Enrol Staff into ${facilityId}`}
            icon="user-plus"
            variant="emerald"
            loading={submitting}
            onPress={handleEnrolSubmit}
          />
        </LiquidGlassCard>
      )}

      {/* 2. FACILITY DIRECTORY */}
      {subTab === 'directory' && (
        <LiquidGlassCard glowColor={C.glowBlue} animateIn>
          <Text style={styles.panelTitle}>Facility Directory ({facilityId})</Text>
          <Text style={styles.panelSub}>
            Synced live with MedCore OS staff records for this facility.
          </Text>
          <TextInput
            style={styles.input}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search name, badge, or role…"
            placeholderTextColor="#64748B"
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
                        fontSize: 9.5,
                        fontWeight: '800',
                        color: member.syncState === 'synced' ? '#6EE7B7' : '#FDE68A',
                      }}
                    >
                      {member.syncState === 'synced' ? 'EMR SYNCED' : 'QUEUED'}
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
                    fontSize: 10.5,
                    fontWeight: '800',
                    color: member.status === 'active' ? '#6EE7B7' : '#FDA4AF',
                  }}
                >
                  {member.status === 'active' ? 'ACTIVE' : 'SUSPENDED'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </LiquidGlassCard>
      )}

      {/* 3. QUICK OPS */}
      {subTab === 'ops' && (
        <LiquidGlassCard glowColor={C.glowViolet} animateIn>
          <Text style={styles.panelTitle}>Mobile Facility Operations</Text>
          <Text style={styles.panelSub}>
            Daily operational tasks synchronized with {session.facility}.
          </Text>

          {opsBanner && (
            <View style={[styles.banner, styles.bannerOk]}>
              <Text style={[styles.bannerText, { color: '#A7F3D0' }]}>{opsBanner}</Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>BROADCAST FACILITY NOTICE TO EMR</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={alertHeadline}
              onChangeText={setAlertHeadline}
              placeholder="e.g. Shift handover at 19:00"
              placeholderTextColor="#64748B"
            />
            <GlowButton label="Send" variant="primary" onPress={handleBroadcastAlert} />
          </View>

          {[
            {
              key: 'roster',
              icon: 'calendar' as const,
              title: 'Rostering & Shift Coverage',
              desc: 'Approve on-call rotations & flag fatigue alerts',
            },
            {
              key: 'discharge',
              icon: 'building' as const,
              title: 'Bed & Discharge ADT Overview',
              desc: 'Monitor ward turnover and pending discharges',
            },
            {
              key: 'alerts',
              icon: 'bell' as const,
              title: 'Critical Clinical Alerts',
              desc: 'View active STAT / lab escalation notifications',
            },
            {
              key: 'staff-id',
              icon: 'card' as const,
              title: 'My Administrator ID Card',
              desc: 'View digital badge & facility clearance',
            },
          ].map((op) => (
            <TouchableOpacity
              key={op.key}
              style={styles.opCard}
              onPress={() => onOpenTool?.(op.key)}
              activeOpacity={0.85}
            >
              <MedIcon name={op.icon} size={16} color="#C4B5FD" glowColor={C.glowViolet} />
              <View style={{ flex: 1 }}>
                <Text style={styles.opTitle}>{op.title}</Text>
                <Text style={styles.opDesc}>{op.desc}</Text>
              </View>
              <MedIcon name="arrow-right" size={14} color="#94A3B8" badge={false} />
            </TouchableOpacity>
          ))}
        </LiquidGlassCard>
      )}

      {/* 4. DESKTOP EMR ONLY CAPABILITIES */}
      {subTab === 'emr_only' && (
        <LiquidGlassCard glowColor={C.glowRose} animateIn>
          <Text style={styles.panelTitle}>Desktop EMR Exclusive Controls</Text>
          <Text style={styles.panelSub}>
            High-impact governance, treasury settlement, and audit exports only open on Desktop MedCore OS.
          </Text>

          {selectedLock && (
            <View style={styles.lockDetailBox}>
              <Text style={styles.lockDetailTitle}>Desktop EMR Workstation Required</Text>
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
              <MedIcon name="lock" size={15} color="#FDA4AF" glowColor={C.glowRose} />
              <View style={{ flex: 1 }}>
                <Text style={styles.lockTitle}>{cap.title}</Text>
                <Text style={styles.lockPath}>{cap.emrPath}</Text>
              </View>
              <View style={styles.emrOnlyBadge}>
                <Text style={styles.emrOnlyBadgeText}>DESKTOP EMR ONLY</Text>
              </View>
            </TouchableOpacity>
          ))}
        </LiquidGlassCard>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
  scopeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scopePillText: { color: '#7DD3FC', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  scopeTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  scopeSub: { color: '#94A3B8', fontSize: 12, marginTop: 4, lineHeight: 17 },
  subTabRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  subTab: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  subTabActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.72)',
    borderColor: C.glowBlue,
    shadowColor: C.glowBlue,
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  subTabText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  subTabTextActive: { color: '#FFFFFF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  panelTitle: { fontSize: 15.5, fontWeight: '800', color: '#FFFFFF' },
  panelSub: { fontSize: 12, color: '#94A3B8', marginTop: 2, marginBottom: 10, lineHeight: 17 },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#F8FAFC',
    marginBottom: 12,
  },
  twoCol: { flexDirection: 'row', gap: 10 },
  schemeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    marginRight: 6,
  },
  chipActive: { backgroundColor: 'rgba(16, 185, 129, 0.22)', borderColor: C.glowEmerald },
  chipText: { fontSize: 11.5, fontWeight: '700', color: '#CBD5E1' },
  chipTextActive: { color: '#A7F3D0' },
  banner: { padding: 11, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  bannerOk: { backgroundColor: 'rgba(16, 185, 129, 0.16)', borderColor: 'rgba(52, 211, 153, 0.4)' },
  bannerErr: { backgroundColor: 'rgba(244, 63, 94, 0.16)', borderColor: 'rgba(251, 113, 133, 0.4)' },
  bannerText: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  dirCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  dirName: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  dirMeta: { fontSize: 11.5, color: '#CBD5E1', marginTop: 2 },
  dirEmail: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  syncPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  syncPillOk: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  syncPillPending: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusActive: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  statusSuspended: { backgroundColor: 'rgba(244, 63, 94, 0.2)' },
  opCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 8,
  },
  opTitle: { fontSize: 13.5, fontWeight: '800', color: '#F8FAFC' },
  opDesc: { fontSize: 11.5, color: '#94A3B8', marginTop: 2 },
  lockDetailBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    marginBottom: 12,
  },
  lockDetailTitle: { fontSize: 13, fontWeight: '800', color: '#FDE68A', marginBottom: 3 },
  lockDetailBody: { fontSize: 12, color: '#FEF3C7', lineHeight: 17 },
  lockDetailPath: { fontSize: 11, fontWeight: '700', color: '#FBBF24', marginTop: 5 },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  lockTitle: { fontSize: 13, fontWeight: '800', color: '#F8FAFC' },
  lockPath: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  emrOnlyBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.45)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emrOnlyBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#FDA4AF' },
});

export default FacilityAdminHub;
