/**
 * Account-Desk AI Automation & Treasury Intelligence
 *
 * Equips Cashiers, Accountants, and Admins with real-time answers and actionable
 * shift-close schedules powered 100% by live facility billing, cashier shift,
 * receipt, and AkwaRemit TSA stores.
 */
import { listAccountsRequests } from './frontDeskAccountsBridge';
import {
  getAkwaRemitDailySummary,
  listAkwaRemitPayments,
  listAkwaRemitBatches,
  listAkwaRemitShifts,
  getActiveCashierShift,
  getCashierUserShiftSummary,
} from './akwaRemitStore';
import { dayStats, todayPayments } from './receptionOpsStore';
import { listBillLines, listPatientsWithOpenBills } from './patientBillingStore';
import { listPaymentReceipts } from './paymentReceiptModule';
import { listPatients } from './patientRegistryStore';
import { getAdminSettings } from './adminSettingsStore';

export type AccountsAction =
  | { type: 'none' }
  | { type: 'awaiting_queue' }
  | { type: 'revenue_summary' }
  | { type: 'pending_remittance' }
  | { type: 'prepare_batch_remit' }
  | { type: 'shift_status' }
  | { type: 'open_bills' }
  | { type: 'hmo_claims_status' }
  | { type: 'todays_receipts' }
  | { type: 'reconciliation_audit' }
  | { type: 'patient_billing_lookup'; ref: string };

export function canAutomateAccounts(roleKey: string): boolean {
  const rk = String(roleKey || '').toLowerCase().trim();
  return (
    rk.includes('account') ||
    rk.includes('cashier') ||
    rk.includes('billing') ||
    rk.includes('finance') ||
    rk === 'hospital_admin' ||
    rk === 'admin'
  );
}

export function accountsAutomationRefusal(roleKey: string): string {
  return (
    `Accounts, treasury remittance, and billing desk queries are restricted to **Cashier / Accountant** (or Hospital Administrator).\n\n` +
    `Your current role is **${roleKey || 'staff'}**.`
  );
}

