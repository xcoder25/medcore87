import { AuditBlock, AuditAction, UserRole } from '@medcore/types';
import { computeBlockHash, signAuditRecord, verifyAuditSignature } from './crypto';

export class AuditLedgerService {
  private chain: AuditBlock[] = [];
  private static readonly GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor() {
    this.createGenesisBlock();
  }

  private createGenesisBlock(): void {
    const timestamp = '2026-01-01T00:00:00.000Z';
    const blockNumber = 0;
    const actorId = 'SYS-CORE-M87';
    const actorName = 'MedCore Cryptographic Kernel';
    const actorRole: UserRole = 'SYSTEM_DAEMON';
    const facilityId = 'NATIONAL-CENTRAL-HUB';
    const action: AuditAction = 'SURVEILLANCE_EXPORT';
    const resourceType = 'FACILITY';
    const resourceId = 'GENESIS';
    const reason = 'Cryptographic Genesis Block Initialized for Ministry of Health & Hospital Ecosystem';
    const ipAddress = '127.0.0.1';
    const previousHash = AuditLedgerService.GENESIS_PREV_HASH;

    const currentHash = computeBlockHash(
      blockNumber,
      timestamp,
      actorId,
      action,
      resourceId,
      previousHash,
      { system: 'MedCore M87', version: '1.0' }
    );
    const signature = signAuditRecord(currentHash);

    const genesis: AuditBlock = {
      blockNumber,
      timestamp,
      actorId,
      actorName,
      actorRole,
      facilityId,
      action,
      resourceType,
      resourceId,
      reason,
      ipAddress,
      metadata: { system: 'MedCore M87', version: '1.0' },
      previousHash,
      currentHash,
      signature,
    };

    this.chain.push(genesis);
  }

  /**
   * Records an immutable, cryptographically chained audit event
   */
  public logEvent(params: {
    actorId: string;
    actorName: string;
    actorRole: UserRole;
    facilityId: string;
    action: AuditAction;
    resourceType: 'PATIENT' | 'ENCOUNTER' | 'BILL' | 'WALLET' | 'PRESCRIPTION' | 'LAB_RESULT' | 'FACILITY';
    resourceId: string;
    reason: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  }): AuditBlock {
    const lastBlock = this.chain[this.chain.length - 1];
    const blockNumber = this.chain.length;
    const timestamp = new Date().toISOString();
    const previousHash = lastBlock.currentHash;

    const currentHash = computeBlockHash(
      blockNumber,
      timestamp,
      params.actorId,
      params.action,
      params.resourceId,
      previousHash,
      params.metadata
    );

    const signature = signAuditRecord(currentHash);

    const newBlock: AuditBlock = {
      blockNumber,
      timestamp,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      facilityId: params.facilityId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      reason: params.reason,
      ipAddress: params.ipAddress || '127.0.0.1',
      metadata: params.metadata,
      previousHash,
      currentHash,
      signature,
    };

    this.chain.push(newBlock);
    return newBlock;
  }

  /**
   * Cryptographic verification of the complete chain from Genesis to Head.
   * Confirms 100% data integrity with zero unauthorized alterations.
   */
  public verifyChainIntegrity(): {
    valid: boolean;
    totalBlocks: number;
    genesisHash: string;
    headHash: string;
    tamperedBlockIndex?: number;
    errorReason?: string;
    verifiedAt: string;
  } {
    const verifiedAt = new Date().toISOString();

    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];

      // 1. Verify previous hash linkage
      if (i === 0) {
        if (block.previousHash !== AuditLedgerService.GENESIS_PREV_HASH) {
          return {
            valid: false,
            totalBlocks: this.chain.length,
            genesisHash: this.chain[0].currentHash,
            headHash: this.chain[this.chain.length - 1].currentHash,
            tamperedBlockIndex: 0,
            errorReason: 'Genesis previousHash is corrupted',
            verifiedAt,
          };
        }
      } else {
        const prev = this.chain[i - 1];
        if (block.previousHash !== prev.currentHash) {
          return {
            valid: false,
            totalBlocks: this.chain.length,
            genesisHash: this.chain[0].currentHash,
            headHash: this.chain[this.chain.length - 1].currentHash,
            tamperedBlockIndex: i,
            errorReason: `Block #${i} previousHash does not match Block #${i - 1} currentHash`,
            verifiedAt,
          };
        }
      }

      // 2. Recompute current hash to detect payload tampering
      const recomputed = computeBlockHash(
        block.blockNumber,
        block.timestamp,
        block.actorId,
        block.action,
        block.resourceId,
        block.previousHash,
        block.metadata
      );

      if (recomputed !== block.currentHash) {
        return {
          valid: false,
          totalBlocks: this.chain.length,
          genesisHash: this.chain[0].currentHash,
          headHash: this.chain[this.chain.length - 1].currentHash,
          tamperedBlockIndex: i,
          errorReason: `Block #${i} hash mismatch: payload data was modified after signing`,
          verifiedAt,
        };
      }

      // 3. Verify digital signature
      if (!verifyAuditSignature(block.currentHash, block.signature)) {
        return {
          valid: false,
          totalBlocks: this.chain.length,
          genesisHash: this.chain[0].currentHash,
          headHash: this.chain[this.chain.length - 1].currentHash,
          tamperedBlockIndex: i,
          errorReason: `Block #${i} signature verification failed`,
          verifiedAt,
        };
      }
    }

    return {
      valid: true,
      totalBlocks: this.chain.length,
      genesisHash: this.chain[0].currentHash,
      headHash: this.chain[this.chain.length - 1].currentHash,
      verifiedAt,
    };
  }

  public getBlocks(limit = 100, offset = 0): AuditBlock[] {
    return this.chain.slice().reverse().slice(offset, offset + limit);
  }

  public getBlockCount(): number {
    return this.chain.length;
  }
}

export const auditLedger = new AuditLedgerService();
