export type EmlTier = 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'SPECIALIST';

export interface PharmacyStockItem {
  id: string;
  itemCode: string;
  genericName: string;
  brandName?: string;
  form: 'TABLET' | 'INJECTION' | 'SYRUP' | 'INFUSION' | 'SUSPENSION' | 'OINTMENT' | 'DROPS';
  strength: string;
  emlTier: EmlTier;
  isOnStateFormulary: boolean;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  allocatedQuantity: number;
  reorderLevel: number;
  unitCostNgn: number;
  unitPriceNgn: number;
  locationRack: string;
  supplier: string;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'STOCKOUT' | 'EXPIRED';
  updatedAt: string;
}

export interface StockTransaction {
  id: string;
  itemCode: string;
  genericName: string;
  type: 'RECEIVE' | 'DISPENSE' | 'ADJUSTMENT' | 'EXPIRY_DISPOSAL' | 'RESERVATION';
  quantity: number;
  balanceAfter: number;
  referenceId: string; // e.g. Rx ID or Invoice #
  actorId: string;
  actorName: string;
  timestamp: string;
}
