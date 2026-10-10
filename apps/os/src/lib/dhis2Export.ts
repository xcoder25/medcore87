/**
 * DHIS2 + NHMIS monthly + NDR-oriented exports for Akwa Ibom MoH.
 */
import { todayVisits, dayStats } from './receptionOpsStore';
import { listPatients } from './patientRegistryStore';
import { listOrders } from './clinicalEventBus';

export function buildDhis2Aggregate(facilityId: string, orgUnit?: string) {
  const day = new Date().toISOString().slice(0, 10);
  const stats = dayStats(facilityId);
  const patients = listPatients(facilityId);
  const visits = todayVisits(facilityId);
  const orders = listOrders(facilityId);
  const labOrders = orders.filter((o) => o.type === 'lab' && o.createdAt.slice(0, 10) === day);
  const rxOrders = orders.filter((o) => o.type === 'rx' && o.createdAt.slice(0, 10) === day);

  return {
    dataSet: 'MedCore_Daily_OPD',
    completeDate: day,
    period: day.replace(/-/g, ''),
    orgUnit: orgUnit || facilityId,
    dataValues: [
      { dataElement: 'OPD_ATTENDANCES', value: stats.checkIns },
      { dataElement: 'OPD_WAITING', value: stats.waiting },
      { dataElement: 'OPD_APPOINTMENTS', value: stats.appointments },
      { dataElement: 'OPD_COLLECTED_NGN', value: stats.collected },
      { dataElement: 'MPI_ACTIVE_PATIENTS', value: patients.filter((p) => p.status === 'active').length },
      { dataElement: 'LAB_ORDERS', value: labOrders.length },
      { dataElement: 'RX_ORDERS', value: rxOrders.length },
      {
        dataElement: 'OPD_WALKIN',
        value: visits.filter((v) => v.visitType === 'walkin').length,
      },
    ],
    meta: {
      source: 'MedCore Hospital OS',
      facilityId,
      generatedAt: new Date().toISOString(),
      note: 'Map dataElement codes to your DHIS2 instance before import',
    },
  };
}

/** NHMIS-style monthly summary (pilot fields) */
export function buildNhmisMonthly(facilityId: string, yearMonth?: string) {
  const ym = yearMonth || new Date().toISOString().slice(0, 7);
  const patients = listPatients(facilityId);
  const orders = listOrders(facilityId);
  const inMonth = (iso: string) => iso.startsWith(ym);
  const labs = orders.filter((o) => o.type === 'lab' && inMonth(o.createdAt));
  return {
    form: 'NHMIS_Monthly_Summary',
    period: ym.replace('-', ''),
    facilityId,
    indicators: {
      total_registered_patients: patients.length,
      opd_attendances_est: todayVisits(facilityId).length,
      lab_tests: labs.length,
      malaria_suspect_flag: labs.filter((l) => /malaria|mp/i.test(String((l as any).testName || (l as any).name || ''))).length,
      pharmacy_rx: orders.filter((o) => o.type === 'rx' && inMonth(o.createdAt)).length,
    },
    generatedAt: new Date().toISOString(),
  };
}

/** NDR-oriented patient line list (HIV/AIDS surveillance style stub — expand with clinical flags) */
export function buildNdrLineList(facilityId: string) {
  const patients = listPatients(facilityId);
  return {
    repository: 'NDR',
    facilityId,
    records: patients.slice(0, 5000).map((p) => ({
      hospitalNumber: p.hospitalNumber,
      upi: (p as any).upi || null,
      nin: (p as any).nin || null,
      sex: p.sex,
      dob: p.dob,
      lga: (p as any).lga || null,
      status: p.status,
    })),
    generatedAt: new Date().toISOString(),
    note: 'Map to NDR schemas before production upload; no clinical HIV fields invented here',
  };
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadDhis2Aggregate(facilityId: string, orgUnit?: string) {
  const payload = buildDhis2Aggregate(facilityId, orgUnit);
  downloadJson(`dhis2-aggregate-${facilityId}-${payload.completeDate}.json`, payload);
  return payload;
}

export function downloadNhmisMonthly(facilityId: string) {
  const payload = buildNhmisMonthly(facilityId);
  downloadJson(`nhmis-monthly-${facilityId}-${payload.period}.json`, payload);
  return payload;
}

export function downloadNdrLineList(facilityId: string) {
  const payload = buildNdrLineList(facilityId);
  downloadJson(`ndr-linelist-${facilityId}.json`, payload);
  return payload;
}

/** Auto-submit to server proxy when DHIS2_BASE_URL is configured */
export async function autoSubmitDhis2(facilityId: string, orgUnit?: string): Promise<{ ok: boolean; message: string }> {
  const payload = buildDhis2Aggregate(facilityId, orgUnit);
  try {
    const res = await fetch('/api/dhis2/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) return { ok: true, message: json.message || 'Submitted to DHIS2' };
    return {
      ok: false,
      message: json.message || `DHIS2 submit not configured or failed (${res.status}). JSON remains downloadable.`,
    };
  } catch {
    return { ok: false, message: 'Network error — use download export offline' };
  }
}
