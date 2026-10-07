import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { ConfirmProvider } from './components/confirm';
import { canAccess, homePath } from './auth/access';
import { DashboardLayout } from './layouts/DashboardLayout';
import { BrandMark } from './components/BrandMark';
import { LoginPage } from './pages/Login';
import { ForgotPasswordPage } from './pages/ForgotPassword';
import { ResetPasswordPage } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { ServiceRequests } from './pages/ServiceRequests';
import { ServiceRequestDetail } from './pages/ServiceRequestDetail';
import { WorkOrders } from './pages/WorkOrders';
import { WorkOrderDetail } from './pages/WorkOrderDetail';
import { Quotations } from './pages/Quotations';
import { Invoices } from './pages/Invoices';
import { Payments } from './pages/Payments';
import { Customers } from './pages/Customers';
import { CustomerDetail } from './pages/CustomerDetail';
import { Vessels } from './pages/Vessels';
import { VesselDetail } from './pages/VesselDetail';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { Users } from './pages/Users';
import { Roles } from './pages/Roles';
import { Reports } from './pages/Reports';
import { Feedback } from './pages/Feedback';
import { Notifications } from './pages/Notifications';
import { Company } from './pages/Company';
import { Audit } from './pages/Audit';
import { Settings } from './pages/Settings';
import { Team } from './pages/Team';
import { Search } from './pages/Search';
import { Profile } from './pages/Profile';
import { Inventory } from './pages/Inventory';
import { InventoryDetail } from './pages/InventoryDetail';
import { InventoryReport } from './pages/InventoryReport';
import { StockMovements } from './pages/StockMovements';
import { Suppliers } from './pages/Suppliers';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { PurchaseOrderDetail } from './pages/PurchaseOrderDetail';
import { MyOrders } from './pages/MyOrders';
import { Appointments } from './pages/Appointments';
import { Reception } from './pages/Reception';
import { NewRequest } from './pages/NewRequest';

const queryClient = new QueryClient();

function Guard() {
  const { session, profile, loading, can } = useAuth();
  const { pathname } = useLocation();
  if (loading) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-lmew-blue-900 text-sm text-sky-100" role="status">
      <BrandMark className="h-16 w-16" />
      Loading your workspace…
    </div>
  );
  if (!session || !profile) return <Navigate to="/login" replace />;
  if (!canAccess(can, pathname)) return <Navigate to={homePath(can)} replace />;
  return <DashboardLayout />;
}

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <ConfirmProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<Guard />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/reception" element={<Reception />} />
            <Route path="/requests/new" element={<NewRequest />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/team" element={<Team />} />
            <Route path="/service-requests" element={<ServiceRequests />} />
            <Route path="/service-requests/:id" element={<ServiceRequestDetail />} />
            <Route path="/work-orders" element={<WorkOrders />} />
            <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
            <Route path="/quotations" element={<Quotations />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/vessels" element={<Vessels />} />
            <Route path="/vessels/:id" element={<VesselDetail />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/report" element={<InventoryReport />} />
            <Route path="/inventory/:id" element={<InventoryDetail />} />
            <Route path="/stock-movements" element={<StockMovements />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/purchase-orders/:id" element={<PurchaseOrderDetail />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/my-orders/:id" element={<PurchaseOrderDetail />} />
            <Route path="/users" element={<Users />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/company" element={<Company />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
        </ConfirmProvider>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

function HomeRedirect() {
  const { session, profile, loading, can } = useAuth();
  if (loading) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-lmew-blue-900 text-sm text-sky-100" role="status">
      <BrandMark className="h-16 w-16" />
      Loading your workspace…
    </div>
  );
  if (!session || !profile) return <Navigate to="/login" replace />;
  return <Navigate to={homePath(can)} replace />;
}
