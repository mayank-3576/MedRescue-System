import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AppLayout from './components/layout/AppLayout';
import ToastProvider from './components/common/Toast';
import LoadingSpinner from './components/common/LoadingSpinner';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import StaffRegistrationPage from './pages/auth/StaffRegistrationPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import HospitalsPage from './pages/admin/HospitalsPage';
import StaffManagementPage from './pages/admin/StaffManagementPage';
import AdminInventoryPage from './pages/admin/AdminInventoryPage';
import AdminExpiryAlerts from './pages/admin/AdminExpiryAlerts';
import RescueEnginePage from './pages/admin/RescueEnginePage';
import AdminMapPage from './pages/admin/AdminMapPage';
import AdminTransfersPage from './pages/admin/AdminTransfersPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import SettingsPage from './pages/admin/SettingsPage';

// Staff Pages
import StaffDashboard from './pages/staff/StaffDashboard';
import MyInventoryPage from './pages/staff/MyInventoryPage';
import MedicineBatchesPage from './pages/staff/MedicineBatchesPage';
import StaffExpiryAlerts from './pages/staff/StaffExpiryAlerts';
import RescueRecommendationsPage from './pages/staff/RescueRecommendationsPage';
import StaffMapPage from './pages/staff/StaffMapPage';
import StaffTransfersPage from './pages/staff/StaffTransfersPage';
import StaffAnalyticsPage from './pages/staff/StaffAnalyticsPage';
import MedicineAssistantPage from './pages/staff/MedicineAssistantPage';
import MyProfilePage from './pages/staff/MyProfilePage';
import EnvironmentalForecastPage from './pages/common/EnvironmentalForecastPage';
import ShopPage from './pages/common/ShopPage';
import WalletPage from './pages/admin/WalletPage';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredRole?: 'admin' | 'staff';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <LoadingSpinner size="lg" message="Verifying MedRescue session..." />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Redirect to the appropriate portal according to their actual role
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/staff/dashboard'} replace />;
  }

  return children;
};

const RootRedirect: React.FC = () => {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/staff/dashboard'} replace />;
};

export const App: React.FC = () => {
  return (
    <>
      <ToastProvider />
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<StaffRegistrationPage />} />
        <Route path="/shop" element={<ProtectedRoute requiredRole="staff"><ShopPage /></ProtectedRoute>} />

        {/* Root Redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Protected Admin Portal */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="hospitals" element={<HospitalsPage />} />
          <Route path="staff-management" element={<StaffManagementPage />} />
          <Route path="inventory" element={<AdminInventoryPage />} />
          <Route path="alerts" element={<AdminExpiryAlerts />} />
          <Route path="rescue" element={<RescueEnginePage />} />
          <Route path="map" element={<AdminMapPage />} />
          <Route path="transfers" element={<AdminTransfersPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="forecast" element={<EnvironmentalForecastPage />} />
          <Route path="audit" element={<AuditLogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="wallet" element={<WalletPage />} />
        </Route>

        {/* Protected Hospital Staff Portal */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute requiredRole="staff">
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/staff/dashboard" replace />} />
          <Route path="dashboard" element={<StaffDashboard />} />
          <Route path="inventory" element={<MyInventoryPage />} />
          <Route path="batches" element={<MedicineBatchesPage />} />
          <Route path="forecast" element={<EnvironmentalForecastPage />} />
          <Route path="alerts" element={<StaffExpiryAlerts />} />
          <Route path="rescue" element={<RescueRecommendationsPage />} />
          <Route path="map" element={<StaffMapPage />} />
          <Route path="transfers" element={<StaffTransfersPage />} />
          <Route path="analytics" element={<StaffAnalyticsPage />} />
          <Route path="assistant" element={<MedicineAssistantPage />} />
          <Route path="profile" element={<MyProfilePage />} />
        </Route>

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;
