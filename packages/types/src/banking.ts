// ─── MedCore Banking & Health Wallet Core Types ─────────────────────────────

export type WalletOwnerType = 'PATIENT' | 'FACILITY' | 'HMO' | 'DEPARTMENT_TILL';

export type WalletStatus = 'ACTIVE' | 'FROZEN' | 'RESTRICTED' | 'CLOSED';

export interface Wallet {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerType: WalletOwnerType;
  facilityId?: string;
  currency: 'USD' | 'NGN' | 'EUR' | 'GBP';
  availableBalance: number;
  escrowBalance: number; // Held for admissions / surgeries
  totalBalance: number;
  status: WalletStatus;
  dailySpendingLimit: number;
  paystackCustomerCode?: string;
  paystackDedicatedAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    assignedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Double-Entry Financial Ledger ──────────────────────────────────────────

export type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface LedgerAccount {
  code: string; // e.g. '1010-CASH', '2010-PATIENT-WALLET', '4010-CONSULTATION-REV'
  name: string;
  category: AccountCategory;
  normalBalance: 'DEBIT' | 'CREDIT';
  balance: number;
  description: string;
}

export type EntryType = 'DEBIT' | 'CREDIT';

export interface JournalEntry {
  id: string;
  transactionId: string;
  accountCode: string;
  accountName: string;
  type: EntryType;
  amount: number;
  description: string;
  timestamp: string;
}

export type TransactionType =
  | 'WALLET_DEPOSIT'
  | 'BILL_SETTLEMENT'
  | 'HMO_CLAIM_SETTLEMENT'
  | 'CO_PAY_DEDUCTION'
  | 'ESCROW_HOLD'
  | 'ESCROW_RELEASE'
  | 'TILL_FLOAT_IN'
  | 'TILL_RECONCILIATION'
  | 'PATIENT_REFUND';

export type PaymentMethod = 'CARD' | 'BANK_TRANSFER' | 'USSD' | 'MOBILE_MONEY' | 'POS' | 'CASH';

export interface FinancialTransaction {
  id: string;
  idempotencyKey: string;
  type: TransactionType;
  amount: number;
  currency: string;
  fee: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED';
  paymentMethod?: PaymentMethod;
  patientId?: string;
  facilityId?: string;
  encounterId?: string;
  billId?: string;
  tillId?: string;
  hmoSplitAmount?: number;
  patientCoPayAmount?: number;
  journalEntries: JournalEntry[];
  reference: string;
  hashSignature: string;
  createdAt: string;
}

// ─── Cashier Till Management ────────────────────────────────────────────────

export type TillStatus = 'OPEN' | 'CLOSED' | 'RECONCILED' | 'DISCREPANCY';

export interface CashierTill {
  id: string;
  cashierId: string;
  cashierName: string;
  facilityId: string;
  facilityName: string;
  shiftDate: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  cashCollected: number;
  posCollected: number;
  transferCollected: number;
  totalCollected: number;
  expectedCashTotal: number;
  actualCashCounted?: number;
  discrepancyAmount?: number;
  status: TillStatus;
  reconciliationNotes?: string;
}

// ─── Itemized Bill & Automated Split Billing ────────────────────────────────

export interface BillItem {
  id: string;
  code: string;
  description: string;
  category: 'CONSULTATION' | 'PHARMACY' | 'LABORATORY' | 'PROCEDURE' | 'BED_ACCOMMODATION';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  coveredByHMO: boolean;
  hmoCoveredAmount: number;
  patientPayableAmount: number;
}

export interface ItemizedBill {
  id: string;
  patientId: string;
  patientName: string;
  patientMRN: string;
  facilityId: string;
  encounterId: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  hmoContribution: number;
  patientCoPay: number;
  depositApplied: number;
  amountPaid: number;
  balanceDue: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED' | 'WRITTEN_OFF';
  hmoPolicyId?: string;
  hmoClaimStatus?: 'PENDING' | 'APPROVED' | 'AUTO_SETTLED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

// ─── Payment Flow & AkwaRemit Gateway Integration ───────────────────────────

export type SelectedPaymentChannel = 'WALLET' | 'AKWAREMIT' | 'CASH_OTC';

export interface AkwaRemitCheckoutSession {
  sessionId: string;
  reference: string;
  billId?: string;
  walletId?: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerPhone?: string;
  customerName: string;
  checkoutUrl: string;
  virtualAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    expiresInMinutes: number;
  };
  ussdPrompt?: {
    bank: string;
    code: string;
  };
  qrCodeData: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string;
}

export interface CashPaymentOrder {
  orderCode: string; // e.g. "CSH-784-21" - short OTC code for cashier lookup
  billId: string;
  patientId: string;
  patientName: string;
  patientMRN: string;
  facilityId: string;
  facilityName: string;
  amountDue: number;
  currency: string;
  qrPayload: string; // Digital signed QR payload for cashier scanner
  barcode: string; // EAN/Code-128 numeric barcode string
  status: 'AWAITING_CASHIER' | 'COLLECTED' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  expiresAt: string;
  collectedAt?: string;
  collectedByCashierId?: string;
  collectedByCashierName?: string;
  tillId?: string;
  receiptNumber?: string;
}
