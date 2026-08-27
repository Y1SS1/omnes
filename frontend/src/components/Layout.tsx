import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as notificationsApi from "../api/notifications";
import type { NotificationDto } from "../api/types";

const navItems = [
  { to: "/", label: "Inicio", icon: "🏠", end: true },
  { to: "/tasks", label: "Tareas", icon: "📝" },
  { to: "/habits", label: "Hábitos", icon: "✅" },
  { to: "/calendar", label: "Calendario", icon: "📅" },
  { to: "/wallet", label: "Billetera", icon: "💰" },
  { to: "/budget", label: "Presupuesto", icon: "📊" },
  { to: "/savings", label: "Ahorros", icon: "🐷" },
  { to: "/reports", label: "Reportes", icon: "📈" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const loadNotifications = async () => {
    try {
      setNotifications(await notificationsApi.getNotifications());
    } catch {
      // ignore transient failures
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-black text-neutral-200 flex flex-col">
        <div className="px-5 py-5 text-xl font-bold tracking-tight text-white">TaskFlow</div>
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-indigo-600 text-white" : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-neutral-800 text-sm">
          <div className="font-medium truncate text-white">{user?.displayName}</div>
          <button onClick={handleLogout} className="mt-2 text-neutral-500 hover:text-white text-xs">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-neutral-800 bg-neutral-900 flex items-center justify-end px-6 relative">
          <button
            onClick={() => setShowNotifications((s) => !s)}
            className="relative rounded-full p-2 hover:bg-neutral-800"
            aria-label="Notificaciones"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-6 top-14 w-80 max-h-96 overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg shadow-black/40 z-20">
              {notifications.length === 0 && (
                <div className="p-4 text-sm text-neutral-400">Sin notificaciones por ahora.</div>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={async () => {
                    if (!n.isRead) {
                      await notificationsApi.markNotificationRead(n.id);
                      loadNotifications();
                    }
                  }}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-neutral-800 last:border-0 hover:bg-neutral-800 ${
                    n.isRead ? "text-neutral-500" : "text-white font-medium"
                  }`}
                >
                  {n.message}
                  <div className="text-[11px] text-neutral-500 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </header>
        <main className="flex-1 p-6 bg-neutral-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
