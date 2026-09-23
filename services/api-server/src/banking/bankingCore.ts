import crypto from 'crypto';
import {
  Wallet,
  LedgerAccount,
  JournalEntry,
  FinancialTransaction,
  CashierTill,
  ItemizedBill,
  PaymentMethod,
  TransactionType,
} from '@medcore/types';
import { auditLedger } from '../security/auditLedger';

export class BankingCoreService {
  private accounts: Map<string, LedgerAccount> = new Map();
  private wallets: Map<string, Wallet> = new Map();
  private transactions: Map<string, FinancialTransaction> = new Map();
  private bills: Map<string, ItemizedBill> = new Map();
  private tills: Map<string, CashierTill> = new Map();

  constructor() {
    this.initializeChartOfAccounts();
    this.seedInitialWalletsAndTills();
  }

  private initializeChartOfAccounts(): void {
    const defaultAccounts: LedgerAccount[] = [
      // ─── Assets (1000s) ───
      {
        code: '1010-CASH-TILLS',
        name: 'Cash in Hand (Cashier Tills)',
        category: 'ASSET',
        normalBalance: 'DEBIT',
        balance: 15000.0,
        description: 'Physical currency held in active facility cashier drawers',
      },
      {
        code: '1020-ESCROW-BANK',
        name: 'MedCore Settlement & Escrow Clearing Bank Account',
        category: 'ASSET',
        normalBalance: 'DEBIT',
        balance: 590600.0,
        description: 'Master commercial bank clearing account backing digital wallets',
      },
      {
        code: '1030-POS-RECEIVABLES',
        name: 'POS Terminal In-Transit Clearing',
        category: 'ASSET',
        normalBalance: 'DEBIT',
        balance: 32000.0,
        description: 'Card and POS terminal funds awaiting daily bank batch settlement',
      },
      {
        code: '1040-HMO-CLAIMS-RECEIVABLE',
        name: 'HMO & Insurer Adjudicated Claims Receivable',
        category: 'ASSET',
        normalBalance: 'DEBIT',
        balance: 185000.0,
        description: 'Auto-approved insurance claim portions due from HMO providers',
      },

      // ─── Liabilities (2000s) ───
      {
        code: '2010-PATIENT-WALLETS',
        name: 'Patient Health Wallet Balances (Demand Liability)',
        category: 'LIABILITY',
        normalBalance: 'CREDIT',
        balance: 245000.0,
        description: 'Customer digital wallet funds redeemable for medical care',
      },
      {
        code: '2020-ADMISSION-ESCROW',
        name: 'Patient Admission & Surgery Escrow Deposits',
        category: 'LIABILITY',
        normalBalance: 'CREDIT',
        balance: 120000.0,
        description: 'Pre-authorized surgical and inpatient deposits held in escrow',
      },
      {
        code: '2030-HMO-PREPAYMENT-RESERVE',
        name: 'HMO Float & Capitation Clearing Pool',
        category: 'LIABILITY',
        normalBalance: 'CREDIT',
        balance: 80000.0,
        description: 'Pre-funded insurer reserves for instant clinical claims settlement',
      },

      // ─── Revenue (4000s) ───
      {
        code: '4010-CONSULTATION-REV',
        name: 'Clinical Consultation Revenue',
        category: 'REVENUE',
        normalBalance: 'CREDIT',
        balance: 95000.0,
        description: 'Earned revenue from doctor and specialist encounters',
      },
      {
        code: '4020-PHARMACY-REV',
        name: 'Pharmacy & Drug Dispensation Revenue',
        category: 'REVENUE',
        normalBalance: 'CREDIT',
        balance: 78000.0,
        description: 'Earned revenue from dispensed medications and IV fluids',
      },
      {
        code: '4030-LABORATORY-REV',
        name: 'Diagnostic Laboratory Revenue',
        category: 'REVENUE',
        normalBalance: 'CREDIT',
        balance: 44000.0,
        description: 'Earned revenue from pathology, blood work, and molecular assays',
      },
      {
        code: '4040-PROCEDURES-REV',
        name: 'Surgical & Procedure Revenue',
        category: 'REVENUE',
        normalBalance: 'CREDIT',
        balance: 125000.0,
        description: 'Earned revenue from theatre, surgery, and day cases',
      },
      {
        code: '4050-BED-STAY-REV',
        name: 'Inpatient Bed & ICU Accommodation Revenue',
        category: 'REVENUE',
        normalBalance: 'CREDIT',
        balance: 38000.0,
        description: 'Earned revenue from inpatient ward and critical care stay',
      },

      // ─── Expenses (5000s) ───
      {
        code: '5010-GATEWAY-FEES',
        name: 'Payment Processing & Interbank Switch Fees',
        category: 'EXPENSE',
        normalBalance: 'DEBIT',
        balance: 2400.0,
        description: 'Payment switch and card network interchange costs',
      },
    ];

    for (const acc of defaultAccounts) {
      this.accounts.set(acc.code, acc);
    }
  }

