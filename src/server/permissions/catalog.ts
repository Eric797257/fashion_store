export const PERMISSION_DEFINITIONS = [
  // Area access
  { key: "admin.access", description: "Open the admin dashboard" },
  { key: "rider.access", description: "Open the rider delivery app" },

  // Catalog
  { key: "product.read", description: "View products" },
  { key: "product.create", description: "Create products" },
  { key: "product.update", description: "Edit products, variants and prices" },
  { key: "product.archive", description: "Archive or restore products" },
  { key: "category.manage", description: "Create, edit and delete categories" },

  // Inventory
  { key: "inventory.read", description: "View stock and movement history" },
  { key: "inventory.adjust", description: "Adjust stock quantities" },

  // Orders
  { key: "order.read", description: "View orders" },
  { key: "order.process", description: "Confirm, pack and progress orders" },
  { key: "order.cancel", description: "Cancel orders" },
  { key: "order.refund", description: "Issue refunds" },

  // Payments
  { key: "payment.read", description: "View payments" },
  { key: "payment.verify", description: "Verify manual transfer slips" },
  { key: "payment.cod_collect", description: "Record COD cash collected on own deliveries" },
  { key: "payment.cod_reconcile", description: "Reconcile COD cash handed in by riders" },

  // Shipments
  { key: "shipment.read", description: "View shipments" },
  { key: "shipment.manage", description: "Assign carriers or riders and update any shipment" },
  { key: "shipment.update_own", description: "Update status of own assigned deliveries" },
  { key: "rider.manage", description: "Manage rider profiles and zones" },

  // Customers
  { key: "customer.read", description: "View customer profiles and order history" },
  { key: "customer.view_contact", description: "See customer phone and email" },
  { key: "customer.update_status", description: "Suspend or reactivate customer accounts" },
  { key: "customer.notes", description: "Read and write support notes" },

  // Promotions
  { key: "coupon.read", description: "View coupons" },
  { key: "coupon.manage", description: "Create, edit and expire coupons" },

  // Settings
  { key: "settings.read", description: "View store settings" },
  { key: "settings.manage", description: "Edit store settings, shipping and tax rules" },

  // People and security
  { key: "staff.manage", description: "Create and manage STAFF and RIDER accounts" },
  { key: "admin_account.manage", description: "Create and manage ADMIN accounts" },
  { key: "role.manage", description: "Edit roles and their permissions" },

  // Insight and moderation
  { key: "report.read", description: "View reports and dashboard metrics" },
  { key: "audit.read", description: "View the audit log" },
  { key: "review.moderate", description: "Approve or remove product reviews" },
] as const;

export type PermissionKey = (typeof PERMISSION_DEFINITIONS)[number]["key"];

export const ROLE_KEYS = ["SUPER_ADMIN", "ADMIN", "STAFF", "RIDER", "CUSTOMER"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

const ALL_KEYS: PermissionKey[] = PERMISSION_DEFINITIONS.map((p) => p.key);

const SUPER_ADMIN_ONLY: PermissionKey[] = ["role.manage", "admin_account.manage"];
const RIDER_ONLY: PermissionKey[] = ["rider.access", "shipment.update_own", "payment.cod_collect"];

export interface RoleDefinition {
  name: string;
  description: string;
  rank: number;
  permissions: PermissionKey[];
}

export const ROLE_DEFINITIONS: Record<RoleKey, RoleDefinition> = {
  SUPER_ADMIN: {
    name: "Super admin",
    description: "Store owner. Full access, including roles and admin accounts.",
    rank: 100,
    permissions: ALL_KEYS,
  },
  ADMIN: {
    name: "Admin",
    description: "Runs the store day to day. Cannot edit roles or admin accounts.",
    rank: 80,
    permissions: ALL_KEYS.filter(
      (k) => !SUPER_ADMIN_ONLY.includes(k) && !RIDER_ONLY.includes(k),
    ),
  },
  STAFF: {
    name: "Staff",
    description: "Processes orders and shipments. No access to money, settings or accounts.",
    rank: 50,
    permissions: [
      "admin.access",
      "product.read",
      "inventory.read",
      "order.read",
      "order.process",
      "payment.read",
      "shipment.read",
      "shipment.manage",
      "customer.read",
      "coupon.read",
    ],
  },
  RIDER: {
    name: "Rider",
    description: "In-house delivery team member.",
    rank: 30,
    permissions: ["rider.access", "shipment.update_own", "payment.cod_collect"],
  },
  CUSTOMER: {
    name: "Customer",
    description: "Storefront customer. Access to own data only (checked by ownership).",
    rank: 10,
    permissions: [],
  },
};

/** Roles whose accounts get the strictest security rules. */
export const PRIVILEGED_ROLES: readonly RoleKey[] = ["SUPER_ADMIN", "ADMIN", "STAFF", "RIDER"];

export function isPrivilegedRole(role: string | null | undefined): boolean {
  return PRIVILEGED_ROLES.includes(role as RoleKey);
}