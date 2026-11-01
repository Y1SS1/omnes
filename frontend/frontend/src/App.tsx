import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RegisterWorkerPage from "./pages/RegisterWorkerPage";
import DashboardPage from "./pages/DashboardPage";
import WalletPage from "./pages/WalletPage";
import ReportsPage from "./pages/ReportsPage";
import WorkersAdminPage from "./pages/WorkersAdminPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/registro-trabajador" element={<RegisterWorkerPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        {/* Presupuesto y Ahorros ahora viven dentro de Billetera. */}
        <Route path="/budget" element={<Navigate to="/wallet" replace />} />
        <Route path="/savings" element={<Navigate to="/wallet" replace />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route
          path="/trabajadores"
          element={
            <AdminRoute>
              <WorkersAdminPage />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <AppRoutes />
      </CurrencyProvider>
    </AuthProvider>
  );
}
