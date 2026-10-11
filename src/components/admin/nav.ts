import {
  Star,
  BadgePercent,
  Barcode,
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  Contact,
  CreditCard,
  FileLock2,
  FileText,
  FolderTree,
  House,
  Info,
  KeyRound,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  Palette,
  ReceiptText,
  RotateCcw,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Tags,
  Truck,
  Undo2,
  UserCog,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the user has any of these permissions. */
  any: string[];
}

/** Sidebar link styles. Shared with the Appearance preview, so it shows the real thing. */
export const NAV_LINK = {
  base: "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
  idle: "text-ink/60 hover:bg-accent/[0.08] hover:text-ink",
  /** The idle link while hovered (spelled out for the preview). */
  hover: "bg-accent/[0.08] text-ink",
  active: "bg-accent/15 text-ink [&>svg]:text-accent",
} as const;

export const ADMIN_NAV: { group: string; items: NavItem[] }[] = [
  { group: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, any: ["dashboard.read"] }] },
  {
    group: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, any: ["products.read"] },
      { href: "/admin/categories", label: "Categories", icon: FolderTree, any: ["categories.read"] },
      { href: "/admin/brands", label: "Brands", icon: Tags, any: ["brands.read"] },
      { href: "/admin/codes", label: "Codes & labels", icon: Barcode, any: ["codes.manage", "products.read"] },
    ],
  },
  {
    group: "Inventory",
    items: [
      { href: "/admin/inventory", label: "Inventory", icon: Boxes, any: ["inventory.read"] },
      { href: "/admin/warehouses", label: "Warehouses", icon: Warehouse, any: ["warehouses.read"] },
      { href: "/admin/suppliers", label: "Suppliers", icon: Truck, any: ["suppliers.read"] },
      { href: "/admin/purchase-orders", label: "Purchase orders", icon: ClipboardList, any: ["purchases.read"] },
    ],
  },
  {
    group: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart, any: ["orders.read"] },
      { href: "/admin/customers", label: "Customers", icon: Users, any: ["customers.read"] },
      { href: "/admin/payments", label: "Payments", icon: CreditCard, any: ["payments.read"] },
      { href: "/admin/refunds", label: "Refunds", icon: Undo2, any: ["refunds.read"] },
      { href: "/admin/returns", label: "Returns", icon: RotateCcw, any: ["returns.read"] },
      { href: "/admin/reviews", label: "Reviews", icon: Star, any: ["reviews.read"] },
      { href: "/admin/invoices", label: "Invoices", icon: ReceiptText, any: ["invoices.read"] },
      { href: "/admin/shipping", label: "Shipping", icon: Truck, any: ["shipping.read"] },
    ],
  },
  {
    group: "Marketing",
    items: [
      { href: "/admin/coupons", label: "Coupons", icon: Tag, any: ["coupons.read"] },
      { href: "/admin/discounts", label: "Discounts", icon: BadgePercent, any: ["discounts.read"] },
    ],
  },
  {
    // What the storefront says: the home page sections, the About us page, the contact details and the legal pages.
    group: "CMS",
    items: [
      { href: "/admin/cms/home", label: "Home page", icon: House, any: ["settings.read"] },
      { href: "/admin/home-offers", label: "Home page offers", icon: Megaphone, any: ["settings.read"] },
      { href: "/admin/cms/about", label: "About us", icon: Info, any: ["settings.read"] },
      { href: "/admin/cms/contact", label: "Contact us", icon: Contact, any: ["settings.read"] },
      { href: "/admin/cms/terms", label: "Terms & Conditions", icon: FileText, any: ["settings.read"] },
      { href: "/admin/cms/privacy", label: "Privacy Policy", icon: FileLock2, any: ["settings.read"] },
    ],
  },
  {
    group: "Messaging",
    items: [
      { href: "/admin/notifications", label: "Notifications", icon: Bell, any: ["notifications.read"] },
      { href: "/admin/sms", label: "SMS", icon: MessageSquare, any: ["notifications.read"] },
      { href: "/admin/email", label: "Email", icon: Mail, any: ["notifications.read"] },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3, any: ["reports.read"] },
      { href: "/admin/users", label: "Users", icon: UserCog, any: ["users.read"] },
      { href: "/admin/roles", label: "Roles", icon: ShieldCheck, any: ["roles.read"] },
      { href: "/admin/permissions", label: "Permissions", icon: KeyRound, any: ["roles.read"] },
      { href: "/admin/settings", label: "Settings", icon: Settings, any: ["settings.read"] },
      { href: "/admin/appearance", label: "Appearance", icon: Palette, any: ["settings.read"] },
      { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText, any: ["audit.read"] },
    ],
  },
];

