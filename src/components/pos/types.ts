/** Shapes returned by /api/pos (see src/modules/pos/pos.service.ts in trendz-api). */

export type PosPaymentMethod = "CASH" | "UPI_MANUAL" | "CARD_MANUAL" | "RAZORPAY";

export interface PosConfig {
  enabledPaymentMethods: PosPaymentMethod[];
  maxManualDiscountBps: number;
}

export interface PosLine {
  id: string;
  variantId: string;
  sku: string;
  name: string;
  variant: string;
  image: string | null;
  quantity: number;
  manualDiscount: number;
  stockOverride: boolean;
  available: number;
  stockIssue: string | null;
  mrp: number;
  unitPrice: number;
  discountAmount: number;
  taxRateBps: number;
  taxAmount: number;
  lineTotal: number;
}

export interface PosTotals {
  itemCount: number;
  subtotal: number;
  discountTotal: number;
  autoDiscountTotal: number;
  couponDiscountTotal: number;
  manualDiscountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
}

export interface PosCart {
  id: string;
  status: "OPEN" | "CHECKED_OUT" | "ABANDONED";
  warehouse: { id: string; code: string; name: string; stateCode: string };
  customer: { name: string | null; phone: string | null; email: string | null };
  couponCode: string | null;
  manualDiscount: number;
  manualDiscountReason: string | null;
  orderId: string | null;
  items: PosLine[];
  totals: PosTotals;
  coupon: { code: string; valid: boolean; message?: string | null; discount?: number } | null;
}

export interface ScannedProduct {
  id: string;
  variantId: string;
  name: string;
  variant: string;
  sku: string;
  barcode: string | null;
  mrp: number;
  price: number;
  taxRateBps: number;
  availableStock: number;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK" | "OTHER_WAREHOUSE";
  message: string | null;
  otherWarehouses: { code: string; name: string; available: number }[];
  image: string | null;
}

export interface PosSearchResult {
  variantId: string;
  sku: string;
  name: string;
  variant: string;
  mrp: number;
  price: number;
  available: number;
  image: string | null;
}

export interface CheckoutResult {
  order: { id: string; orderNumber: string; grandTotal: number; paymentStatus: "PAID" | "PENDING" };
  requiresGatewayPayment: boolean;
  change: number | null;
  nextCartId: string;
}

export interface RecentSale {
  id: string;
  orderNumber: string;
  grandTotal: number;
  paymentStatus: string;
  status: string;
  customerName: string | null;
  placedAt: string;
  payments: { provider: string }[];
}

export const METHOD_LABELS: Record<PosPaymentMethod, string> = {
  CASH: "Cash",
  UPI_MANUAL: "UPI",
  CARD_MANUAL: "Card",
  RAZORPAY: "Razorpay",
};
