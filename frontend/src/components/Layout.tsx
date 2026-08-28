import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo } from "./Logo";
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
  const location = useLocation();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const pillClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-600 border-indigo-600 text-white"
        : "border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white"
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-900 px-4 md:px-6 relative">
        <div className="h-16 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Logo width={28} height={28} />
            <span className="text-lg font-bold tracking-tight text-white hidden sm:inline">Omnes</span>
          </div>

          <nav className="hidden md:flex items-center gap-2 overflow-x-auto flex-1 min-w-0 ml-8">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={pillClass}>
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setMenuOpen((s) => !s)}
            className="md:hidden ml-auto text-neutral-300 hover:text-white p-2"
            aria-label="Abrir menú"
          >
            ☰
          </button>

          <div className="hidden md:flex items-center gap-3 ml-auto shrink-0">
            <span className="text-sm text-neutral-400 truncate max-w-[10rem]">{user?.displayName}</span>
            <button onClick={handleLogout} className="text-xs text-neutral-500 hover:text-white">
              Cerrar sesión
            </button>
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
          </div>

          <button
            onClick={() => setShowNotifications((s) => !s)}
            className="md:hidden relative rounded-full p-2 hover:bg-neutral-800"
            aria-label="Notificaciones"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Mobile nav menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? "bg-indigo-600 text-white" : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
            <div className="flex items-center justify-between px-3 pt-3 mt-2 border-t border-neutral-800 text-sm">
              <span className="text-neutral-400 truncate">{user?.displayName}</span>
              <button onClick={handleLogout} className="text-neutral-500 hover:text-white text-xs">
                Cerrar sesión
              </button>
            </div>
          </div>
        )}

        {showNotifications && (
          <div className="absolute right-4 md:right-6 top-16 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg shadow-black/40 z-20">
            {notifications.length === 0 ? (
              <div className="p-4 text-sm text-neutral-400">Sin notificaciones por ahora.</div>
            ) : (
              <div className="flex justify-end px-3 py-2 border-b border-neutral-800">
                <button
                  onClick={async () => {
                    await notificationsApi.clearNotifications();
                    loadNotifications();
                  }}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  Limpiar todas
                </button>
              </div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-2 px-4 py-3 text-sm border-b border-neutral-800 last:border-0 hover:bg-neutral-800"
              >
                <button
                  onClick={async () => {
                    if (!n.isRead) {
                      await notificationsApi.markNotificationRead(n.id);
                      loadNotifications();
                    }
                  }}
                  className={`flex-1 min-w-0 text-left ${n.isRead ? "text-neutral-500" : "text-white font-medium"}`}
                >
                  {n.message}
                  <div className="text-[11px] text-neutral-500 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </button>
                <button
                  onClick={async () => {
                    await notificationsApi.deleteNotification(n.id);
                    loadNotifications();
                  }}
                  className="shrink-0 text-neutral-600 hover:text-red-500"
                  aria-label="Borrar notificación"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 p-4 md:p-6 bg-neutral-950 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
