import {
  Wallet,
  FinancialTransaction,
  ItemizedBill,
  CashierTill,
  LedgerAccount,
  PaymentMethod,
  CommissionerSecurityDossier,
  AuditBlock,
  BreakGlassEvent,
  SyncTopic,
  EmitterApp,
  SyncEnvelope,
} from '@medcore/types';

export interface MedCoreClientConfig {
  baseUrl: string;
  wsUrl?: string;
  token?: string;
}

export class MedCoreClient {
  public baseUrl: string;
  public wsUrl: string;
  private token?: string;

  constructor(config: MedCoreClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.wsUrl = config.wsUrl || this.baseUrl.replace(/^http/, 'ws') + '/ws';
    this.token = config.token;
  }

  public setToken(token: string) {
    this.token = token;
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers as Record<string, string>),
    };

    const res = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `MedCore API Error: ${res.statusText}`);
    }
    return json;
  }

  // ─── Banking & Health Wallet Sub-Client ──────────────────────────────────
  public banking = {
    getWallets: async (ownerId?: string): Promise<{ success: boolean; data: Wallet[] }> => {
      const q = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
      return this.request(`/api/v1/banking/wallets${q}`);
    },

    getWalletById: async (id: string): Promise<{ success: boolean; data: Wallet }> => {
      return this.request(`/api/v1/banking/wallets/${id}`);
    },

    fundWallet: async (params: {
      walletId: string;
      amount: number;
      paymentMethod: PaymentMethod;
      reference?: string;
    }): Promise<{ success: boolean; data: { transaction: FinancialTransaction; wallet: Wallet } }> => {
      return this.request('/api/v1/banking/wallets/fund', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },

    settleBill: async (
      billId: string,
      params: { patientWalletId: string; settledByCashierId?: string; settledByCashierName?: string; tillId?: string }
    ): Promise<{ success: boolean; data: { bill: ItemizedBill; transaction: FinancialTransaction } }> => {
      return this.request(`/api/v1/banking/bills/${billId}/settle`, {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },

    holdEscrow: async (params: {
      patientWalletId: string;
      facilityId: string;
      amount: number;
      reason: string;
      encounterId: string;
    }): Promise<{ success: boolean; data: { transaction: FinancialTransaction; wallet: Wallet } }> => {
      return this.request('/api/v1/banking/escrow/hold', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },

    getLedger: async (): Promise<{
      success: boolean;
      data: { chartOfAccounts: LedgerAccount[]; accountingInvariant: { totalDebits: number; totalCredits: number; isBalanced: boolean } };
    }> => {
      return this.request('/api/v1/banking/ledger');
    },

    getTills: async (): Promise<{ success: boolean; data: CashierTill[] }> => {
      return this.request('/api/v1/banking/tills');
    },

    closeTill: async (
      tillId: string,
      params: { actualCashCounted: number; cashierId: string; cashierName?: string; notes?: string }
    ): Promise<{ success: boolean; data: CashierTill }> => {
      return this.request(`/api/v1/banking/tills/${tillId}/close`, {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
  };

  // ─── Commissioner Security Sub-Client ─────────────────────────────────────
  public security = {
    getCommissionerBriefing: async (): Promise<{
      success: boolean;
      data: { dossier: CommissionerSecurityDossier; executiveReport: any };
    }> => {
      return this.request('/api/v1/security/commissioner-briefing');
    },

    verifyAuditLedger: async (): Promise<{
      success: boolean;
      data: { valid: boolean; totalBlocks: number; genesisHash: string; headHash: string; verifiedAt: string };
    }> => {
      return this.request('/api/v1/security/verify-ledger');
    },

    getAuditTrail: async (
      limit = 50,
      offset = 0
    ): Promise<{ success: boolean; data: { totalBlocks: number; blocks: AuditBlock[] } }> => {
      return this.request(`/api/v1/security/audit-trail?limit=${limit}&offset=${offset}`);
    },

    triggerBreakGlass: async (params: {
      doctorId: string;
      doctorName: string;
      patientId: string;
      patientMRN?: string;
      facilityId?: string;
      justification: string;
      clinicalIndication: 'UNCONSCIOUS_TRAUMA' | 'CARDIAC_ARREST' | 'MASS_CASUALTY' | 'ACUTE_SURGICAL';
    }): Promise<{ success: boolean; data: BreakGlassEvent }> => {
      return this.request('/api/v1/security/break-glass', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
  };

  // ─── Real-Time Sync Sub-Client ────────────────────────────────────────────
  public sync = {
    getStatus: async (): Promise<{ success: boolean; data: any }> => {
      return this.request('/api/v1/sync/status');
    },

    broadcast: async <T>(params: {
      topic: SyncTopic;
      facilityId?: string;
      emitterApp: EmitterApp;
      payload: T;
    }): Promise<{ success: boolean; data: SyncEnvelope<T> }> => {
      return this.request('/api/v1/sync/broadcast', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
  };
}

export * from './index';
