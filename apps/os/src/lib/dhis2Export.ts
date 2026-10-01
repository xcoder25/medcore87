/**
 * DHIS2-oriented aggregate export (Akwa Ibom / MoH style).
 * Produces JSON compatible with bulk import after mapping data elements.
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

export function downloadDhis2Aggregate(facilityId: string, orgUnit?: string) {
  const payload = buildDhis2Aggregate(facilityId, orgUnit);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dhis2-aggregate-${facilityId}-${payload.completeDate}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return payload;
}