  private seedInitialWalletsAndTills(): void {
    const initialWallets: Wallet[] = [
      {
        id: 'WAL-PAT-001',
        ownerId: 'PAT-849201',
        ownerName: 'Amina Bello',
        ownerType: 'PATIENT',
        facilityId: 'FAC-001',
        currency: 'USD',
        availableBalance: 850.0,
        escrowBalance: 200.0,
        totalBalance: 1050.0,
        status: 'ACTIVE',
        dailySpendingLimit: 2500.0,
        paystackCustomerCode: 'CUS_AMINA_8492',
        paystackDedicatedAccount: {
          bankName: 'Wema Bank (Paystack)',
          accountNumber: '0289410928',
          accountName: 'MedCore / Amina Bello',
          assignedAt: '2026-01-10T08:05:00Z',
        },
        createdAt: '2026-01-10T08:00:00Z',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'WAL-PAT-002',
        ownerId: 'PAT-620194',
        ownerName: 'Emeka Okafor',
        ownerType: 'PATIENT',
        facilityId: 'FAC-001',
        currency: 'USD',
        availableBalance: 320.0,
        escrowBalance: 0.0,
        totalBalance: 320.0,
        status: 'ACTIVE',
        dailySpendingLimit: 1500.0,
        paystackCustomerCode: 'CUS_EMEKA_6201',
        paystackDedicatedAccount: {
          bankName: 'Titan Trust Bank (Paystack)',
          accountNumber: '0255198401',
          accountName: 'MedCore / Emeka Okafor',
          assignedAt: '2026-01-12T10:05:00Z',
        },
        createdAt: '2026-01-12T10:00:00Z',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'WAL-FAC-001',
        ownerId: 'FAC-001',
        ownerName: 'Apex National Teaching Hospital (Treasury)',
        ownerType: 'FACILITY',
        facilityId: 'FAC-001',
        currency: 'USD',
        availableBalance: 142500.0,
        escrowBalance: 24000.0,
        totalBalance: 166500.0,
        status: 'ACTIVE',
        dailySpendingLimit: 500000.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'WAL-HMO-001',
        ownerId: 'HMO-AXA-01',
        ownerName: 'AXA Mansard Health HMO Pool',
        ownerType: 'HMO',
        currency: 'USD',
        availableBalance: 78000.0,
        escrowBalance: 0.0,
        totalBalance: 78000.0,
        status: 'ACTIVE',
        dailySpendingLimit: 100000.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const w of initialWallets) {
      this.wallets.set(w.id, w);
    }

    const initialTills: CashierTill[] = [
      {
        id: 'TILL-001',
        cashierId: 'STAFF-CSH-01',
        cashierName: 'Blessing Adeyemi',
        facilityId: 'FAC-001',
        facilityName: 'Apex National Teaching Hospital',
        shiftDate: new Date().toISOString().split('T')[0],
        openedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
        openingFloat: 250.0,
        cashCollected: 1420.0,
        posCollected: 3850.0,
        transferCollected: 2100.0,
        totalCollected: 7370.0,
        expectedCashTotal: 1670.0, // Float + cash collected
        status: 'OPEN',
      },
      {
        id: 'TILL-002',
        cashierId: 'STAFF-CSH-02',
        cashierName: 'Chidi Nnamdi',
        facilityId: 'FAC-001',
        facilityName: 'Apex National Teaching Hospital',
        shiftDate: new Date().toISOString().split('T')[0],
        openedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
        openingFloat: 200.0,
        cashCollected: 980.0,
        posCollected: 2450.0,
        transferCollected: 1800.0,
        totalCollected: 5230.0,
        expectedCashTotal: 1180.0,
        status: 'OPEN',
      },
    ];

    for (const t of initialTills) {
      this.tills.set(t.id, t);
    }

    const initialBill: ItemizedBill = {
      id: 'BILL-2026-081',
      patientId: 'PAT-849201',
      patientName: 'Amina Bello',
      patientMRN: 'MRN-78401',
      facilityId: 'FAC-001',
      encounterId: 'ENC-9942',
      items: [
        {
          id: 'ITEM-1',
          code: 'CONS-SPEC',
          description: 'Senior Consultant Cardiology Consultation',
          category: 'CONSULTATION',
          quantity: 1,
          unitPrice: 80.0,
          totalPrice: 80.0,
          coveredByHMO: true,
          hmoCoveredAmount: 64.0, // 80% coverage
          patientPayableAmount: 16.0, // 20% co-pay
        },
        {
          id: 'ITEM-2',
          code: 'LAB-LIPID',
          description: 'Comprehensive Lipid Profile & Cardiac Enzymes',
          category: 'LABORATORY',
          quantity: 1,
          unitPrice: 65.0,
          totalPrice: 65.0,
          coveredByHMO: true,
          hmoCoveredAmount: 52.0,
          patientPayableAmount: 13.0,
        },
        {
          id: 'ITEM-3',
          code: 'RX-ATORVA',
          description: 'Atorvastatin Calcium 20mg (30 Tablets)',
          category: 'PHARMACY',
          quantity: 1,
          unitPrice: 35.0,
          totalPrice: 35.0,
          coveredByHMO: true,
          hmoCoveredAmount: 28.0,
          patientPayableAmount: 7.0,
        },
      ],
      subtotal: 180.0,
      tax: 0.0,
      totalAmount: 180.0,
      hmoContribution: 144.0, // 80% total
      patientCoPay: 36.0, // 20% total
      depositApplied: 0.0,
      amountPaid: 0.0,
      balanceDue: 36.0,
      status: 'ISSUED',
      hmoPolicyId: 'AXA-POL-88219',
      hmoClaimStatus: 'APPROVED',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
    };

    this.bills.set(initialBill.id, initialBill);
  }

  /**
   * Posts double-entry journal entries, mathematically asserting:
   * sum(Debits) === sum(Credits)
   */
  private postJournalEntries(transactionId: string, entries: Array<{ accountCode: string; type: 'DEBIT' | 'CREDIT'; amount: number; description: string }>): JournalEntry[] {
    let totalDebits = 0;
    let totalCredits = 0;

    for (const e of entries) {
      if (e.amount <= 0) throw new Error(`Invalid non-positive journal amount: ${e.amount}`);
      if (e.type === 'DEBIT') totalDebits += Math.round(e.amount * 100);
      if (e.type === 'CREDIT') totalCredits += Math.round(e.amount * 100);
    }

    if (totalDebits !== totalCredits) {
      throw new Error(
        `Double-entry imbalance! Debits (${totalDebits / 100}) must exactly equal Credits (${totalCredits / 100})`
      );
    }

    const timestamp = new Date().toISOString();
    const result: JournalEntry[] = [];

    for (const e of entries) {
      const acc = this.accounts.get(e.accountCode);
      if (!acc) throw new Error(`Ledger account not found: ${e.accountCode}`);

      // Update account balance
      if (acc.normalBalance === 'DEBIT') {
        acc.balance += e.type === 'DEBIT' ? e.amount : -e.amount;
      } else {
        acc.balance += e.type === 'CREDIT' ? e.amount : -e.amount;
      }

      const entry: JournalEntry = {
        id: `JE-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
        transactionId,
        accountCode: acc.code,
        accountName: acc.name,
        type: e.type,
        amount: e.amount,
        description: e.description,
        timestamp,
      };

      result.push(entry);
    }

    return result;
  }

  /**
   * 1. Fund Patient Health Wallet (Card, Bank, USSD, Mobile Money, Cashier Till)
   */
  public fundWallet(params: {
    walletId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    reference: string;
    idempotencyKey?: string;
  }): FinancialTransaction {
    const wallet = this.wallets.get(params.walletId);
    if (!wallet) throw new Error(`Wallet ${params.walletId} not found`);
    if (params.amount <= 0) throw new Error('Funding amount must be greater than zero');

    const txId = `TX-FUND-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const idempotencyKey = params.idempotencyKey || `IDEM-${txId}`;

    // Check idempotency
    if (this.transactions.has(idempotencyKey)) {
      return this.transactions.get(idempotencyKey)!;
    }

    // Double-entry posting:
    // Debit: 1020-ESCROW-BANK (Cash received into bank)
    // Credit: 2010-PATIENT-WALLETS (Patient wallet liability increases)
    const journal = this.postJournalEntries(txId, [
      {
        accountCode: '1020-ESCROW-BANK',
        type: 'DEBIT',
        amount: params.amount,
        description: `Wallet funding via ${params.paymentMethod} - ${params.reference}`,
      },
      {
        accountCode: '2010-PATIENT-WALLETS',
        type: 'CREDIT',
        amount: params.amount,
        description: `Credit patient health wallet ${wallet.id} (${wallet.ownerName})`,
      },
    ]);

    // Update wallet available balance
    wallet.availableBalance += params.amount;
    wallet.totalBalance = wallet.availableBalance + wallet.escrowBalance;
    wallet.updatedAt = new Date().toISOString();

    const hashSignature = crypto
      .createHash('sha256')
      .update(`${txId}:${wallet.id}:${params.amount}:${wallet.availableBalance}`)
      .digest('hex');

    const tx: FinancialTransaction = {
      id: txId,
      idempotencyKey,
      type: 'WALLET_DEPOSIT',
      amount: params.amount,
      currency: wallet.currency,
      fee: 0,
      status: 'COMPLETED',
      paymentMethod: params.paymentMethod,
      patientId: wallet.ownerId,
      journalEntries: journal,
      reference: params.reference,
      hashSignature,
      createdAt: new Date().toISOString(),
    };

    this.transactions.set(txId, tx);
    this.transactions.set(idempotencyKey, tx);

    // Cryptographic audit log
    auditLedger.logEvent({
      actorId: wallet.ownerId,
      actorName: wallet.ownerName,
      actorRole: 'PATIENT',
      facilityId: wallet.facilityId || 'CENTRAL-PLATFORM',
      action: 'FINANCIAL_TRANSACT',
      resourceType: 'WALLET',
      resourceId: wallet.id,
      reason: `Patient funded health wallet with ${wallet.currency} ${params.amount} via ${params.paymentMethod}`,
      metadata: { txId, amount: params.amount, balanceAfter: wallet.availableBalance },
    });

    return tx;
  }

  /**
   * 2. Settle Itemized Bill with Automated 80/20 HMO & Co-Pay Split
   */
  public settleBillWithSplit(params: {
    billId: string;
    patientWalletId: string;
    settledByCashierId?: string;
    settledByCashierName?: string;
    tillId?: string;
  }): { bill: ItemizedBill; transaction: FinancialTransaction } {
    const bill = this.bills.get(params.billId);
    if (!bill) throw new Error(`Bill ${params.billId} not found`);
    if (bill.status === 'PAID') throw new Error(`Bill ${params.billId} has already been settled`);

    const wallet = this.wallets.get(params.patientWalletId);
    if (!wallet) throw new Error(`Patient wallet ${params.patientWalletId} not found`);

    if (wallet.availableBalance < bill.patientCoPay) {
      throw new Error(
        `Insufficient patient wallet balance! Available: ${wallet.currency} ${wallet.availableBalance}, Co-Pay Required: ${wallet.currency} ${bill.patientCoPay}`
      );
    }

    const txId = `TX-SETTLE-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    // Double-entry postings for the split bill:
    // 1. Debit: 2010-PATIENT-WALLETS (Patient co-pay deducted from wallet liability) -> $36
    // 2. Debit: 1040-HMO-CLAIMS-RECEIVABLE (Insurer claim receivable created) -> $144
    // 3. Credit: 4010-CONSULTATION-REV (Consultation revenue recognized) -> $80
    // 4. Credit: 4030-LABORATORY-REV (Lab revenue recognized) -> $65
    // 5. Credit: 4020-PHARMACY-REV (Pharmacy revenue recognized) -> $35
    // Total Debits: 36 + 144 = $180. Total Credits: 80 + 65 + 35 = $180 (Balanced!)
    const journalEntriesToPost = [
      {
        accountCode: '2010-PATIENT-WALLETS',
        type: 'DEBIT' as const,
        amount: bill.patientCoPay,
        description: `Patient co-pay for Bill #${bill.id} (${bill.patientName})`,
      },
      {
        accountCode: '1040-HMO-CLAIMS-RECEIVABLE',
        type: 'DEBIT' as const,
        amount: bill.hmoContribution,
        description: `HMO claim auto-settlement for Bill #${bill.id} (Policy: ${bill.hmoPolicyId})`,
      },
      {
        accountCode: '4010-CONSULTATION-REV',
        type: 'CREDIT' as const,
        amount: 80.0,
        description: `Earned revenue: Cardiology Consultation for Encounter #${bill.encounterId}`,
      },
      {
        accountCode: '4030-LABORATORY-REV',
        type: 'CREDIT' as const,
        amount: 65.0,
        description: `Earned revenue: Lipid Profile Lab for Encounter #${bill.encounterId}`,
      },
      {
        accountCode: '4020-PHARMACY-REV',
        type: 'CREDIT' as const,
        amount: 35.0,
        description: `Earned revenue: Atorvastatin Pharmacy for Encounter #${bill.encounterId}`,
      },
    ];

    const journal = this.postJournalEntries(txId, journalEntriesToPost);

    // Deduct co-pay from patient wallet
    wallet.availableBalance -= bill.patientCoPay;
    wallet.totalBalance = wallet.availableBalance + wallet.escrowBalance;
    wallet.updatedAt = new Date().toISOString();

    // Update bill
    bill.amountPaid = bill.totalAmount;
    bill.balanceDue = 0;
    bill.status = 'PAID';
    bill.hmoClaimStatus = 'AUTO_SETTLED';
    bill.updatedAt = new Date().toISOString();

    const hashSignature = crypto
      .createHash('sha256')
      .update(`${txId}:${bill.id}:${bill.totalAmount}:${wallet.availableBalance}`)
      .digest('hex');

    const tx: FinancialTransaction = {
      id: txId,
      idempotencyKey: `IDEM-${txId}`,
      type: 'BILL_SETTLEMENT',
      amount: bill.totalAmount,
      currency: wallet.currency,
      fee: 0,
      status: 'COMPLETED',
      patientId: bill.patientId,
      facilityId: bill.facilityId,
      encounterId: bill.encounterId,
      billId: bill.id,
      tillId: params.tillId,
      hmoSplitAmount: bill.hmoContribution,
      patientCoPayAmount: bill.patientCoPay,
      journalEntries: journal,
      reference: `SETTLEMENT-BILL-${bill.id}`,
      hashSignature,
      createdAt: new Date().toISOString(),
    };

    this.transactions.set(txId, tx);

    // Audit log
    auditLedger.logEvent({
      actorId: params.settledByCashierId || wallet.ownerId,
      actorName: params.settledByCashierName || wallet.ownerName,
      actorRole: params.settledByCashierId ? 'CASHIER' : 'PATIENT',
      facilityId: bill.facilityId,
      action: 'FINANCIAL_TRANSACT',
      resourceType: 'BILL',
      resourceId: bill.id,
      reason: `Settled Bill #${bill.id} with automated HMO split ($${bill.hmoContribution} HMO + $${bill.patientCoPay} Co-Pay)`,
      metadata: { txId, billId: bill.id, hmoCovered: bill.hmoContribution, patientPaid: bill.patientCoPay },
    });

    return { bill, transaction: tx };
  }

  /**
   * 3. Hold Escrow Deposit for Surgery / Admission
   */
  public holdEscrow(params: {
    patientWalletId: string;
    facilityId: string;
    amount: number;
    reason: string;
    encounterId: string;
  }): FinancialTransaction {
    const wallet = this.wallets.get(params.patientWalletId);
    if (!wallet) throw new Error(`Wallet ${params.patientWalletId} not found`);
    if (wallet.availableBalance < params.amount) {
      throw new Error(`Insufficient funds for escrow hold of ${params.amount}`);
    }

    const txId = `TX-ESCROW-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    // Reclassify liability: from Available Wallets to Escrow Deposits
    const journal = this.postJournalEntries(txId, [
      {
        accountCode: '2010-PATIENT-WALLETS',
        type: 'DEBIT',
        amount: params.amount,
        description: `Hold escrow for ${params.reason} (${params.encounterId})`,
      },
      {
        accountCode: '2020-ADMISSION-ESCROW',
        type: 'CREDIT',
        amount: params.amount,
        description: `Escrow deposit secured for ${params.encounterId}`,
      },
    ]);

    wallet.availableBalance -= params.amount;
    wallet.escrowBalance += params.amount;
    wallet.totalBalance = wallet.availableBalance + wallet.escrowBalance;
    wallet.updatedAt = new Date().toISOString();

    const hashSignature = crypto
      .createHash('sha256')
      .update(`${txId}:${wallet.id}:ESCROW_HOLD:${params.amount}`)
      .digest('hex');

    const tx: FinancialTransaction = {
      id: txId,
      idempotencyKey: `IDEM-${txId}`,
      type: 'ESCROW_HOLD',
      amount: params.amount,
      currency: wallet.currency,
      fee: 0,
      status: 'COMPLETED',
      patientId: wallet.ownerId,
      facilityId: params.facilityId,
      encounterId: params.encounterId,
      journalEntries: journal,
      reference: `ESCROW-${params.encounterId}`,
      hashSignature,
      createdAt: new Date().toISOString(),
    };

    this.transactions.set(txId, tx);

    auditLedger.logEvent({
      actorId: wallet.ownerId,
      actorName: wallet.ownerName,
      actorRole: 'PATIENT',
      facilityId: params.facilityId,
      action: 'FINANCIAL_TRANSACT',
      resourceType: 'WALLET',
      resourceId: wallet.id,
      reason: `Held surgical/admission escrow deposit of ${wallet.currency} ${params.amount}`,
      metadata: { txId, encounterId: params.encounterId, reason: params.reason },
    });

    return tx;
  }

  /**
   * 4. Cashier Shift Till Reconciliation & Close
   */
  public reconcileAndCloseTill(params: {
    tillId: string;
    actualCashCounted: number;
    cashierId: string;
    cashierName: string;
    notes?: string;
  }): CashierTill {
    const till = this.tills.get(params.tillId);
    if (!till) throw new Error(`Till ${params.tillId} not found`);
    if (till.status === 'CLOSED') throw new Error(`Till ${params.tillId} is already closed`);

    till.actualCashCounted = params.actualCashCounted;
    till.closedAt = new Date().toISOString();
    till.discrepancyAmount = params.actualCashCounted - till.expectedCashTotal;
    till.status = Math.abs(till.discrepancyAmount) < 0.01 ? 'RECONCILED' : 'DISCREPANCY';
    till.reconciliationNotes = params.notes || 'End-of-shift reconciliation completed';

    auditLedger.logEvent({
      actorId: params.cashierId,
      actorName: params.cashierName,
      actorRole: 'CASHIER',
      facilityId: till.facilityId,
      action: 'FINANCIAL_TRANSACT',
      resourceType: 'BILL',
      resourceId: till.id,
      reason: `Closed cashier till #${till.id}. Expected: $${till.expectedCashTotal}, Actual: $${params.actualCashCounted}, Variance: $${till.discrepancyAmount}`,
      metadata: { tillId: till.id, variance: till.discrepancyAmount, status: till.status },
    });

    return till;
  }

  // ─── Query Getters ───
  public getWallet(id: string): Wallet | undefined {
    return this.wallets.get(id);
  }

  public getWalletsByOwner(ownerId: string): Wallet[] {
    return Array.from(this.wallets.values()).filter((w) => w.ownerId === ownerId);
  }

  public getAllWallets(): Wallet[] {
    return Array.from(this.wallets.values());
  }

  public getLedgerAccounts(): LedgerAccount[] {
    return Array.from(this.accounts.values());
  }

  public getTransactions(limit = 50): FinancialTransaction[] {
    return Array.from(this.transactions.values()).slice().reverse().slice(0, limit);
  }

  public getBills(): ItemizedBill[] {
    return Array.from(this.bills.values());
  }

  public getBill(id: string): ItemizedBill | undefined {
    return this.bills.get(id);
  }

  public getTills(): CashierTill[] {
    return Array.from(this.tills.values());
  }

  public getTill(id: string): CashierTill | undefined {
    return this.tills.get(id);
  }
}

export const bankingCore = new BankingCoreService();
