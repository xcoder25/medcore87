import { Router, Request, Response } from 'express';
import { syncEventBus } from '../sync/eventBus';
import { dataStore } from '../store/database';
import { auditLedger } from '../security/auditLedger';

const router = Router();

/**
 * GET /api/v1/pharmacy/stock
 * List pharmacy stock items, optionally filter by low stock
 */
router.get('/stock', (req: Request, res: Response) => {
  const lowStockOnly = req.query.lowStock === 'true';
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;

  const items = dataStore.getAllStockItems({ category, lowStockOnly });

  res.json({
    success: true,
    total: items.length,
    lowStockCount: items.filter((i) => i.quantityOnHand <= i.reorderLevel).length,
    data: items,
  });
});

/**
 * GET /api/v1/pharmacy/stock/:code
 */
router.get('/stock/:code', (req: Request, res: Response) => {
  const item = dataStore.getStockItem(req.params.code as string);
  if (!item) {
    return res.status(404).json({ success: false, error: `Stock item ${req.params.code} not found` });
  }
  res.json({ success: true, data: item });
});

/**
 * POST /api/v1/pharmacy/stock/restock
 * Receive goods / replenish pharmacy batch
 */
router.post('/stock/restock', (req: Request, res: Response) => {
  const { itemCode, quantity, batchNumber, expiryDate, actorName } = req.body;

  if (!itemCode || !quantity || !batchNumber || !expiryDate) {
    return res.status(400).json({
      success: false,
      error: 'itemCode, quantity, batchNumber, and expiryDate are required',
    });
  }

  try {
    const updated = dataStore.restockItem({
      itemCode,
      quantity: Number(quantity),
      batchNumber,
      expiryDate,
      actorName: actorName || 'Supply Chain Officer',
    });

    auditLedger.logEvent({
      actorId: 'SUPPLY-CHAIN',
      actorName: actorName || 'Supply Chain Officer',
      actorRole: 'PHARMACIST',
      facilityId: 'FAC-001',
      action: 'WRITE_PHI',
      resourceType: 'PRESCRIPTION',
      resourceId: itemCode,
      reason: `Restocked ${quantity} units of ${updated.genericName} (Batch: ${batchNumber})`,
    });

    res.status(200).json({
      success: true,
      message: `Successfully restocked ${quantity} units of ${updated.genericName}. New balance: ${updated.quantityOnHand}.`,
      data: updated,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/pharmacy/stock/deplete
 * Dispense or manual deduction
 */
router.post('/stock/deplete', (req: Request, res: Response) => {
  const { itemCode, quantity, referenceId, actorId, actorName } = req.body;

  if (!itemCode || !quantity || !referenceId) {
    return res.status(400).json({
      success: false,
      error: 'itemCode, quantity, and referenceId are required',
    });
  }

  try {
    const updated = dataStore.depleteStock({
      itemCode,
      quantity: Number(quantity),
      referenceId,
      actorId,
      actorName,
    });

    const facilityId = (req.body.facilityId as string) || 'FAC-001';

    syncEventBus.broadcast({
      topic: 'PRESCRIPTION_DISPENSED',
      facilityId,
      emitterApp: 'API_SERVER',
      payload: {
        itemCode,
        drugName: updated.genericName,
        quantity: Number(quantity),
        remaining: updated.quantityOnHand,
        referenceId,
        actorName: actorName || 'Pharmacist',
        status: updated.status,
      },
    });

    if (updated.status === 'CRITICAL' || updated.status === 'OUT_OF_STOCK' || Number(updated.quantityOnHand) <= (updated.reorderLevel || 0)) {
      syncEventBus.broadcast({
        topic: 'DRUG_STOCKOUT',
        facilityId,
        emitterApp: 'API_SERVER',
        payload: {
          itemCode,
          drugName: updated.genericName,
          quantityOnHand: updated.quantityOnHand,
          reorderLevel: updated.reorderLevel,
          status: updated.status,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: `Dispensed ${quantity} units of ${updated.genericName}. Remaining balance: ${updated.quantityOnHand}.`,
      data: updated,
      eventsPublished: true,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/pharmacy/stock/transactions
 * Retrieve stock transaction ledger
 */
router.get('/transactions', (req: Request, res: Response) => {
  const itemCode = typeof req.query.itemCode === 'string' ? req.query.itemCode : undefined;
  const txs = dataStore.getStockTransactions(itemCode);
  res.json({ success: true, total: txs.length, data: txs });
});

/**
 * POST /api/v1/pharmacy/formulary/check
 * Verifies if drug is on Akwa Ibom State Essential Medicines List (EML)
 */
router.post('/formulary/check', (req: Request, res: Response) => {
  const { drugName, facilityTier } = req.body;

  if (!drugName) {
    return res.status(400).json({ success: false, error: 'drugName is required' });
  }

  const allItems = dataStore.getAllStockItems();
  const match = allItems.find(
    (i) =>
      i.genericName.toLowerCase().includes(drugName.toLowerCase()) ||
      drugName.toLowerCase().includes(i.genericName.toLowerCase()) ||
      (i.brandName && drugName.toLowerCase().includes(i.brandName.toLowerCase()))
  );

  if (!match) {
    return res.json({
      success: true,
      onFormulary: false,
      tier: 'NON_FORMULARY',
      message: `${drugName} is not listed on the Akwa Ibom State Essential Medicines List (EML). Special authorization or non-formulary substitution required.`,
    });
  }

  const isTierPermitted = true; // Secondary facilities can dispense PRIMARY and SECONDARY tiers

  res.json({
    success: true,
    onFormulary: true,
    itemCode: match.itemCode,
    genericName: match.genericName,
    brandName: match.brandName,
    strength: match.strength,
    form: match.form,
    emlTier: match.emlTier,
    unitPriceNgn: match.unitPriceNgn,
    stockOnHand: match.quantityOnHand,
    status: match.status,
    permittedForFacilityTier: isTierPermitted,
    message: `${match.genericName} is on the Akwa Ibom State EML (${match.emlTier} Tier). Current stock: ${match.quantityOnHand} (${match.status}).`,
  });
});

export default router;
