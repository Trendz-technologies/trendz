/**
 * Shapes returned by the staff sales endpoints (orders, payments, refunds,
 * shipments, returns, invoices, promotions). Money is integer paise; rates and
 * percentage discounts are basis points.
 */
import type { OrderAddress, OrderItem, OrderStatus, PaymentStatus } from "@/lib/types";

export type { OrderStatus, PaymentStatus };

export const ORDER_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURN_REQUESTED", "RETURNED", "REFUNDED"];
export const PAYMENT_STATUSES: PaymentStatus[] = ["CREATED", "PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];

export type PaymentProvider = "RAZORPAY" | "CASH" | "UPI_MANUAL" | "CARD_MANUAL";
export const PAYMENT_PROVIDERS: PaymentProvider[] = ["RAZORPAY", "CASH", "UPI_MANUAL", "CARD_MANUAL"];

export type RefundStatus = "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";
export const REFUND_STATUSES: RefundStatus[] = ["PENDING", "PROCESSING", "PROCESSED", "FAILED"];

export type ShipmentStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "CREATED"
  | "PICKUP_SCHEDULED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "FAILED"
  | "RETURN_TO_ORIGIN"
  | "RETURNED";
export const SHIPMENT_STATUSES: ShipmentStatus[] = ["PENDING", "CREATED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "FAILED", "RETURN_TO_ORIGIN", "RETURNED"];
/** Shipments in these states can still be cancelled with the courier. */
export const CANCELLABLE_SHIPMENT: ShipmentStatus[] = ["PENDING", "CREATED", "PICKUP_SCHEDULED"];
export const FINAL_SHIPMENT: ShipmentStatus[] = ["DELIVERED", "CANCELLED", "RETURNED"];

export type ReturnStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "PICKUP_SCHEDULED" | "RECEIVED" | "REFUNDED" | "CLOSED" | "CANCELLED";
export const RETURN_STATUSES: ReturnStatus[] = ["REQUESTED", "APPROVED", "REJECTED", "PICKUP_SCHEDULED", "RECEIVED", "REFUNDED", "CLOSED", "CANCELLED"];
export type ReturnCondition = "GOOD" | "DAMAGED" | "DEFECTIVE";

/** Payment states that hold captured money (refundable / fulfillable). */
export const CAPTURED: PaymentStatus[] = ["PAID", "PARTIALLY_REFUNDED"];

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface StaffPayment {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  method: string | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  amountRefunded: number;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  referenceNumber: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface StaffRefund {
  id: string;
  refundNumber: string;
  paymentId: string;
  orderId: string;
  returnRequestId: string | null;
  amount: number;
  status: RefundStatus;
  razorpayRefundId: string | null;
  reason: string | null;
  failureReason: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface ShipmentEvent {
  id: string;
  status: ShipmentStatus;
  rawStatus: string;
  location: string | null;
  description: string | null;
  occurredAt: string;
}

export interface StaffShipment {
  id: string;
  orderId: string;
  warehouseId: string;
  isReturn: boolean;
  provider: string;
  awb: string | null;
  courierName: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  status: ShipmentStatus;
  shippingCost: number | null;
  weightGrams: number | null;
  estimatedDeliveryAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  events: ShipmentEvent[];
}

export interface StaffOrder {
  id: string;
  orderNumber: string;
  channel: "ONLINE" | "POS";
  userId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShipmentStatus;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  roundOff: number;
  grandTotal: number;
  amountRefunded: number;
  pricesIncludeTax: boolean;
  sellerStateCode: string;
  placeOfSupply: string;
  couponCode: string | null;
  shippingAddress: (OrderAddress & { country?: string }) | null;
  billingAddress: (OrderAddress & { country?: string }) | null;
  notes: string | null;
  cancelReason: string | null;
  reservationExpiresAt: string | null;
  placedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
  statusHistory: { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; changedById: string | null; createdAt: string }[];
  payments: StaffPayment[];
  refunds: StaffRefund[];
  shipments: StaffShipment[];
  invoice: { id: string; invoiceNumber: string; issuedAt: string; status: string } | null;
  creditNotes: { id: string; creditNoteNumber: string; total: number; issuedAt: string }[];
  returnRequests: { id: string; returnNumber: string; status: ReturnStatus; createdAt: string; items: { orderItemId: string; quantity: number }[] }[];
  warehouse: { id: string; code: string; name: string } | null;
  user: { id: string; email: string | null; phone: string | null } | null;
  createdBy: { id: string; email: string | null } | null;
  /** Statuses staff may set by hand from the current one. */
  allowedTransitions: OrderStatus[];
  canCancel: boolean;
}

// ---------------------------------------------------------------------------
// Returns
// ---------------------------------------------------------------------------

export interface ReturnDetail {
  id: string;
  returnNumber: string;
  orderId: string;
  userId: string | null;
  status: ReturnStatus;
  reason: string;
  customerNotes: string | null;
  adminNotes: string | null;
  requestedAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    channel: "ONLINE" | "POS";
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    grandTotal: number;
    amountRefunded: number;
    status: OrderStatus;
  };
  items: {
    id: string;
    orderItemId: string;
    variantId: string;
    quantity: number;
    reason: string | null;
    condition: ReturnCondition | null;
    warehouseId: string | null;
    restockedQuantity: number;
    refundAmount: number;
    orderItem: OrderItem;
    warehouse: { id: string; code: string; name: string } | null;
  }[];
  refunds: StaffRefund[];
  /** Value of the returned units (their share of what the customer paid). */
  refundableAmount: number;
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------

export type DiscountType = "PERCENTAGE" | "FIXED";
export type ChannelScope = "ALL" | "ONLINE" | "POS";

export interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  value: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  scope: "ALL" | "PRODUCTS" | "CATEGORIES";
  channel: ChannelScope;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  /** Redemptions that count against limits (active + confirmed). */
  redemptions: number;
}

export interface CouponDetail extends CouponRow {
  products: { productId: string; product: { id: string; name: string } }[];
  categories: { categoryId: string; category: { id: string; name: string } }[];
}

export interface DiscountRow {
  id: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  value: number;
  scope: "ALL" | "PRODUCTS" | "CATEGORIES" | "BRANDS";
  channel: ChannelScope;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  _count: { targets: number };
}

export interface DiscountDetail extends Omit<DiscountRow, "_count"> {
  targets: {
    id: string;
    productId: string | null;
    categoryId: string | null;
    brandId: string | null;
    product: { id: string; name: string } | null;
    category: { id: string; name: string } | null;
    brand: { id: string; name: string } | null;
  }[];
}
