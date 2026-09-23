import { Router, Request, Response } from 'express';
import { bankingCore } from '../banking/bankingCore';
import { paymentGateway } from '../banking/paymentGateway';
import { paystackWallet } from '../banking/paystackWallet';
import { syncEventBus } from '../sync/eventBus';

const router = Router();

/**
 * GET /api/v1/banking/wallets
 */
router.get('/wallets', (req: Request, res: Response) => {
  const { ownerId } = req.query;
  if (ownerId) {
    return res.json({ success: true, data: bankingCore.getWalletsByOwner(ownerId as string) });
  }
  res.json({ success: true, data: bankingCore.getAllWallets() });
});

/**
 * GET /api/v1/banking/wallets/:id
 */
router.get('/wallets/:id', (req: Request, res: Response) => {
  const wallet = bankingCore.getWallet(req.params.id as string);
  if (!wallet) return res.status(404).json({ success: false, error: 'Wallet not found' });
  res.json({ success: true, data: wallet });
});

/**
 * POST /api/v1/banking/wallets/fund
 * Multi-channel funding for Patient Health Wallet
 */
router.post('/wallets/fund', (req: Request, res: Response) => {
  const { walletId, amount, paymentMethod, reference, idempotencyKey } = req.body;
  if (!walletId || !amount || !paymentMethod) {
    return res.status(400).json({ success: false, error: 'walletId, amount, and paymentMethod are required' });
  }

  try {
    const tx = bankingCore.fundWallet({
      walletId,
      amount: Number(amount),
      paymentMethod,
      reference: reference || `REF-${Date.now()}`,
      idempotencyKey,
    });

    const updatedWallet = bankingCore.getWallet(walletId);

    // Broadcast wallet balance update across event bus to Patient App & OS
    syncEventBus.broadcast({
      topic: 'WALLET_BALANCE_UPDATED',
      emitterApp: 'API_SERVER',
      payload: {
        walletId,
        availableBalance: updatedWallet?.availableBalance,
        totalBalance: updatedWallet?.totalBalance,
        fundedAmount: amount,
        txId: tx.id,
      },
    });

    res.status(200).json({
      success: true,
      message: `Health wallet funded successfully with $${amount}.`,
      data: {
        transaction: tx,
        wallet: updatedWallet,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/banking/wallets/create-dva
 * Generates or assigns a Paystack Dedicated Virtual Account (NUBAN) to a patient wallet
 */
router.post('/wallets/create-dva', (req: Request, res: Response) => {
  const { walletId, patientId, patientName, email, phone, preferredBank } = req.body;

  if (!walletId || !patientId || !patientName || !email) {
    return res.status(400).json({
      success: false,
      error: 'walletId, patientId, patientName, and email are required',
    });
  }

  try {
    const wallet = paystackWallet.createDedicatedVirtualAccount({
      walletId,
      patientId,
      patientName,
      email,
      phone,
      preferredBank,
    });

    res.json({
      success: true,
      message: `Paystack Dedicated NUBAN (${wallet.paystackDedicatedAccount?.bankName} - ${wallet.paystackDedicatedAccount?.accountNumber}) assigned to patient wallet.`,
      data: {
        walletId: wallet.id,
        paystackCustomerCode: wallet.paystackCustomerCode,
        dedicatedAccount: wallet.paystackDedicatedAccount,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/banking/wallets/paystack-topup
 * Initializes Paystack inline/hosted topup for wallet
 */
router.post('/wallets/paystack-topup', (req: Request, res: Response) => {
  const { walletId, amount, email, name } = req.body;

  if (!walletId || !amount || !email) {
    return res.status(400).json({ success: false, error: 'walletId, amount, and email are required' });
  }

  try {
    const result = paystackWallet.initializePaystackTopup({
      walletId,
      amount: Number(amount),
      email,
      name: name || 'Patient',
    });

    res.json({
      success: true,
      message: 'Paystack topup session initialized.',
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/banking/webhooks/paystack
 * Secure HMAC-SHA512 webhook from Paystack for auto-funding wallets
 */
router.post('/webhooks/paystack', (req: Request, res: Response) => {
  const signature = (req.headers['x-paystack-signature'] as string) || '';

  try {
    const result = paystackWallet.handlePaystackWebhook(req.body, signature);
    res.json({ received: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/banking/bills/:id/settle
 * Automated 80/20 HMO & Co-Pay Split Settlement
 */
router.post('/bills/:id/settle', (req: Request, res: Response) => {
  const { id } = req.params;
  const { patientWalletId, settledByCashierId, settledByCashierName, tillId } = req.body;

  if (!patientWalletId) {
    return res.status(400).json({ success: false, error: 'patientWalletId is required to process co-pay split' });
  }

  try {
    const { bill, transaction } = bankingCore.settleBillWithSplit({
      billId: id as string,
      patientWalletId,
      settledByCashierId,
      settledByCashierName,
      tillId,
    });

    // Real-time broadcast to Hospital OS Cashier, Patient Care App, and Clinic Dispensary
    syncEventBus.broadcast({
      topic: 'PAYMENT_RECEIVED',
      facilityId: bill.facilityId,
      emitterApp: settledByCashierId ? 'MEDCORE_OS' : 'MEDCORE_CARE',
      payload: {
        billId: bill.id,
        patientId: bill.patientId,
        patientName: bill.patientName,
        totalAmount: bill.totalAmount,
        hmoSplit: bill.hmoContribution,
        coPay: bill.patientCoPay,
        status: 'PAID',
        clearedForPharmacy: true,
        clearedForLab: true,
      },
    });

    res.json({
      success: true,
      message: `Bill #${bill.id} settled with automated HMO split: $${bill.hmoContribution} auto-cleared by HMO + $${bill.patientCoPay} co-pay deducted from wallet.`,
      data: {
        bill,
        transaction,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/banking/escrow/hold
 * Surgical / Inpatient admission escrow hold
 */
router.post('/escrow/hold', (req: Request, res: Response) => {
  const { patientWalletId, facilityId, amount, reason, encounterId } = req.body;
  if (!patientWalletId || !facilityId || !amount || !encounterId) {
    return res.status(400).json({ success: false, error: 'patientWalletId, facilityId, amount, and encounterId are required' });
  }

  try {
    const tx = bankingCore.holdEscrow({
      patientWalletId,
      facilityId,
      amount: Number(amount),
      reason: reason || 'Surgical Admission Deposit',
      encounterId,
    });

    const wallet = bankingCore.getWallet(patientWalletId);

    syncEventBus.broadcast({
      topic: 'WALLET_BALANCE_UPDATED',
      facilityId,
      emitterApp: 'API_SERVER',
      payload: {
        walletId: patientWalletId,
        availableBalance: wallet?.availableBalance,
        escrowBalance: wallet?.escrowBalance,
        holdAmount: amount,
      },
    });

    res.json({
      success: true,
      message: `Escrow deposit of $${amount} secured for ${encounterId}.`,
      data: { transaction: tx, wallet },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/banking/ledger
 * Returns chart of accounts and double-entry balance verification
 */
router.get('/ledger', (req: Request, res: Response) => {
  const accounts = bankingCore.getLedgerAccounts();

  let totalDebits = 0;
  let totalCredits = 0;

  for (const acc of accounts) {
    if (acc.category === 'ASSET' || acc.category === 'EXPENSE') {
      totalDebits += acc.balance;
    } else {
      totalCredits += acc.balance;
    }
  }

  res.json({
    success: true,
    data: {
      chartOfAccounts: accounts,
      accountingInvariant: {
        totalDebits: Math.round(totalDebits * 100) / 100,
        totalCredits: Math.round(totalCredits * 100) / 100,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      },
    },
  });
});

/**
 * GET /api/v1/banking/transactions
 */
router.get('/transactions', (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '50', 10);
  res.json({ success: true, data: bankingCore.getTransactions(limit) });
});

/**
 * GET /api/v1/banking/bills
 */
router.get('/bills', (req: Request, res: Response) => {
  res.json({ success: true, data: bankingCore.getBills() });
});

/**
 * GET /api/v1/banking/bills/:id
 */
router.get('/bills/:id', (req: Request, res: Response) => {
  const bill = bankingCore.getBill(req.params.id as string);
  if (!bill) return res.status(404).json({ success: false, error: 'Bill not found' });
  res.json({ success: true, data: bill });
});

/**
 * GET /api/v1/banking/tills
 */
router.get('/tills', (req: Request, res: Response) => {
  res.json({ success: true, data: bankingCore.getTills() });
});

/**
 * POST /api/v1/banking/tills/:id/close
 * Shift Till End-of-Day Reconciliation
 */
router.post('/tills/:id/close', (req: Request, res: Response) => {
  const { id } = req.params;
  const { actualCashCounted, cashierId, cashierName, notes } = req.body;

  if (actualCashCounted === undefined || !cashierId) {
    return res.status(400).json({ success: false, error: 'actualCashCounted and cashierId are required' });
  }

  try {
    const till = bankingCore.reconcileAndCloseTill({
      tillId: id as string,
      actualCashCounted: Number(actualCashCounted),
      cashierId,
      cashierName: cashierName || 'Shift Cashier',
      notes,
    });

    syncEventBus.broadcast({
      topic: 'TILL_SHIFT_CLOSED',
      facilityId: till.facilityId,
      emitterApp: 'MEDCORE_OS',
      payload: {
        tillId: till.id,
        cashierName: till.cashierName,
        expectedTotal: till.expectedCashTotal,
        actualCounted: till.actualCashCounted,
        variance: till.discrepancyAmount,
        status: till.status,
      },
    });

    res.json({
      success: true,
      message: `Till #${till.id} closed and reconciled with status: ${till.status}. Variance: $${till.discrepancyAmount}`,
      data: till,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── AkwaRemit & Multi-Channel Payment Endpoints ────────────────────────────

/**
 * POST /api/v1/banking/payments/initiate
 * Patient selects: 'WALLET' | 'AKWAREMIT' | 'CASH_OTC'
 */
router.post('/payments/initiate', (req: Request, res: Response) => {
  const { billId, patientId, channel, walletId, customerEmail, customerPhone } = req.body;

  if (!billId || !patientId || !channel) {
    return res.status(400).json({ success: false, error: 'billId, patientId, and channel are required' });
  }

  try {
    const result = paymentGateway.initiatePayment({
      billId,
      patientId,
      channel,
      walletId,
      customerEmail,
      customerPhone,
    });

    res.json({
      success: true,
      message: `Payment initiated successfully via ${channel}.`,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/banking/payments/cash-order/lookup
 * Hospital Cashier looks up OTC cash order via code or scanned barcode/QR
 */
router.post('/payments/cash-order/lookup', (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, error: 'query (orderCode, barcode, or qrPayload) is required' });
  }

  try {
    const result = paymentGateway.lookupCashOrder(query);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/banking/payments/cash-order/collect
 * Cashier collects physical banknotes, confirms amount, and settles bill
 */
router.post('/payments/cash-order/collect', (req: Request, res: Response) => {
  const { orderCode, cashierId, cashierName, tillId, amountTendered } = req.body;

  if (!orderCode || !cashierId || !tillId || amountTendered === undefined) {
    return res.status(400).json({
      success: false,
      error: 'orderCode, cashierId, tillId, and amountTendered are required',
    });
  }

  try {
    const result = paymentGateway.collectCashAtTill({
      orderCode,
      cashierId,
      cashierName: cashierName || 'Duty Cashier',
      tillId,
      amountTendered: Number(amountTendered),
    });

    res.json({
      success: true,
      message: `Cash payment of $${result.order.amountDue} confirmed. Receipt #${result.receiptNumber} issued. Change: $${result.changeDue}`,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/banking/webhooks/akwaremit
 * Secure webhook from AkwaRemit payment switch
 */
router.post('/webhooks/akwaremit', (req: Request, res: Response) => {
  const signature = (req.headers['x-akwaremit-signature'] as string) || '';

  try {
    const result = paymentGateway.processAkwaRemitWebhook(req.body, signature);
    res.json({ received: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/banking/payments/cash-orders
 */
router.get('/payments/cash-orders', (req: Request, res: Response) => {
  res.json({ success: true, data: paymentGateway.getCashOrders() });
});

export default router;
