const fs = require('fs');

const file = 'c:/Users/Dell/OneDrive/Desktop/medcore/apps/os/src/components/dashboards/AccountingWorkspace.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Landmark to lucide imports
content = content.replace(
  "AlertTriangle,\n} from 'lucide-react';",
  "AlertTriangle,\n  Landmark,\n} from 'lucide-react';"
);
content = content.replace(
  "AlertTriangle,\r\n} from 'lucide-react';",
  "AlertTriangle,\r\n  Landmark,\r\n} from 'lucide-react';"
);

// 2. Add AutoAccountBalancingCard & AkwaRemitRevenueSuite imports
const importTarget = "import { InsuranceHmoClaimsSuite } from '../finance/InsuranceHmoClaimsSuite';";
const importAddition = `import { InsuranceHmoClaimsSuite } from '../finance/InsuranceHmoClaimsSuite';
import { AutoAccountBalancingCard } from '../finance/AutoAccountBalancingCard';
import { AkwaRemitRevenueSuite } from '../finance/AkwaRemitRevenueSuite';
import { getAkwaRemitDailySummary, AKWAREMIT_EVENT } from '../../lib/akwaRemitStore';`;
content = content.replace(importTarget, importAddition);

// 3. Update AccView type
content = content.replace(
  "type AccView = 'home' | 'payment' | 'billing' | 'receipts' | 'ar' | 'claims';",
  "type AccView = 'home' | 'payment' | 'billing' | 'receipts' | 'ar' | 'claims' | 'akwaremit';"
);

// 4. Add AKWAREMIT_EVENT listeners in useEffect
const effectTarget = `  useEffect(() => {
    const u1 = subscribeAccountsRequests(bump);
    const u2 = subscribeBills(bump);
    const u3 = subscribeReceptionOps(bump);
    return () => { u1(); u2(); u3(); };
  }, [bump]);`;

const effectReplacement = `  useEffect(() => {
    const u1 = subscribeAccountsRequests(bump);
    const u2 = subscribeBills(bump);
    const u3 = subscribeReceptionOps(bump);
    const onRemit = () => bump();
    window.addEventListener(AKWAREMIT_EVENT, onRemit);
    window.addEventListener('medcore-payment-receipts', onRemit);
    return () => {
      u1(); u2(); u3();
      window.removeEventListener(AKWAREMIT_EVENT, onRemit);
      window.removeEventListener('medcore-payment-receipts', onRemit);
    };
  }, [bump]);`;
content = content.replace(effectTarget, effectReplacement);

// 5. Add amount computations & akwaremit summary
const computeTarget = `  const openBills = useMemo(() => {
    void tick;
    return listPatientsWithOpenBills(facilityId);
  }, [facilityId, tick]);`;

const computeAddition = `  const openBills = useMemo(() => {
    void tick;
    return listPatientsWithOpenBills(facilityId);
  }, [facilityId, tick]);

  const awaitingAmount = useMemo(() => awaiting.reduce((sum, r) => sum + (Number(r.amountNgn) || 0), 0), [awaiting]);
  const paidTodayAmount = useMemo(() => paidToday.reduce((sum, r) => sum + (Number(r.amountNgn) || 0), 0), [paidToday]);
  const openBillsAmount = useMemo(() => openBills.reduce((sum, ob) => sum + (Number(ob.balanceNgn) || 0), 0), [openBills]);

  const akwaSummary = useMemo(() => {
    void tick;
    try {
      return getAkwaRemitDailySummary(facilityId);
    } catch {
      return { pendingReceiptsCount: 0, pendingRemittanceNgn: 0 };
    }
  }, [facilityId, tick]);`;
content = content.replace(computeTarget, computeAddition);

// 6. Update nav array to include AkwaRemit
const navTarget = `    { id: 'receipts', label: 'Today receipts', icon: Wallet },
  ];`;
const navReplacement = `    { id: 'receipts', label: 'Today receipts', icon: Wallet },
    {
      id: 'akwaremit',
      label: 'AkwaRemit Central Hub',
      icon: Landmark,
      badge: akwaSummary.pendingReceiptsCount || undefined,
    },
  ];`;
content = content.replace(navTarget, navReplacement);

// 7. Render AutoAccountBalancingCard on home view before KPI row
const homeViewTarget = `{view === 'home' && (
        <>
          {/* KPI row */}`;
const homeViewReplacement = `{view === 'home' && (
        <>
          {/* Auto Account Balancing Intelligence & Akwa Remitta Cash Remittance Reminder */}
          <AutoAccountBalancingCard
            session={session}
            onNavigateToAkwaRemit={() => setView('akwaremit')}
            onNavigateToPayment={() => setView('payment')}
            awaitingCount={awaiting.length}
            awaitingAmount={awaitingAmount}
            paidTodayCount={paidToday.length}
            paidTodayAmount={paidTodayAmount}
            openBillsAmount={openBillsAmount}
            onRefresh={bump}
          />

          {/* KPI row */}`;
content = content.replace(homeViewTarget, homeViewReplacement);

// 8. Render AkwaRemitRevenueSuite when view === 'akwaremit'
const finalViewTarget = `      {view === 'receipts' && (
        <div style={{ background: '#fff', borderRadius: 20, border: \`1px solid \${C.border}\`, overflow: 'hidden', boxShadow: '0 12px 36px rgba(15,23,42,0.05)' }}>
          <div style={{ padding: '16px 18px', borderBottom: \`1px solid \${C.border}\`, fontWeight: 800, background: 'linear-gradient(180deg,#EFF6FF,#fff)', color: C.navy }}>
            Today&apos;s payments
          </div>
          {payments.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: C.muted }}>No payments recorded today</div>
          ) : (
            payments.slice(0, 40).map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', borderBottom: \`1px solid \${C.border}\`, fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 700, color: C.navy }}>{p.patientName}</div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{p.method} · {p.reference}</div>
                </div>
                <div style={{ fontWeight: 800, color: C.teal, fontSize: 15 }}>₦{p.amount.toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      )}`;

const finalViewReplacement = `${finalViewTarget}

      {view === 'akwaremit' && (
        <div style={{ background: '#fff', borderRadius: 20, border: \`1px solid \${C.border}\`, overflow: 'hidden', padding: 8 }}>
          <AkwaRemitRevenueSuite session={session} />
        </div>
      )}`;
content = content.replace(finalViewTarget, finalViewReplacement);

fs.writeFileSync(file, content, 'utf8');
console.log('AccountingWorkspace.tsx successfully updated!');

