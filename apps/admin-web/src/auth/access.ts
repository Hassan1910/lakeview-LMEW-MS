export type NavSection = 'Overview' | 'Front desk' | 'Service' | 'Finance' | 'Inventory & procurement' | 'Supplier' | 'Administration';

export interface ModuleRoute {
  path: string;
  label: string;
  section: NavSection;
  /** Visible when the user holds any of these permissions. */
  any: string[];
  /** Reachable by URL but not listed in the sidebar. */
  hidden?: boolean;
  /** Left out of the sidebar when the user holds any of these, because a broader module covers it. */
  coveredBy?: string[];
}

export const REPORT_PERMISSIONS = ['service_requests.view_reports', 'invoices.view_reports', 'inventory.view_reports'];

export const NAV_SECTIONS: NavSection[] = ['Overview', 'Front desk', 'Service', 'Finance', 'Inventory & procurement', 'Supplier', 'Administration'];

// The database enforces every rule below through RLS; this catalog only decides what to show.
export const MODULES: ModuleRoute[] = [
  { path: '/dashboard', label: 'Dashboard', section: 'Overview', any: ['dashboard.view'] },
  { path: '/notifications', label: 'Notifications', section: 'Overview', any: ['portal.access'] },
  { path: '/search', label: 'Search', section: 'Overview', any: ['customers.view', 'vessels.view', 'service_requests.view'], hidden: true },
  { path: '/profile', label: 'My profile', section: 'Overview', any: ['portal.access'], hidden: true },

  { path: '/reception', label: 'Walk-in customer', section: 'Front desk', any: ['customers.create'] },
  { path: '/requests/new', label: 'New service request', section: 'Front desk', any: ['service_requests.create'] },
  { path: '/appointments', label: 'Appointments', section: 'Front desk', any: ['appointments.view'] },

  { path: '/team', label: 'Team', section: 'Service', any: ['team.view'] },
  { path: '/service-requests', label: 'Service requests', section: 'Service', any: ['service_requests.view'] },
  { path: '/work-orders', label: 'Work orders', section: 'Service', any: ['work_orders.view'] },
  { path: '/quotations', label: 'Quotations', section: 'Service', any: ['quotations.view'] },
  { path: '/customers', label: 'Customers', section: 'Service', any: ['customers.view'] },
  { path: '/vessels', label: 'Vessels', section: 'Service', any: ['vessels.view'] },
  { path: '/feedback', label: 'Feedback', section: 'Service', any: ['feedback.view'] },

  { path: '/invoices', label: 'Invoices', section: 'Finance', any: ['invoices.view'] },
  { path: '/payments', label: 'Payments', section: 'Finance', any: ['payments.view'] },
  { path: '/reports', label: 'Reports', section: 'Finance', any: REPORT_PERMISSIONS },

  { path: '/inventory', label: 'Inventory', section: 'Inventory & procurement', any: ['inventory.view'] },
  { path: '/inventory/report', label: 'Stock report', section: 'Inventory & procurement', any: ['inventory.view_reports'] },
  { path: '/stock-movements', label: 'Stock movements', section: 'Inventory & procurement', any: ['stock_movements.view'] },
  { path: '/suppliers', label: 'Suppliers', section: 'Inventory & procurement', any: ['suppliers.view'] },
  { path: '/purchase-orders', label: 'Purchase orders', section: 'Inventory & procurement', any: ['purchase_orders.view'] },

  { path: '/my-orders', label: 'My purchase orders', section: 'Supplier', any: ['purchase_orders.view_own'], coveredBy: ['purchase_orders.view'] },

  { path: '/users', label: 'Users', section: 'Administration', any: ['users.view', 'users.manage'] },
  { path: '/roles', label: 'Roles & permissions', section: 'Administration', any: ['roles.view', 'roles.manage'] },
  { path: '/company', label: 'Company', section: 'Administration', any: ['company.edit'] },
  { path: '/audit', label: 'Audit log', section: 'Administration', any: ['audit.view'] },
  { path: '/settings', label: 'Settings', section: 'Administration', any: ['settings.manage'] },
];

export type Can = (key: string) => boolean;

/** The most specific module that owns a path, so /inventory/report is not judged by /inventory. */
export function moduleFor(path: string) {
  return MODULES
    .filter((item) => path === item.path || path.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

export function canAccess(can: Can, path: string) {
  const rule = moduleFor(path);
  if (!rule) return false;
  return rule.any.some(can);
}

export function navModules(can: Can) {
  return MODULES.filter((item) => !item.hidden && item.any.some(can) && !item.coveredBy?.some(can));
}

// Notifications is open to every role, so it is only the landing page when nothing else is.
export function homePath(can: Can) {
  const visible = navModules(can);
  return (visible.find((item) => item.path !== '/notifications') ?? visible[0])?.path ?? '/profile';
}
