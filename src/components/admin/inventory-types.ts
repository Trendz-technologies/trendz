/**
 * Shapes returned by the inventory, warehouse, supplier and purchasing APIs.
 * Money is integer paise; rates are basis points (1800 = 18%).
 */

export type ActiveStatus = "ACTIVE" | "INACTIVE";

export interface IndianState {
  name: string;
  code: string;
}

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------

export interface WarehouseBase {
  id: string;
  code: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  gstin: string | null;
  status: ActiveStatus;
  isOnlineFulfillment: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

/** Row of GET /warehouses. */
export interface Warehouse extends WarehouseBase {
  locationCount: number;
  onHand: number;
  reserved: number;
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  code: string;
  name: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GET /warehouses/:id */
export interface WarehouseDetail extends WarehouseBase {
  locations: WarehouseLocation[];
}

// ---------------------------------------------------------------------------
// Stock levels / ledger
// ---------------------------------------------------------------------------

export type LevelStatus = "IN_STOCK" | "LOW" | "OUT";

/** Row of GET /inventory (per variant; per warehouse when one is selected). */
export interface LevelRow {
  variantId: string;
  sku: string;
  title: string;
  productId: string;
  productName: string;
  onHand: number;
  reserved: number;
  available: number;
  damaged: number;
  returned: number;
  lowStockThreshold: number;
  status: LevelStatus;
  stockValue: number | null;
}

/** GET /inventory/variants/:id */
export interface VariantStock {
  id: string;
  sku: string;
  title: string;
  product: { id: string; name: string };
  inventoryLevels: {
    id: string;
    variantId: string;
    warehouseId: string;
    locationId: string | null;
    onHand: number;
    reserved: number;
    damaged: number;
    returned: number;
    available: number;
    lowStockThreshold: number | null;
    updatedAt: string;
    warehouse: { id: string; code: string; name: string };
    location: { code: string } | null;
  }[];
  reservations: { quantity: number; warehouseId: string; expiresAt: string | null; orderId: string | null }[];
  totals: { onHand: number; reserved: number; available: number; damaged: number };
}

export const MOVEMENT_TYPES = [
  "PURCHASE",
  "SALE",
  "RETURN",
  "REFUND",
  "DAMAGE",
  "ADJUSTMENT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "STOCK_CORRECTION",
  "RESERVATION",
  "RESERVATION_RELEASE",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type StockBucket = "ON_HAND" | "RESERVED" | "DAMAGED" | "RETURNED";

/** Row of GET /inventory/transactions */
export interface LedgerRow {
  id: string;
  variantId: string;
  warehouseId: string;
  sku: string;
  type: MovementType;
  bucket: StockBucket;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  userId: string | null;
  notes: string | null;
  createdAt: string;
  warehouse: { code: string; name: string };
  variant: { title: string; product: { name: string } };
  user: { id: string; email: string | null; name: string } | null;
}

export const ADJUST_REASONS = ["COUNT_CORRECTION", "DAMAGE", "LOSS", "FOUND", "EXPIRED", "OPENING_STOCK", "OTHER"] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export type TransferStatus = "DRAFT" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
export const TRANSFER_STATUSES: TransferStatus[] = ["DRAFT", "IN_TRANSIT", "RECEIVED", "CANCELLED"];

interface TransferBase {
  id: string;
  number: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: TransferStatus;
  notes: string | null;
  createdById: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  fromWarehouse: { id: string; code: string; name: string };
  toWarehouse: { id: string; code: string; name: string };
}

export interface TransferRow extends TransferBase {
  items: { quantity: number; receivedQuantity: number }[];
}

export interface TransferDetail extends TransferBase {
  items: {
    id: string;
    transferId: string;
    variantId: string;
    quantity: number;
    receivedQuantity: number;
    variant: { sku: string; title: string; product: { name: string } };
  }[];
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export interface Supplier {
  id: string;
  code: string;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  postalCode: string | null;
  country: string;
  paymentTermsDays: number | null;
  paymentTerms: string | null;
  status: ActiveStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierRow extends Supplier {
  purchaseOrderCount: number;
}

export interface PurchaseHistoryRow {
  id: string;
  number: string;
  status: PoStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
  grandTotal: number;
  quantityOrdered: number;
  quantityReceived: number;
  quantityPending: number;
}

// ---------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------

export type PoStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CLOSED" | "CANCELLED";
export const PO_STATUSES: PoStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED", "CANCELLED"];

interface PoBase {
  id: string;
  number: string;
  supplierId: string;
  warehouseId: string;
  status: PoStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
  subtotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;
  notes: string | null;
  createdById: string | null;
  approvedById: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PoRow extends PoBase {
  supplier: { name: string; code: string };
  warehouse: { code: string; name: string };
  quantityOrdered: number;
  quantityReceived: number;
}

export interface PoItem {
  id: string;
  purchaseOrderId: string;
  variantId: string;
  sku: string;
  description: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityPending: number;
  unitCost: number;
  taxRateBps: number;
  taxAmount: number;
  lineTotal: number;
  variant: { sku: string; title: string; product: { name: string } };
}

export interface GoodsReceipt {
  id: string;
  number: string;
  purchaseOrderId: string;
  warehouseId: string;
  receivedById: string | null;
  receivedAt: string;
  notes: string | null;
  createdAt: string;
  items: { id: string; goodsReceiptId: string; purchaseOrderItemId: string; variantId: string; quantityReceived: number; quantityDamaged: number }[];
}

/** GET /purchase-orders/:id */
export interface PoDetail extends PoBase {
  supplier: { id: string; code: string; name: string; gstin: string | null };
  warehouse: { id: string; code: string; name: string };
  items: PoItem[];
  receipts: GoodsReceipt[];
}