export function resolveAccountsAction(query: string): AccountsAction {
  const q = String(query || '').trim();
  if (!q) return { type: 'none' };

  // Avoid stealing admin bed/staff/role provisioning commands
  if (
    /\b(?:create|add|provision)\s+\d*\s*beds?\b/i.test(q) ||
    /\b(?:enrol|enroll|create\s+staff|create\s+role)\b/i.test(q)
  ) {
    return { type: 'none' };
  }

  // 1. Automated shift-close batch settlement preparation
  if (
    /\b(?:prepare|generate|build|ready|how\s+to|run|trigger)\b.*\b(?:batch|remit|remittance|lodg|settlement|tsa|shift[\s-]close)\b/i.test(q) ||
    /\b(?:batch\s+settlement|bulk\s+remittance|tsa\s+lodg(?:e|ement|ing)|lodge\s+cash|settle\s+cash\s+arn)\b/i.test(q)
  ) {
    return { type: 'prepare_batch_remit' };
  }

  // 2. Unremitted cash / pending remittance check
  if (
    /\b(?:unremitted|pending\s+remittance|awaiting\s+remittance|cash\s+in\s+till|cash\s+to\s+lodge|cash\s+holding|ceiling|compliance\s+rate|pending\s+cash)\b/i.test(q)
  ) {
    return { type: 'pending_remittance' };
  }

  // 3. Multi-ledger reconciliation / audit / attention
  if (
    /\b(?:reconcil|balancing|audit|variance|discrepancy|mismatch|what\s+needs\s+attention|desk\s+summary|accounts?\s+health)\b/i.test(q)
  ) {
    return { type: 'reconciliation_audit' };
  }

  // 4. Front Desk awaiting payment queue
  if (
    /\b(?:awaiting\s+payment|waiting\s+to\s+pay|front\s*desk\s+invoice|unpaid\s+invoice|pending\s+payment|payment\s+queue)\b/i.test(q) ||
    /^awaiting$/i.test(q)
  ) {
    return { type: 'awaiting_queue' };
  }

  // 5. Cashier shift status / float / variance
  if (
    /\b(?:shift\s+status|active\s+shift|open\s+shift|starting\s+float|drawer\s+cash|my\s+shift|closed\s+shift)\b/i.test(q)
  ) {
    return { type: 'shift_status' };
  }

  // 6. HMO / NHIA / AKSHIA claims
  if (
    /\b(?:hmo|nhia|akshia|bhcpf|insurance\s+claim|claims?\s+status|capitation|waiver)\b/i.test(q)
  ) {
    return { type: 'hmo_claims_status' };
  }

  // 7. Today's receipts
  if (
    /\b(?:today'?s?\s+receipts?|issued\s+receipts?|list\s+receipts?|recent\s+receipts?|print\s+receipt)\b/i.test(q)
  ) {
    return { type: 'todays_receipts' };
  }

  // 8. Open hospital bills / AR debtors
  if (
    /\b(?:open\s+(?:hospital\s+)?bills?|aged\s+debtors?|debtors?|ar\s+desk|receivables?|unpaid\s+bills?|who\s+owes)\b/i.test(q)
  ) {
    return { type: 'open_bills' };
  }

  // 9. Specific ARN / Receipt / Hospital No / patient billing lookup
  const codeMatch = q.match(/\b((?:ARN|RCP|RRR)-[A-Z0-9-]+|[A-Z]{2,5}-PT-[A-Z0-9]+)\b/i);
  if (codeMatch) {
    return { type: 'patient_billing_lookup', ref: codeMatch[1].toUpperCase() };
  }
  const namedLookup = q.match(
    /\b(?:check|lookup|find|bill|receipt|balance|payment\s+status)\s+(?:for|of)\s+([a-z][a-z\s'-]{2,40})/i
  );
  if (namedLookup && !/\b(today|all|this\s+facility|hospital)\b/i.test(namedLookup[1])) {
    return { type: 'patient_billing_lookup', ref: namedLookup[1].trim() };
  }

  // 10. Daily revenue & collection summary
  if (
    /\b(?:collected\s+today|today'?s?\s+(?:revenue|collection|takings)|revenue\s+summary|total\s+collection|direct\s+akwaremit|akwaremit\s+(?:summary|status|total)|cash\s+vs\s+pos|how\s+much\s+collected)\b/i.test(q)
  ) {
    return { type: 'revenue_summary' };
  }

  return { type: 'none' };
}

export function executeAccountsAction(
  action: Exclude<AccountsAction, { type: 'none' }>,
  ctx: {
    facilityId: string;
    facilityName: string;
    cashierName?: string;
    cashierBadge?: string;
  }
): string {
  const { facilityId, facilityName } = ctx;
  const todayStr = new Date().toISOString().slice(0, 10);
  const summary = getAkwaRemitDailySummary(facilityId, todayStr);
  const akwaPayments = listAkwaRemitPayments(facilityId, { date: todayStr });
  const allPayments = listAkwaRemitPayments(facilityId);
  const awaiting = listAccountsRequests(facilityId, { status: 'awaiting_payment' });
  const openBills = listPatientsWithOpenBills(facilityId);
  const settings = getAdminSettings(facilityId);
  const opsStats = dayStats(facilityId);

  switch (action.type) {
    case 'awaiting_queue': {
      const totalAmt = awaiting.reduce((s, r) => s + (Number(r.amountNgn) || 0), 0);
      if (awaiting.length === 0) {
        return (
          `**Awaiting Payment Queue · ${facilityId}**\n\n` +
          `• **0** unpaid Front Desk invoices waiting — queue is completely clear.\n` +
          `• Use **Collect payment** for walk-in billing or check **Open hospital bills** (${openBills.length} patients with balances).`
        );
      }
      const rows = awaiting.slice(0, 10).map(
        (r, i) =>
          `${i + 1}. **${r.patientName}** (${r.hospitalNumber}) — **₦${Number(r.amountNgn).toLocaleString()}** · ${r.purpose}${r.invoiceNumber ? ` · \`${r.invoiceNumber}\`` : ''} *(from ${r.sentBy})*`
      );
      return (
        `**Awaiting Payment Queue · ${facilityId}**\n\n` +
        `• Waiting: **${awaiting.length}** invoice(s) · Total due: **₦${totalAmt.toLocaleString()}**\n\n` +
        rows.join('\n') +
        (awaiting.length > 10 ? `\n\n*(Showing top 10 of ${awaiting.length})*` : '') +
        `\n\nClick **Collect →** on **Accounts home** to open POS, collect Cash / AkwaRemit POS / Transfer, and issue an official receipt.`
      );
    }

    case 'revenue_summary': {
      const limit = settings.cashHoldingLimitNgn || 0;
      const ceilingWarn =
        limit > 0 && summary.pendingCashNgn >= limit
          ? `\n• ⚠️ **Cash Holding Alert**: Unremitted physical cash (**₦${summary.pendingCashNgn.toLocaleString()}**) has reached the facility ceiling of **₦${limit.toLocaleString()}** — lodge to partner TSA bank and run Batch Settlement.`
          : '';

      return (
        `**Today's Revenue & Treasury Summary · ${facilityName} (${todayStr})**\n\n` +
        `• **Total Verified Collections**: **₦${Math.max(summary.totalCollectionsNgn, opsStats.collected || 0).toLocaleString()}** (${summary.receiptsCount} AkwaRemit-tracked receipt(s))\n` +
        `• **Physical Cash in Till (Pending TSA Remittance)**: **₦${summary.pendingCashNgn.toLocaleString()}** (${summary.pendingCashCount} cash ARN(s))${summary.remittedCashNgn > 0 ? ` · **₦${summary.remittedCashNgn.toLocaleString()}** already remitted` : ''}\n` +
        `• **AkwaRemit POS / Card**: **₦${summary.akwaremitPosTotalNgn.toLocaleString()}**\n` +
        `• **Direct AkwaRemit RRR / Portal**: **₦${summary.directAkwaRemitTotalNgn.toLocaleString()}** (${summary.directReceiptsCount} direct RRR)\n` +
        `• **Total Reached AkwaRemit TSA**: **₦${summary.alreadyInAkwaRemitNgn.toLocaleString()}** (**${summary.complianceRatePercent}%** remittance compliance)\n` +
        `• **Awaiting Front Desk Invoices**: **${awaiting.length}** (**₦${awaiting.reduce((s, r) => s + r.amountNgn, 0).toLocaleString()}**)` +
        ceilingWarn
      );
    }

    case 'pending_remittance': {
      const pendingAll = allPayments.filter((p) => p.remittanceStatus === 'pending');
      const pendingCash = pendingAll.filter((p) => p.method === 'cash');
      const pendingOther = pendingAll.filter((p) => p.method !== 'cash');
      const totalPending = pendingAll.reduce((s, p) => s + p.amountNgn, 0);
      const limit = settings.cashHoldingLimitNgn || 0;

      if (pendingAll.length === 0) {
        return (
          `**Pending Remittance & Cash Till · ${facilityId}**\n\n` +
          `• **₦0** awaiting remittance — all collections today have reached AkwaRemit TSA (**100% compliance**).`
        );
      }

      const topLines = pendingAll.slice(0, 8).map(
        (p) =>
          `• \`${p.arn}\` · **${p.patientName}** (${p.hospitalNumber}) · **₦${p.amountNgn.toLocaleString()}** · ${p.method === 'cash' ? 'Physical Cash' : p.method} · Cashier: ${p.cashierName}`
      );

      return (
        `**Unremitted Collections & Cash Till Status · ${facilityId}**\n\n` +
        `• **Total Pending Remittance**: **₦${totalPending.toLocaleString()}** across **${pendingAll.length}** ARN(s)\n` +
        `• **Physical Cash in Till**: **₦${pendingCash.reduce((s, p) => s + p.amountNgn, 0).toLocaleString()}** (${pendingCash.length} ARN(s))${limit > 0 ? ` · Till ceiling: ₦${limit.toLocaleString()}` : ''}\n` +
        (pendingOther.length > 0
          ? `• **Unsettled Terminal / Other**: **₦${pendingOther.reduce((s, p) => s + p.amountNgn, 0).toLocaleString()}** (${pendingOther.length} ARN(s))\n`
          : '') +
        `\n**Pending ARN Breakdown:**\n` +
        topLines.join('\n') +
        `\n\nSay **Prepare shift-close batch settlement** or open **AkwaRemit Central Hub → Remit to AkwaRemit** after partner-bank TSA cash lodgment.`
      );
    }

    case 'prepare_batch_remit': {
      const pendingCash = allPayments.filter(
        (p) => p.remittanceStatus === 'pending' && p.method === 'cash'
      );
      const totalCash = pendingCash.reduce((s, p) => s + p.amountNgn, 0);
      if (pendingCash.length === 0) {
        return (
          `**Shift-Close TSA Batch Settlement Readiness · ${facilityId}**\n\n` +
          `• **0** unpaid cash ARNs in till right now (**₦0** pending). Nothing needs batch lodgment.`
        );
      }

      const arnList = pendingCash.slice(0, 12).map(
        (p, i) => `${i + 1}. \`${p.arn}\` (Receipt \`${p.receiptNo}\`) — **₦${p.amountNgn.toLocaleString()}** · ${p.patientName}`
      );

      return (
        `**Automated Shift-Close Cash Batch Settlement Plan · ${facilityId}**\n\n` +
        `• **Ready to Lodge**: **${pendingCash.length}** unpaid cash ARN(s) totaling **₦${totalCash.toLocaleString()}**\n\n` +
        `**Step-by-Step Control:**\n` +
        `1. **Dual-Control Cash Count**: Count physical till notes against the system total **₦${totalCash.toLocaleString()}** with a witness supervisor.\n` +
        `2. **Partner Bank TSA Deposit**: Deposit **₦${totalCash.toLocaleString()}** into the hospital's designated TSA Collection / Transit Account and obtain the Bank Deposit Teller Ref.\n` +
        `3. **Execute Batch Settlement Payload**: Open **AkwaRemit Central Hub → 2. Remit to AkwaRemit**, click **Select All Pending**, enter the Teller Ref + Witness details, and submit to settle all ARNs via \`/api/akwaremit/batch-settle\`.\n\n` +
        `**Included Cash ARNs:**\n` +
        arnList.join('\n') +
        (pendingCash.length > 12 ? `\n\n*(+${pendingCash.length - 12} more cash ARNs in queue)*` : '')
      );
    }

    case 'shift_status': {
      const badge = ctx.cashierBadge || ctx.cashierName || '';
      const active = badge ? getActiveCashierShift(facilityId, badge) : null;
      const closed = listAkwaRemitShifts(facilityId);

      if (!active && closed.length === 0) {
        return (
          `**Cashier Shift Status · ${facilityId}**\n\n` +
          `• No active shift is open for **${ctx.cashierName || 'current user'}**, and 0 shift closures are logged today.\n` +
          `• Open **Collect payment** to record your starting cash float and begin your shift.`
        );
      }

      const userSummary = active
        ? getCashierUserShiftSummary(facilityId, active.cashierBadge || badge, active.id)
        : null;

      const activeBlock = active && userSummary
        ? `• **Active Shift**: \`${active.id}\` (opened ${new Date(active.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})\n` +
          `• **Starting Float**: ₦${active.startingFloatNgn.toLocaleString()}\n` +
          `• **Cash Collected**: ₦${userSummary.totalCashNgn.toLocaleString()} (${userSummary.cashTransactionsCount} tx) · **Expected Drawer Cash**: **₦${userSummary.expectedDrawerCashNgn.toLocaleString()}**\n` +
          `• **AkwaRemit POS / Transfers**: ₦${(userSummary.totalPosArnsNgn + userSummary.totalTransfersNgn).toLocaleString()}\n`
        : `• **Active Shift**: None currently open for ${ctx.cashierName || 'this desk'}.\n`;

      const recentClosures = closed.slice(0, 4).map(
        (s) =>
          `• \`${s.shiftId}\` · ${s.cashierName} (Witness: ${s.witnessName}) · Counted **₦${s.physicalCashCountedNgn.toLocaleString()}** vs System ₦${s.systemCashNgn.toLocaleString()} (${s.cashVarianceNgn === 0 ? 'Balanced' : `Variance ₦${s.cashVarianceNgn.toLocaleString()}`})`
      );

      return (
        `**Cashier Shift & Cash Control · ${facilityId}**\n\n` +
        activeBlock +
        (recentClosures.length > 0 ? `\n**Recent Dual-Control Shift Closures:**\n` + recentClosures.join('\n') : '')
      );
    }

    case 'open_bills': {
      const totalOpen = openBills.reduce((s, b) => s + b.balanceNgn, 0);
      if (openBills.length === 0) {
        return `**Open Hospital Bills & AR · ${facilityId}**\n\n• **0** open patient ledger balances — all departmental bills (OPD, Lab, Rx, Imaging) are settled.`;
      }
      const rows = openBills.slice(0, 10).map(
        (b, i) =>
          `${i + 1}. **${b.patientName}** (${b.hospitalNumber}) — **₦${b.balanceNgn.toLocaleString()}** (${b.lines.length} unpaid item(s))`
      );
      return (
        `**Open Hospital Bills & Aged Debtors · ${facilityId}**\n\n` +
        `• Patients with balances: **${openBills.length}** · Total Receivable: **₦${totalOpen.toLocaleString()}**\n\n` +
        rows.join('\n') +
        `\n\nLook up any patient in **Billing office** or **AR desk** to collect via POS.`
      );
    }

    case 'hmo_claims_status': {
      const allLines = listBillLines(facilityId);
      const hmoLines = allLines.filter((l) => l.status === 'hmo' || l.paidVia === 'hmo');
      const waivedLines = allLines.filter((l) => l.status === 'waived' || l.paidVia === 'waiver');
      const hmoTotal = hmoLines.reduce((s, l) => s + l.amountNgn, 0);
      const waivedTotal = waivedLines.reduce((s, l) => s + l.amountNgn, 0);

      return (
        `**AKSHIA / NHIA / HMO & Waiver Summary · ${facilityId}**\n\n` +
        `• **Facility AKSHIA Code**: ${settings.akshiaProviderId ? `\`${settings.akshiaProviderId}\`` : 'Not configured *(set in Admin Settings)*'} · **NHIA Code**: ${settings.nhiaProviderCode ? `\`${settings.nhiaProviderCode}\`` : 'Not set'}\n` +
        `• **HMO / AKSHIA Cleared Lines**: **${hmoLines.length}** line(s) · **₦${hmoTotal.toLocaleString()}**\n` +
        `• **Social / Medical Waivers**: **${waivedLines.length}** line(s) · **₦${waivedTotal.toLocaleString()}**\n` +
        `\nOpen **HMO / NHIA claims** to track capitation & third-party insurer submissions.`
      );
    }

    case 'todays_receipts': {
      const receipts = listPaymentReceipts(facilityId, { day: todayStr });
      if (receipts.length === 0) {
        return `**Today's Issued Receipts · ${facilityId} (${todayStr})**\n\n• **0** receipts issued so far today.`;
      }
      const total = receipts.reduce((s, r) => s + r.amountNgn, 0);
      const rows = receipts.slice(0, 10).map((r) => {
        const matchAkwa = allPayments.find(
          (p) => p.arn === r.reference || p.receiptNo === r.receiptNo || p.receiptNo === r.reference
        );
        const remStatus = matchAkwa?.remittanceStatus || r.remittanceStatus || 'pending';
        const badge =
          remStatus === 'remitted'
            ? 'Remitted'
            : remStatus === 'direct_akwaremit'
              ? 'Direct AkwaRemit'
              : 'Pending TSA';
        return `• \`${r.receiptNo}\` · **${r.patientName}** (${r.hospitalNumber}) · **₦${r.amountNgn.toLocaleString()}** · ${r.method} · *${badge}*`;
      });
      return (
        `**Today's Issued Receipts · ${facilityId} (${todayStr})**\n\n` +
        `• Total Receipts: **${receipts.length}** · Total Value: **₦${total.toLocaleString()}**\n\n` +
        rows.join('\n') +
        `\n\nOpen **Today receipts** tab to inspect or reprint any official receipt.`
      );
    }

    case 'reconciliation_audit': {
      const awaitingTotal = awaiting.reduce((s, r) => s + (Number(r.amountNgn) || 0), 0);
      const openTotal = openBills.reduce((s, b) => s + b.balanceNgn, 0);
      const batches = listAkwaRemitBatches(facilityId).filter((b) => b.periodDate === todayStr);
      const payCount = todayPayments(facilityId).length;
      const limit = settings.cashHoldingLimitNgn || 0;

      const flags: string[] = [];
      if (summary.pendingCashNgn > 0) {
        flags.push(
          `Physical cash of **₦${summary.pendingCashNgn.toLocaleString()}** (${summary.pendingCashCount} ARN(s)) is in till awaiting State TSA bank lodgment & batch settlement.`
        );
      }
      if (limit > 0 && summary.pendingCashNgn >= limit) {
        flags.push(
          `Cash drawer ceiling (**₦${limit.toLocaleString()}**) exceeded — immediate bank lodgment recommended.`
        );
      }
      if (awaiting.length > 0) {
        flags.push(
          `${awaiting.length} Front Desk invoice(s) (**₦${awaitingTotal.toLocaleString()}**) are still awaiting payment.`
        );
      }
      if (openBills.length > 0) {
        flags.push(
          `${openBills.length} patient(s) carry open hospital bills totaling **₦${openTotal.toLocaleString()}**.`
        );
      }

      return (
        `**Account Balancing & Reconciliation Audit · ${facilityId} (${todayStr})**\n\n` +
        `• **Verified Collections Today**: **₦${summary.totalCollectionsNgn.toLocaleString()}** (${akwaPayments.length} gateway records / ${payCount} POS payments)\n` +
        `• **In State TSA (Settled/Direct)**: **₦${summary.alreadyInAkwaRemitNgn.toLocaleString()}** (**${summary.complianceRatePercent}%**)\n` +
        `• **Unremitted Cash in Drawer**: **₦${summary.pendingCashNgn.toLocaleString()}**\n` +
        `• **Today's Remittance Audit Batches**: **${batches.length}** batch(es)\n\n` +
        (flags.length > 0
          ? `**Action Items & Audit Flags:**\n` + flags.map((f) => `• ${f}`).join('\n')
          : `**Audit Status**: ✅ All ledgers balanced with zero pending cash and zero uncollected queues.`)
      );
    }

    case 'patient_billing_lookup': {
      const ref = action.ref;
      const q = ref.toLowerCase();
      const receipts = listPaymentReceipts(facilityId).filter(
        (r) =>
          r.receiptNo.toLowerCase().includes(q) ||
          r.reference.toLowerCase().includes(q) ||
          r.hospitalNumber.toLowerCase().includes(q) ||
          r.patientName.toLowerCase().includes(q)
      );
      const akwaMatches = allPayments.filter(
        (p) =>
          p.arn.toLowerCase().includes(q) ||
          p.receiptNo.toLowerCase().includes(q) ||
          p.hospitalNumber.toLowerCase().includes(q) ||
          p.patientName.toLowerCase().includes(q) ||
          (p.akwaRemitRrr && p.akwaRemitRrr.toLowerCase().includes(q))
      );
      const pt = listPatients(facilityId).find(
        (p) =>
          p.hospitalNumber.toLowerCase() === q ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
      );
      const ptLines = pt
        ? listBillLines(facilityId, { patientId: pt.id })
        : listBillLines(facilityId, { patientId: ref });
      const unpaidSum = ptLines
        .filter((l) => l.status === 'unpaid' || l.status === 'partial')
        .reduce((s, l) => s + l.amountNgn, 0);

      if (receipts.length === 0 && akwaMatches.length === 0 && ptLines.length === 0) {
        return `No billing, receipt, or ARN records matched **${ref}** at facility **${facilityId}**.`;
      }

      const parts: string[] = [`**Billing & Receipt Lookup: ${ref}**\n`];
      if (pt || ptLines.length > 0) {
        parts.push(
          `• **Outstanding Balance**: **₦${unpaidSum.toLocaleString()}** across ${ptLines.filter((l) => l.status === 'unpaid' || l.status === 'partial').length} unpaid bill line(s)`
        );
      }
      if (akwaMatches.length > 0) {
        parts.push(
          `\n**AkwaRemit / Gateway Records:**\n` +
            akwaMatches
              .slice(0, 5)
              .map(
                (p) =>
                  `• \`${p.arn}\` · **₦${p.amountNgn.toLocaleString()}** · ${p.method} · Status: **${p.remittanceStatus}**${p.akwaRemitRrr ? ` (RRR: \`${p.akwaRemitRrr}\`)` : ''}`
              )
              .join('\n')
        );
      }
      if (receipts.length > 0) {
        parts.push(
          `\n**Issued Receipts:**\n` +
            receipts
              .slice(0, 5)
              .map(
                (r) =>
                  `• \`${r.receiptNo}\` · **₦${r.amountNgn.toLocaleString()}** · ${r.purpose} · ${new Date(r.issuedAt).toLocaleString()}`
              )
              .join('\n')
        );
      }
      return parts.join('\n');
    }
  }
}
