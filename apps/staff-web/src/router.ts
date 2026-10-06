import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import type { UserRole } from '@lmew/shared-types';
import StaffLayout from './layouts/StaffLayout.vue';
import LoginView from './views/LoginView.vue';
import InventoryView from './views/InventoryView.vue';
import InventoryDetailView from './views/InventoryDetailView.vue';
import StockMovementsView from './views/StockMovementsView.vue';
import PurchaseOrdersView from './views/PurchaseOrdersView.vue';
import PurchaseOrderDetailView from './views/PurchaseOrderDetailView.vue';
import SuppliersView from './views/SuppliersView.vue';
import ReceptionView from './views/ReceptionView.vue';
import MyOrdersView from './views/MyOrdersView.vue';
import AppointmentsView from './views/AppointmentsView.vue';
import NewRequestView from './views/NewRequestView.vue';
import InventoryReportView from './views/InventoryReportView.vue';
import ProfileView from './views/ProfileView.vue';
import { useAuthStore } from './stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/login', component: LoginView },
  {
    path: '/',
    component: StaffLayout,
    meta: { auth: true },
    children: [
      { path: '', redirect: '/inventory' },
      { path: 'inventory', component: InventoryView, meta: { roles: ['store_manager', 'procurement_officer', 'administrator'] } },
      { path: 'inventory/:id', component: InventoryDetailView, meta: { roles: ['store_manager', 'procurement_officer', 'administrator'] } },
      { path: 'stock-movements', component: StockMovementsView, meta: { roles: ['store_manager', 'administrator'] } },
      { path: 'purchase-orders', component: PurchaseOrdersView, meta: { roles: ['store_manager', 'procurement_officer', 'administrator'] } },
      { path: 'purchase-orders/:id', component: PurchaseOrderDetailView, meta: { roles: ['store_manager', 'procurement_officer', 'administrator', 'supplier'] } },
      { path: 'suppliers', component: SuppliersView, meta: { roles: ['store_manager', 'procurement_officer', 'administrator'] } },
      { path: 'my-orders', component: MyOrdersView, meta: { roles: ['supplier'] } },
      { path: 'appointments', component: AppointmentsView, meta: { roles: ['receptionist', 'administrator'] } },
      { path: 'service-requests/new', component: NewRequestView, meta: { roles: ['receptionist', 'administrator'] } },
      { path: 'walk-in', component: ReceptionView, meta: { roles: ['receptionist', 'administrator'] } },
      { path: 'reception', redirect: '/walk-in' },
      { path: 'reports/inventory', component: InventoryReportView, meta: { roles: ['store_manager', 'administrator'] } },
      { path: 'profile', component: ProfileView, meta: { roles: ['store_manager', 'procurement_officer', 'receptionist', 'supplier', 'administrator'] } },
    ],
  },
];

export const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (auth.loading) await auth.init();
  if (to.path === '/login') return auth.session && auth.profile ? homeFor(auth.profile.role) : true;
  if (to.meta.auth && (!auth.session || !auth.profile)) return '/login';
  const roles = to.meta.roles as UserRole[] | undefined;
  if (roles && auth.profile && !roles.includes(auth.profile.role)) return homeFor(auth.profile.role);
  return true;
});

function homeFor(role: UserRole) {
  if (role === 'supplier') return '/my-orders';
  if (role === 'receptionist') return '/walk-in';
  return '/inventory';
}
