import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import TasksPage from "./pages/TasksPage";
import HabitsPage from "./pages/HabitsPage";
import CalendarPage from "./pages/CalendarPage";
import WalletPage from "./pages/WalletPage";
import BudgetPage from "./pages/BudgetPage";
import SavingsPage from "./pages/SavingsPage";
import ReportsPage from "./pages/ReportsPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/habits" element={<HabitsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/savings" element={<SavingsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
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
